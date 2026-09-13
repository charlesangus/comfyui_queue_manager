from pathlib import Path
import subprocess
import sys

import pytest

from scripts.validate_nodes import compare_node_returns, load_node_returns


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_metadata_import_without_comfyui_or_installed_dependencies():
    result = subprocess.run(
        [sys.executable, "-I", "-S", str(REPO_ROOT / "scripts" / "validate_nodes.py"), str(REPO_ROOT), str(REPO_ROOT)],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "No breaking changes detected" in result.stdout
    assert load_node_returns(REPO_ROOT) == {"Workflow Name": ("STRING",), "Queue Card Info": ()}


@pytest.mark.parametrize(
    ("base", "proposed", "expected"),
    [
        ({"Name": ("STRING",)}, {}, "node removed"),
        ({"Name": ("STRING",)}, {"Name": ()}, "return types changed or removed"),
        ({"Name": ("STRING",)}, {"Name": ("INT",)}, "return types changed or removed"),
        ({"Name": ("STRING", "INT")}, {"Name": ("INT", "STRING")}, "return types changed or removed"),
        ({"Name": ("STRING",)}, {"Name": ("STRING", "INT"), "Info": ()}, None),
    ],
)
def test_return_compatibility(base, proposed, expected):
    changes = compare_node_returns(base, proposed)

    if expected is None:
        assert changes == []
    else:
        assert len(changes) == 1
        assert expected in changes[0]


def test_metadata_import_does_not_suppress_missing_dependencies(tmp_path):
    package = tmp_path / "src" / "comfyui_queue_manager"
    package.mkdir(parents=True)
    (package / "nodes.py").write_text("import queue_manager_missing_dependency\n", encoding="utf-8")

    with pytest.raises(ModuleNotFoundError, match="queue_manager_missing_dependency"):
        load_node_returns(tmp_path)


def test_cli_rejects_removed_node(tmp_path):
    package = tmp_path / "src" / "comfyui_queue_manager"
    package.mkdir(parents=True)
    (package / "nodes.py").write_text(
        'class RemovedNode:\n    RETURN_TYPES = ("STRING",)\nNODE_CLASS_MAPPINGS = {"Removed": RemovedNode}\n',
        encoding="utf-8",
    )

    result = subprocess.run(
        [sys.executable, "-I", "-S", str(REPO_ROOT / "scripts" / "validate_nodes.py"), str(tmp_path), str(REPO_ROOT)],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "Removed: node removed" in result.stdout


def test_metadata_import_restores_existing_server_module():
    import server

    load_node_returns(REPO_ROOT)

    assert sys.modules["server"] is server
    assert "_queue_manager_node_metadata" not in sys.modules
