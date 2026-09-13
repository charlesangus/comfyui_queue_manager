import asyncio
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace


class _Response:
    def __init__(self, *, text=None, status=200, headers=None):
        self.text = text
        self.status = status
        self.headers = headers or {}


class _FileResponse(_Response):
    def __init__(self, path, *, headers=None):
        super().__init__(headers=headers)
        self.path = Path(path)


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
