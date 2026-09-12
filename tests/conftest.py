import sys
from types import ModuleType

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

import os
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
src_path = os.path.join(repo_root, "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)
