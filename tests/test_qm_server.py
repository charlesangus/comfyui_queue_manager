import asyncio
import importlib
from pathlib import Path
import sys
import time
from types import ModuleType, SimpleNamespace

import pytest


class _Response:
    def __init__(self, *, text=None, status=200, headers=None):
        self.text = text
        self.status = status
        self.headers = headers or {}


class _FileResponse(_Response):
    def __init__(self, path, *, headers=None):
        super().__init__(headers=headers)
        self.path = Path(path)


class _JsonResponse(_Response):
    def __init__(self, data=None, *, status=200, headers=None):
        super().__init__(status=status, headers=headers)
        self.data = data


def _json_response(data=None, *, status=200, headers=None):
    return _JsonResponse(data, status=status, headers=headers)


def _middleware(fn):
    return fn


@pytest.fixture
def qm_server(qm_queue, monkeypatch):
    """Builds a real QM_Server against the fake PromptServer set up by the
    qm_queue fixture, so its route handlers (registered via decorators onto
    fake_server.routes) can be invoked directly in tests."""
    aiohttp_module = ModuleType("aiohttp")
    aiohttp_module.web = SimpleNamespace(
        Response=_Response,
        FileResponse=_FileResponse,
        json_response=_json_response,
        middleware=_middleware,
    )
    monkeypatch.setitem(sys.modules, "aiohttp", aiohttp_module)
    sys.modules.pop("comfyui_queue_manager.qm_server", None)
    qm_server_module = importlib.import_module("comfyui_queue_manager.qm_server")

    qm_queue.queue_manager.queue = qm_queue.qm
    qm_server_module.QM_Server(qm_queue.queue_manager, "0.0.0-test")

    return SimpleNamespace(
        module=qm_server_module,
        routes=qm_queue.server.routes.handlers,
    )


def test_card_image_route_validates_name_and_serves_immutable_file(monkeypatch, tmp_path):
    aiohttp_module = ModuleType("aiohttp")
    aiohttp_module.web = SimpleNamespace(Response=_Response, FileResponse=_FileResponse)
    monkeypatch.setitem(sys.modules, "aiohttp", aiohttp_module)
    sys.modules.pop("comfyui_queue_manager.qm_server", None)
    qm_server = importlib.import_module("comfyui_queue_manager.qm_server")
    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()
    monkeypatch.setattr(qm_server.qm_card, "CARDS_DIR", cards_dir)

    missing_name = asyncio.run(qm_server.get_card_image(SimpleNamespace(query={})))
    invalid = asyncio.run(qm_server.get_card_image(SimpleNamespace(query={"name": "../escape.png"})))
    missing = asyncio.run(qm_server.get_card_image(SimpleNamespace(query={"name": "missing_1.png"})))
    image_path = cards_dir / qm_server.qm_card._card_image_name("existing", 1, "preview", b"png")
    image_path.write_bytes(b"png")
    existing = asyncio.run(qm_server.get_card_image(SimpleNamespace(query={"name": image_path.name})))

    assert missing_name.status == 400
    assert invalid.status == 400
    assert missing.status == 404
    assert existing.status == 200
    assert existing.path == image_path
    assert existing.headers["Cache-Control"] == "max-age=31536000"


def test_get_queue_route_returns_paginated_response(qm_server):
    handler = qm_server.routes[("GET", "/queue_manager/queue")]

    response = asyncio.run(handler(SimpleNamespace(query={})))

    assert response.status == 200
    assert response.data == {"running": [], "pending": [], "info": {"total": 0, "page": 0, "page_size": 100, "last_page": 0}}


def test_get_queue_route_does_not_block_the_event_loop(qm_server, qm_queue, monkeypatch):
    handler = qm_server.routes[("GET", "/queue_manager/queue")]

    def slow_get_current_queue(page, page_size, route="queue", filters=None, return_meta=False, order=None):
        time.sleep(0.2)
        return [], [], {"total": 0, "page": page, "page_size": page_size, "last_page": 0}

    # This is what the route handler actually calls via asyncio.to_thread —
    # patching it here proves the handler doesn't block the event loop on it.
    monkeypatch.setattr(qm_queue.qm, "get_current_queue", slow_get_current_queue)

    async def scenario():
        fast_done_at = []

        async def fast():
            await asyncio.sleep(0)
            fast_done_at.append(time.monotonic())

        start = time.monotonic()
        await asyncio.gather(handler(SimpleNamespace(query={})), fast())
        return fast_done_at[0] - start

    elapsed = asyncio.run(scenario())
    assert elapsed < 0.1, "a concurrent coroutine was blocked by the synchronous DB call"


def test_get_item_route_returns_full_untrimmed_item(qm_server, qm_queue):
    handler = qm_server.routes[("GET", "/queue_manager/item")]

    qm_queue.qm_db.write_query(
        "INSERT INTO queue (prompt_id, prompt, status) VALUES (?, ?, ?)",
        ("prompt-item-route", '[100, "prompt-item-route", {"some": "graph"}, {"extra_pnginfo": {"workflow": {"id": "wf", "nodes": [1]}}}, []]', 0),
    )
    db_id = qm_queue.qm_db.read_single("SELECT id FROM queue WHERE prompt_id = ?", ("prompt-item-route",))["id"]

    found = asyncio.run(handler(SimpleNamespace(query={"db_id": str(db_id)})))
    missing = asyncio.run(handler(SimpleNamespace(query={"db_id": "-1"})))
    invalid = asyncio.run(handler(SimpleNamespace(query={"db_id": "not-a-number"})))
    no_param = asyncio.run(handler(SimpleNamespace(query={})))

    assert found.status == 200
    assert found.data["item"][2] == {"some": "graph"}
    assert found.data["item"][3]["extra_pnginfo"]["workflow"]["nodes"] == [1]
    assert missing.status == 404
    assert invalid.status == 400
    assert no_param.status == 400
