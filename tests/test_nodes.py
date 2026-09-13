import math
import ast
import asyncio
from contextlib import nullcontext
import inspect
from pathlib import Path
from types import CodeType, FunctionType, SimpleNamespace
from unittest.mock import Mock
import pytest

from server import PromptServer

from comfyui_queue_manager import qm_card
from comfyui_queue_manager.nodes import AnyType, NODE_CLASS_MAPPINGS, QueueCardInfo, WorkflowName, current_running_item


def _running_item(prompt_id="prompt-card", workflow_name=""):
    return (
        1,
        prompt_id,
        {},
        {"extra_pnginfo": {"workflow": {"workflow_name": workflow_name}}},
        [],
    )


def _server_with_running(monkeypatch, item):
    server = SimpleNamespace(
        prompt_queue=SimpleNamespace(currently_running={1: item}),
        send_sync=Mock(),
    )
    monkeypatch.setattr(PromptServer, "instance", server)
    return server


def _insert_queue_item(qm_db, prompt_id="prompt-card"):
    qm_db.write_query(
        "INSERT INTO queue (prompt_id, prompt, status) VALUES (?, '[]', 1)",
        (prompt_id,),
    )
    return qm_db.read_single("SELECT id FROM queue WHERE prompt_id = ?", (prompt_id,))["id"]


def test_queue_card_info_metadata_and_registration():
    inputs = QueueCardInfo.INPUT_TYPES()["required"]

    assert isinstance(inputs["value"][0], AnyType)
    assert inputs["value"] == ("*", {})
    assert inputs["index"] == ("INT", {"default": 1, "min": 1, "max": 99})
    assert inputs["label"] == ("STRING", {"default": ""})
    assert QueueCardInfo.RETURN_TYPES == ()
    assert QueueCardInfo.OUTPUT_NODE is True
    assert QueueCardInfo.INPUT_IS_LIST is True
    assert QueueCardInfo.FUNCTION == "run"
    assert QueueCardInfo.CATEGORY == "Queue Manager"
    assert math.isnan(QueueCardInfo.IS_CHANGED())
    assert NODE_CLASS_MAPPINGS["Queue Card Info"] is QueueCardInfo
    assert (AnyType("*") != "anything") is False


def test_workflow_name_uses_shared_running_item_without_behavior_change(monkeypatch):
    item = _running_item(workflow_name="Test Workflow")
    _server_with_running(monkeypatch, item)

    assert current_running_item() is item
    assert WorkflowName().run() == ("Test Workflow",)


def test_queue_card_info_captures_text_and_notifies(monkeypatch, qm_db):
    db_id = _insert_queue_item(qm_db)
    server = _server_with_running(monkeypatch, _running_item())

    assert QueueCardInfo().run("runtime text", 3, "summary") == {"ui": {}}
    assert qm_card.load_card(db_id) == [{"index": 3, "label": "summary", "kind": "text", "value": "runtime text"}]
    server.send_sync.assert_called_once_with("queue-manager-queue-updated", {"card": "prompt-card"})


def test_queue_card_info_keeps_static_entry_for_non_renderable_value(monkeypatch, qm_db):
    db_id = _insert_queue_item(qm_db)
    static_entry = {"index": 2, "label": "preview", "kind": "text", "value": "static", "placeholder": True}
    qm_card.save_card(db_id, [static_entry])
    server = _server_with_running(monkeypatch, _running_item())

    assert QueueCardInfo().run(object(), 2, "preview") == {"ui": {}}
    assert qm_card.load_card(db_id) == [static_entry]
    server.send_sync.assert_not_called()


def test_queue_card_info_does_nothing_without_running_prompt(monkeypatch):
    server = _server_with_running(monkeypatch, _running_item())
    server.prompt_queue.currently_running = {}

    assert QueueCardInfo().run("ignored", 1, "") == {"ui": {}}
    server.send_sync.assert_not_called()


@pytest.mark.parametrize("values, expected", [(["first", "last"], "first"), ([[12, 99], [100]], "12")])
def test_queue_card_info_consumes_executor_lists_once(monkeypatch, qm_db, values, expected):
    db_id = _insert_queue_item(qm_db)
    server = _server_with_running(monkeypatch, _running_item())

    assert QueueCardInfo().run(values, [3], ["summary"]) == {"ui": {}}
    assert qm_card.load_card(db_id) == [{"index": 3, "label": "summary", "kind": "text", "value": expected}]
    server.send_sync.assert_called_once()


def test_queue_card_info_with_installed_comfyui_executor(monkeypatch, qm_db):
    executor_path = Path(__file__).resolve().parents[1] / ".local/ComfyUI/execution.py"
    if not executor_path.is_file():
        pytest.skip("Local ComfyUI checkout is not available")
    tree = ast.parse(executor_path.read_text())
    function = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == "_async_map_node_over_list")
    namespace = {
        "inspect": inspect,
        "is_class": inspect.isclass,
        "_ComfyNodeInternal": type("V3Node", (), {}),
        "ExecutionBlocker": type("ExecutionBlocker", (), {}),
        "CurrentNodeContext": lambda *args: nullcontext(),
    }
    compiled = compile(ast.Module(body=[function], type_ignores=[]), str(executor_path), "exec")
    mapper = FunctionType(
        next(code for code in compiled.co_consts if isinstance(code, CodeType)), namespace,
        argdefs=tuple(ast.literal_eval(default) for default in function.args.defaults),
    )
    db_id = _insert_queue_item(qm_db)
    server = _server_with_running(monkeypatch, _running_item())

    results = asyncio.run(mapper(
        "prompt-card", "card", QueueCardInfo(),
        {"value": ["first", "second", "last"], "index": [7], "label": ["result"]}, "run",
    ))

    assert results == [{"ui": {}}]
    assert qm_card.load_card(db_id) == [{"index": 7, "label": "result", "kind": "text", "value": "first"}]
    server.send_sync.assert_called_once()


@pytest.mark.parametrize("row_state", ["missing", "deleted", "present"])
def test_queue_card_info_image_cleanup_depends_on_merge(monkeypatch, qm_db, tmp_path, row_state):
    torch = pytest.importorskip("torch")
    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()
    monkeypatch.setattr(qm_card, "CARDS_DIR", cards_dir)
    server = _server_with_running(monkeypatch, _running_item())
    if row_state != "missing":
        _insert_queue_item(qm_db)
    if row_state == "deleted":
        merge = qm_card.merge_entry

        def delete_then_merge(prompt_id, entry):
            qm_db.write_query("DELETE FROM queue WHERE prompt_id = ?", (prompt_id,))
            return merge(prompt_id, entry)

        monkeypatch.setattr(qm_card, "merge_entry", delete_then_merge)
    unrelated = cards_dir / qm_card._card_image_name("other", 1)
    unrelated.write_bytes(b"unrelated")

    QueueCardInfo().run([torch.zeros((1, 2, 2, 3))], [1], ["image"])

    assert unrelated.read_bytes() == b"unrelated"
    if row_state == "present":
        assert len(list(cards_dir.iterdir())) == 2
        server.send_sync.assert_called_once()
    else:
        assert list(cards_dir.iterdir()) == [unrelated]
        server.send_sync.assert_not_called()


def test_failed_merge_does_not_remove_existing_content_version(monkeypatch, qm_db, tmp_path):
    torch = pytest.importorskip("torch")
    cards_dir = tmp_path / "cards"
    monkeypatch.setattr(qm_card, "CARDS_DIR", cards_dir)
    server = _server_with_running(monkeypatch, _running_item())
    tensor = torch.zeros((1, 2, 2, 3))
    qm_card.capture_runtime_value("prompt-card", 1, "image", tensor)
    existing = next(cards_dir.iterdir())
    content = existing.read_bytes()

    QueueCardInfo().run([tensor], [1], ["image"])

    assert existing.read_bytes() == content
    server.send_sync.assert_not_called()
