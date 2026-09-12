import heapq
import threading


class FakePromptQueue:
    def __init__(self):
        self.mutex = threading.RLock()
        self.not_empty = threading.Condition(self.mutex)
        self.queue = []
        self.currently_running = {}
        self.task_counter = 0

    def put(self, item):
        with self.mutex:
            heapq.heappush(self.queue, item)
            self.not_empty.notify()

    # Real PromptQueue.get() blocks on not_empty until an item is available;
    # callers in this test suite only ever invoke it once an item is known
    # to be queued, so a non-blocking pop is sufficient here.
    def get(self, timeout=None):
        with self.mutex:
            if not self.queue:
                return None
            item = heapq.heappop(self.queue)
            task_id = self.task_counter
            self.currently_running[task_id] = item
            self.task_counter += 1
            return item, task_id

    def task_done(self, item_id, history_result=None, status=None, process_item=None):
        with self.mutex:
            self.currently_running.pop(item_id, None)

    def get_current_queue(self, *args, **kwargs):
        return [], []

    def get_tasks_remaining(self):
        return len(self.queue) + len(self.currently_running)


class FakeSettings:
    def __init__(self, settings=None):
        self._settings = settings if settings is not None else {}

    def get_settings(self, user=None):
        return self._settings


class FakeUserManager:
    def __init__(self, settings=None):
        self.settings = FakeSettings(settings)


class FakePromptServer:
    def __init__(self, prompt_queue=None):
        self.prompt_queue = prompt_queue if prompt_queue is not None else FakePromptQueue()
        self.user_manager = FakeUserManager()
        self.number = 0
        self.messages = []

    def send_sync(self, event, data, sid=None):
        self.messages.append(("send_sync", event, data, sid))

    def queue_updated(self):
        self.messages.append(("queue_updated",))


class FakeFolderPaths:
    def __init__(self, tmp_path):
        self._tmp_path = tmp_path

    def get_input_directory(self):
        return str(self._tmp_path / "input")

    def get_output_directory(self):
        return str(self._tmp_path / "output")

    def get_temp_directory(self):
        return str(self._tmp_path / "temp")
