from pathlib import Path
import hashlib
import sqlite3

import pytest

from comfyui_queue_manager import qm_card
from comfyui_queue_manager.qm_card import capture_runtime_value, extract_card_entries, load_card, load_card_by_prompt_id, merge_entry, save_card


def _insert_queue_item(qm_db, prompt_id="prompt-card"):
    qm_db.write_query(
        "INSERT INTO queue (prompt_id, prompt, status) VALUES (?, '[]', 0)",
        (prompt_id,),
    )
    return qm_db.read_single("SELECT id FROM queue WHERE prompt_id = ?", (prompt_id,))["id"]


def test_extracts_literal_text_and_applies_metadata_defaults():
    graph = {
        "1": {"class_type": "Queue Card Info", "inputs": {"value": 42}},
        "2": {"class_type": "Queue Card Info", "inputs": {"value": "hello", "index": "3", "label": 7}},
    }

    assert extract_card_entries(graph) == [
        {"index": 1, "label": "", "kind": "text", "value": "42"},
        {"index": 3, "label": "7", "kind": "text", "value": "hello"},
    ]


@pytest.mark.parametrize("value", [[1, 2], ["literal", "text"], [["nested"], 0], [{"nested": 1}, 0], []])
def test_extracts_literal_lists_without_treating_them_as_links(value):
    graph = {"card": {"class_type": "Queue Card Info", "inputs": {"value": value}}}

    assert extract_card_entries(graph) == [{"index": 1, "label": "", "kind": "text", "value": str(value)}]


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


def test_save_card_replaces_duplicate_rows_and_loads_by_id_or_prompt(qm_db):
    db_id = _insert_queue_item(qm_db)
    qm_db.write_query("INSERT INTO meta (item_id, key, value) VALUES (?, 'card', '[]')", (db_id,))
    qm_db.write_query("INSERT INTO meta (item_id, key, value) VALUES (?, 'card', '[]')", (db_id,))
    entries = [{"index": 1, "label": "title", "kind": "text", "value": "saved"}]

    save_card(db_id, entries)

    assert load_card(db_id) == entries
    assert load_card_by_prompt_id("prompt-card") == entries
    assert qm_db.read_single("SELECT COUNT(*) FROM meta WHERE item_id = ? AND key = 'card'", (db_id,))[0] == 1


def test_merge_entry_replaces_unique_exact_match(qm_db):
    db_id = _insert_queue_item(qm_db)
    save_card(db_id, [{"index": 1, "label": "title", "kind": "text", "value": "old"}])
    replacement = {"index": 1, "label": "title", "kind": "text", "value": "new"}

    assert merge_entry("prompt-card", replacement) == [replacement]
    assert load_card(db_id) == [replacement]


def test_merge_entry_keeps_same_index_with_different_label(qm_db):
    db_id = _insert_queue_item(qm_db)
    other_label = {"index": 2, "label": "other", "kind": "text", "value": "keep"}
    save_card(db_id, [other_label, {"index": 2, "label": "target", "kind": "text", "value": "old"}])
    replacement = {"index": 2, "label": "target", "kind": "text", "value": "new"}

    assert merge_entry("prompt-card", replacement) == [other_label, replacement]


def test_merge_entry_prefers_first_placeholder_among_exact_matches(qm_db):
    db_id = _insert_queue_item(qm_db)
    first = {"index": 3, "label": "same", "kind": "text", "value": "resolved"}
    placeholder = {"index": 3, "label": "same", "kind": "text", "value": "pending", "placeholder": True}
    later_placeholder = {"index": 3, "label": "same", "kind": "text", "value": "later", "placeholder": True}
    save_card(db_id, [first, placeholder, later_placeholder])
    replacement = {"index": 3, "label": "same", "kind": "image", "value": {"filename": "done.png"}}

    assert merge_entry("prompt-card", replacement) == [first, replacement, later_placeholder]


def test_merge_entry_replaces_only_first_exact_match_without_placeholder(qm_db):
    db_id = _insert_queue_item(qm_db)
    second = {"index": 4, "label": "same", "kind": "text", "value": "second"}
    save_card(db_id, [{"index": 4, "label": "same", "kind": "text", "value": "first"}, second])
    replacement = {"index": 4, "label": "same", "kind": "text", "value": "new"}

    assert merge_entry("prompt-card", replacement) == [replacement, second]


def test_merge_entry_appends_unmatched_label_with_stable_index_order(qm_db):
    db_id = _insert_queue_item(qm_db)
    same_index_first = {"index": 2, "label": "first", "kind": "text", "value": "first"}
    later = {"index": 5, "label": "later", "kind": "text", "value": "later"}
    save_card(db_id, [same_index_first, later])
    appended = {"index": 2, "label": "new", "kind": "text", "value": "new"}

    assert merge_entry("prompt-card", appended) == [same_index_first, appended, later]


def test_merge_entry_missing_or_deleted_queue_row_creates_no_metadata(qm_db):
    db_id = _insert_queue_item(qm_db)
    qm_db.write_query("DELETE FROM queue WHERE id = ?", (db_id,))

    assert merge_entry("prompt-card", {"index": 1, "label": "", "kind": "text", "value": "gone"}) is None
    assert qm_db.read_query("SELECT * FROM meta") == []


def test_merge_entry_locks_queue_row_until_metadata_is_saved(qm_db, monkeypatch):
    db_id = _insert_queue_item(qm_db)
    save = qm_card._save_card
    with sqlite3.connect(qm_db.DB_PATH, timeout=0) as competing:
        def save_while_delete_attempts(conn, item_id, entries):
            with pytest.raises(sqlite3.OperationalError, match="locked"):
                competing.execute("DELETE FROM queue WHERE id = ?", (db_id,))
            save(conn, item_id, entries)

        monkeypatch.setattr(qm_card, "_save_card", save_while_delete_attempts)
        entry = {"index": 1, "label": "", "kind": "text", "value": "saved"}
        assert merge_entry("prompt-card", entry) == [entry]

    assert load_card(db_id) == [entry]


def test_capture_runtime_value_handles_scalars_nested_lists_and_empty_lists():
    assert capture_runtime_value("prompt", 4, "result", [True]) == {
        "index": 4,
        "label": "result",
        "kind": "text",
        "value": "True",
    }
    assert capture_runtime_value("prompt", 5, "nested", [[12.5]]) == {
        "index": 5,
        "label": "nested",
        "kind": "text",
        "value": "12.5",
    }
    assert capture_runtime_value("prompt", 6, "empty", []) is None


def test_card_image_name_matches_route_contract_for_unsafe_prompt_id():
    filename = qm_card._card_image_name("prompt.with/slash", 2)

    assert qm_card.CARD_IMAGE_NAME_PATTERN.fullmatch(filename) is not None
    assert "." not in Path(filename).stem


def test_capture_runtime_tensor_saves_thumbnail_with_safe_name(monkeypatch, tmp_path):
    torch = pytest.importorskip("torch")
    image_module = pytest.importorskip("PIL.Image")
    cards_dir = tmp_path / "cards"
    monkeypatch.setattr(qm_card, "CARDS_DIR", cards_dir)
    tensor = torch.full((1, 300, 600, 3), 0.5)

    entry = capture_runtime_value("prompt/id", 7, "preview", tensor)

    assert entry is not None
    assert entry["index"] == 7
    assert entry["label"] == "preview"
    assert entry["kind"] == "image"
    filename = entry["value"]["url"].removeprefix("queue_manager/card-image?name=")
    assert "/" not in filename
    image_path = cards_dir / filename
    assert image_path.is_file()
    with image_module.open(image_path) as image:
        assert image.format == "PNG"
        assert image.size == (256, 128)
        assert image.getpixel((0, 0)) == (127, 127, 127)
    assert Path(filename).name == filename


def test_runtime_image_urls_distinguish_labels_and_content_without_overwriting(monkeypatch, tmp_path):
    torch = pytest.importorskip("torch")
    monkeypatch.setattr(qm_card, "CARDS_DIR", tmp_path)
    dark = torch.zeros((1, 2, 2, 3))
    light = torch.ones((1, 2, 2, 3))
    created = []

    first = capture_runtime_value("prompt", 1, "first", dark, created_images=created)
    original = created[0].read_bytes()
    other_label = capture_runtime_value("prompt", 1, "second", light, created_images=created)
    replay = capture_runtime_value("prompt", 1, "first", light, created_images=created)
    repeat = capture_runtime_value("prompt", 1, "first", light, created_images=created)

    assert len({entry["value"]["url"] for entry in [first, other_label, replay]}) == 3
    assert repeat == replay
    assert len(created) == 3
    assert created[0].read_bytes() == original
    assert qm_card.remove_card_images(["prompt"]) == 3


def test_versioned_image_ownership_cannot_alias_a_hashed_unsafe_prompt(monkeypatch, tmp_path):
    monkeypatch.setattr(qm_card, "CARDS_DIR", tmp_path)
    unsafe_id = "../prompt"
    safe_id = hashlib.sha256(unsafe_id.encode()).hexdigest()
    unsafe = tmp_path / qm_card._card_image_name(unsafe_id, 1)
    safe = tmp_path / qm_card._card_image_name(safe_id, 1)
    unsafe.write_bytes(b"unsafe")
    safe.write_bytes(b"safe")

    assert unsafe != safe
    assert qm_card.remove_card_images([unsafe_id]) == 1
    assert safe.read_bytes() == b"safe"


def test_removes_legacy_image_names_without_matching_prompt_prefixes(monkeypatch, tmp_path):
    monkeypatch.setattr(qm_card, "CARDS_DIR", tmp_path)
    (tmp_path / "job_1_2.png").write_bytes(b"legacy")
    (tmp_path / "job_1.png").write_bytes(b"other")

    assert qm_card.remove_card_images(["job_1"]) == 1
    assert (tmp_path / "job_1.png").exists()


def test_remove_card_images_matches_complete_encoded_prompt_id(monkeypatch, tmp_path):
    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()
    monkeypatch.setattr(qm_card, "CARDS_DIR", cards_dir)
    target_names = [qm_card._card_image_name("job_1", index) for index in (1, 2)]
    prefix_name = qm_card._card_image_name("job", 1)
    traversal_name = qm_card._card_image_name("../outside", 1)
    outside_file = tmp_path / "outside_1.png"
    for name in [*target_names, prefix_name, traversal_name]:
        (cards_dir / name).write_bytes(b"png")
    outside_file.write_bytes(b"outside")

    removed = qm_card.remove_card_images(["job_1", "../outside"])

    assert removed == 3
    assert all(not (cards_dir / name).exists() for name in [*target_names, traversal_name])
    assert (cards_dir / prefix_name).is_file()
    assert outside_file.is_file()


def test_prune_orphans_keeps_exact_encoded_queue_prompt_ids(qm_db, monkeypatch, tmp_path):
    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()
    monkeypatch.setattr(qm_card, "CARDS_DIR", cards_dir)
    _insert_queue_item(qm_db, "live_prompt_1")
    _insert_queue_item(qm_db, "live/prompt")
    live_names = [qm_card._card_image_name("live_prompt_1", 4), qm_card._card_image_name("live/prompt", -2)]
    orphan_names = [qm_card._card_image_name("live_prompt", 1), qm_card._card_image_name("orphan_prompt", 3)]
    unrelated_names = ["notes.txt", "not-a-runtime-card.png"]
    for name in [*live_names, *orphan_names, *unrelated_names]:
        (cards_dir / name).write_bytes(b"png")

    removed = qm_card.prune_orphans()

    assert removed == 2
    assert all((cards_dir / name).is_file() for name in [*live_names, *unrelated_names])
    assert all(not (cards_dir / name).exists() for name in orphan_names)


def test_prune_orphans_tolerates_absent_cards_directory(qm_db, monkeypatch, tmp_path):
    monkeypatch.setattr(qm_card, "CARDS_DIR", tmp_path / "missing")

    assert qm_card.prune_orphans() == 0
