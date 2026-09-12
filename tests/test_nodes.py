import math
from types import SimpleNamespace
from unittest.mock import Mock

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
