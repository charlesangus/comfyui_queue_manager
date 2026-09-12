from comfyui_queue_manager.qm_card import extract_card_entries


def test_extracts_literal_text_and_applies_metadata_defaults():
    graph = {
        "1": {"class_type": "Queue Card Info", "inputs": {"value": 42}},
        "2": {"class_type": "Queue Card Info", "inputs": {"value": "hello", "index": "3", "label": 7}},
    }

    assert extract_card_entries(graph) == [
        {"index": 1, "label": "", "kind": "text", "value": "42"},
        {"index": 3, "label": "7", "kind": "text", "value": "hello"},
    ]


def test_extracts_loadimage_and_loadimagemask_paths_and_annotations():
    graph = {
        "card-input": {"class_type": "Queue Card Info", "inputs": {"value": ["image", 0]}},
        "image": {"class_type": "LoadImage", "inputs": {"image": "folder/photo.png [output]"}},
        "card-mask": {"class_type": "Queue Card Info", "inputs": {"value": ["mask", 0], "index": 2}},
        "mask": {"class_type": "LoadImageMask", "inputs": {"image": "mask.png [temp]"}},
    }

    assert extract_card_entries(graph) == [
        {"index": 1, "label": "", "kind": "image", "value": {"filename": "photo.png", "subfolder": "folder", "type": "output"}},
        {"index": 2, "label": "", "kind": "image", "value": {"filename": "mask.png", "subfolder": "", "type": "temp"}},
    ]


def test_extracts_longest_string_input_from_other_source():
    graph = {
        "card": {"class_type": "Queue Card Info", "inputs": {"value": ["text", 0]}},
        "text": {"class_type": "CLIPTextEncode", "inputs": {"text": "the longest prompt", "clip": ["clip", 0], "short": "x"}},
        "clip": {"class_type": "Checkpoint", "inputs": {}},
    }

    assert extract_card_entries(graph)[0]["value"] == "the longest prompt"


def test_uses_placeholder_for_source_without_string_input():
    graph = {
        "card": {"class_type": "Queue Card Info", "inputs": {"value": ["latent", 0]}},
        "latent": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512}},
    }

    assert extract_card_entries(graph) == [
        {"index": 1, "label": "", "kind": "text", "value": "EmptyLatentImage", "placeholder": True}
    ]


def test_skips_missing_and_dangling_values_and_sorts_by_index_then_node_id():
    graph = {
        "z": {"class_type": "Queue Card Info", "inputs": {"value": ["source", 0], "index": 2}},
        "a": {"class_type": "Queue Card Info", "inputs": {"value": "first", "index": 2}},
        "dangling": {"class_type": "Queue Card Info", "inputs": {"value": ["gone", 0]}},
        "source": {"class_type": "PrimitiveStringMultiline", "inputs": {"value": "second"}},
        "other": {"class_type": "Not a card", "inputs": {"value": "ignored"}},
    }

    assert extract_card_entries(graph) == [
        {"index": 2, "label": "", "kind": "text", "value": "first"},
        {"index": 2, "label": "", "kind": "text", "value": "second"},
    ]
