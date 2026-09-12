"""Static extraction of Queue Card Info entries from ComfyUI prompt graphs."""

from typing import Any


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
