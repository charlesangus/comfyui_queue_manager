"""Static extraction of Queue Card Info entries from ComfyUI prompt graphs."""

import hashlib
import json
from pathlib import Path
import re
from typing import Any

from .qm_db import get_conn, read_query, read_single


CARDS_DIR = Path(__file__).resolve().parents[2] / "data" / "cards"
CARD_IMAGE_NAME_PATTERN = re.compile(r"[A-Za-z0-9_-]+\.png")
_CARD_IMAGE_PARTS_PATTERN = re.compile(r"(?P<prompt>[A-Za-z0-9_-]+)_(?P<index>-?\d+)\.png")


def _prompt_component(prompt_id: str) -> str:
    prompt_component = str(prompt_id)
    if len(prompt_component) > 200 or not re.fullmatch(r"[A-Za-z0-9_-]+", prompt_component):
        return hashlib.sha256(prompt_component.encode()).hexdigest()
    return prompt_component


def _card_image_name(prompt_id: str, index: int) -> str:
    return f"{_prompt_component(prompt_id)}_{index}.png"


def _card_image_files():
    try:
        paths = list(CARDS_DIR.iterdir())
    except OSError:
        return

    for path in paths:
        match = _CARD_IMAGE_PARTS_PATTERN.fullmatch(path.name)
        try:
            is_file = path.is_file()
        except OSError:
            is_file = False
        if match is not None and is_file:
            yield path, match.group("prompt")


def remove_card_images(prompt_ids) -> int:
    prompt_components = {_prompt_component(prompt_id) for prompt_id in prompt_ids}
    removed = 0
    for path, prompt_component in _card_image_files():
        if prompt_component not in prompt_components:
            continue
        try:
            path.unlink()
        except OSError:
            continue
        removed += 1
    return removed


def prune_orphans() -> int:
    prompt_components = {_prompt_component(row[0]) for row in read_query("SELECT prompt_id FROM queue")}
    removed = 0
    for path, prompt_component in _card_image_files():
        if prompt_component in prompt_components:
            continue
        try:
            path.unlink()
        except OSError:
            continue
        removed += 1
    return removed


def capture_runtime_value(prompt_id: str, index: int, label: str, value: Any) -> dict | None:
    if isinstance(value, list):
        if not value:
            return None
        return capture_runtime_value(prompt_id, index, label, value[0])

    if isinstance(value, (str, int, float, bool)):
        return {"index": index, "label": label, "kind": "text", "value": str(value)}

    try:
        import torch
    except ImportError:
        return None

    if not isinstance(value, torch.Tensor) or value.ndim != 4:
        return None

    from PIL import Image

    try:
        image_data = 255.0 * value[0].cpu().numpy()
        image = Image.fromarray(image_data.clip(0, 255).astype("uint8"))
    except (IndexError, KeyError, RuntimeError, TypeError, ValueError):
        return None
    image.thumbnail((256, 256))

    CARDS_DIR.mkdir(parents=True, exist_ok=True)
    filename = _card_image_name(prompt_id, index)
    image.save(CARDS_DIR / filename, format="PNG")
    return {
        "index": index,
        "label": label,
        "kind": "image",
        "value": {"url": f"queue_manager/card-image?name={filename}"},
    }


def save_card(db_id: int, entries: list[dict]) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM meta WHERE item_id = ? AND key = 'card'", (db_id,))
        conn.execute(
            "INSERT INTO meta (item_id, key, value) VALUES (?, 'card', ?)",
            (db_id, json.dumps(entries)),
        )


def load_card(db_id: int) -> list[dict] | None:
    row = read_single(
        """
        SELECT value
        FROM meta
        WHERE item_id = ? AND key = 'card'
        ORDER BY id DESC
        LIMIT 1
    """,
        (db_id,),
    )
    return None if row is None else json.loads(row[0])


def load_card_by_prompt_id(prompt_id: str) -> list[dict] | None:
    row = read_single(
        """
        SELECT card.value
        FROM queue
        LEFT JOIN meta AS card
            ON queue.id = card.item_id
            AND card.key = 'card'
            AND card.id = (
                SELECT MAX(candidate.id)
                FROM meta AS candidate
                WHERE candidate.item_id = queue.id AND candidate.key = 'card'
            )
        WHERE queue.prompt_id = ?
    """,
        (prompt_id,),
    )
    return None if row is None or row[0] is None else json.loads(row[0])


def merge_entry(prompt_id: str, entry: dict) -> list[dict] | None:
    row = read_single("SELECT id FROM queue WHERE prompt_id = ?", (prompt_id,))
    if row is None:
        return None

    db_id = row[0]
    entries = load_card(db_id) or []
    exact_matches = [
        index
        for index, existing in enumerate(entries)
        if existing.get("index") == entry.get("index") and existing.get("label") == entry.get("label")
    ]
    placeholder_matches = [index for index in exact_matches if entries[index].get("placeholder")]

    if placeholder_matches:
        entries[placeholder_matches[0]] = entry
    elif exact_matches:
        entries[exact_matches[0]] = entry
    else:
        entries.append(entry)
        entries.sort(key=lambda existing: existing.get("index", 1))

    save_card(db_id, entries)
    return entries


def _card_metadata(inputs: dict[str, Any]) -> tuple[int, str]:
    index_value = inputs.get("index", 1)
    try:
        index = int(index_value)
    except (TypeError, ValueError):
        index = 1

    label_value = inputs.get("label", "")
    label = "" if label_value is None else str(label_value)
    return index, label


def _image_value(source_inputs: dict[str, Any]) -> dict[str, str] | None:
    image = source_inputs.get("image")
    if not isinstance(image, str):
        return None

    image_type = "input"
    for annotation, annotation_type in ((" [input]", "input"), (" [output]", "output"), (" [temp]", "temp")):
        if image.endswith(annotation):
            image = image[: -len(annotation)]
            image_type = annotation_type
            break

    subfolder, separator, filename = image.rpartition("/")
    if not separator:
        subfolder = ""
        filename = image
    return {"filename": filename, "subfolder": subfolder, "type": image_type}


def _source_entry(source: dict[str, Any]) -> tuple[str, Any, bool]:
    class_type = source.get("class_type", "")
    if class_type in {"LoadImage", "LoadImageMask"}:
        image_value = _image_value(source.get("inputs", {}))
        if image_value is not None:
            return "image", image_value, False

    source_inputs = source.get("inputs", {})
    strings = [value for value in source_inputs.values() if isinstance(value, str)]
    if strings:
        return "text", max(strings, key=len), False
    return "text", str(class_type), True


def extract_card_entries(prompt_graph: dict) -> list[dict]:
    entries: list[tuple[int, str, dict]] = []
    for node_id, node in prompt_graph.items():
        if not isinstance(node, dict) or node.get("class_type") != "Queue Card Info":
            continue
        inputs = node.get("inputs", {})
        if not isinstance(inputs, dict):
            inputs = {}
        index, label = _card_metadata(inputs)
        value = inputs.get("value")
        if isinstance(value, list) and len(value) == 2:
            source = prompt_graph.get(value[0])
            if not isinstance(source, dict):
                continue
            kind, resolved_value, placeholder = _source_entry(source)
        else:
            kind, resolved_value, placeholder = "text", str(value), False

        entry = {"index": index, "label": label, "kind": kind, "value": resolved_value}
        if placeholder:
            entry["placeholder"] = True
        entries.append((index, str(node_id), entry))

    entries.sort(key=lambda item: (item[0], item[1]))
    return [entry for _, _, entry in entries]
