import sys
from types import ModuleType, SimpleNamespace
import importlib
import os
import pytest

from fake_comfy import FakePromptQueue, FakePromptServer, FakeFolderPaths, FakeNodes

class PromptQueue:
    def __init__(self):
        self.currently_running = {}


class PromptServerClass:
    instance = None

    def __init__(self):
        self.prompt_queue = PromptQueue()
        self.user_manager = None


PromptServerClass.instance = PromptServerClass()

stub_server = ModuleType("server")
stub_server.PromptServer = PromptServerClass
sys.modules["server"] = stub_server

stub_execution = ModuleType("execution")
stub_execution.PromptQueue = PromptQueue
sys.modules["execution"] = stub_execution

stub_folder_paths = ModuleType("folder_paths")
sys.modules["folder_paths"] = stub_folder_paths

fake_nodes = FakeNodes()
stub_nodes = ModuleType("nodes")
stub_nodes.interrupt_processing = fake_nodes.interrupt_processing
stub_nodes.interrupt_calls = fake_nodes.interrupt_calls
sys.modules["nodes"] = stub_nodes

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
src_path = os.path.join(repo_root, "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)


@pytest.fixture
def qm_db(tmp_path, monkeypatch):
    db_file = tmp_path / "test_qm-queue.db"
    monkeypatch.setenv("QM_DB_PATH", str(db_file))

    import comfyui_queue_manager.qm_db
    qm_db_module = importlib.reload(comfyui_queue_manager.qm_db)

    qm_db_module.init_schema()

    yield qm_db_module


class _FakeOptions:
    def __init__(self):
        self._values = {}

    def get(self, key, default=None, with_timestamp=False):
        value = self._values.get(key, default)
        return (value, None) if with_timestamp else value

    def set(self, key, value):
        self._values[key] = value


class _FakeQueueManager:
    def __init__(self):
        self.options = _FakeOptions()


@pytest.fixture
def qm_queue(qm_db, monkeypatch, tmp_path):
    # qm_queue.py is imported under the "src." prefix (per the real node
    # package layout), which is a distinct module tree from the plain
    # "comfyui_queue_manager" tree the qm_db fixture reloads above. Its
    # qm_db submodule must be reloaded too, using the same QM_DB_PATH env
    # var, so both trees point at the same sqlite file on disk.
    import src.comfyui_queue_manager.qm_db as src_qm_db

    src_qm_db = importlib.reload(src_qm_db)
    src_qm_db.init_schema()

    import src.comfyui_queue_manager.qm_queue as qm_queue_module

    qm_queue_module = importlib.reload(qm_queue_module)

    import server as server_module

    fake_folder_paths = FakeFolderPaths(tmp_path)
    import folder_paths as folder_paths_module

    monkeypatch.setattr(folder_paths_module, "get_input_directory", fake_folder_paths.get_input_directory, raising=False)
    monkeypatch.setattr(folder_paths_module, "get_output_directory", fake_folder_paths.get_output_directory, raising=False)
    monkeypatch.setattr(folder_paths_module, "get_temp_directory", fake_folder_paths.get_temp_directory, raising=False)

    fake_native_queue = FakePromptQueue()
    fake_server = FakePromptServer(fake_native_queue)
    monkeypatch.setattr(server_module.PromptServer, "instance", fake_server)

    queue_manager = _FakeQueueManager()
    instance = qm_queue_module.QM_Queue(queue_manager)

    yield SimpleNamespace(
        qm=instance,
        server=fake_server,
        native_queue=fake_native_queue,
        queue_manager=queue_manager,
        qm_db=src_qm_db,
    )
