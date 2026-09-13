import json

import pytest


def _make_item(number, prompt_id, workflow_name, workflow_id):
    return [
        number,
        prompt_id,
        {"some": "graph"},
        {"extra_pnginfo": {"workflow": {"workflow_name": workflow_name, "id": workflow_id}}},
        [],
    ]


def _card_graph(value="card value"):
    return {
        "card": {
            "class_type": "Queue Card Info",
            "inputs": {"value": value, "index": 2, "label": "summary"},
        }
    }


def test_queue_put_and_get_round_trip(qm_queue):
    item = _make_item(100, "prompt-abc-123", "My Workflow", "wf-1")

    qm_queue.native_queue.put(item)

    row = qm_queue.qm_db.read_single(
        "SELECT prompt_id, name, workflow_id, status FROM queue WHERE prompt_id = ?",
        ("prompt-abc-123",),
    )
    assert row is not None
    assert row["name"] == "My Workflow"
    assert row["workflow_id"] == "wf-1"
    assert row["status"] == 0

    result = qm_queue.native_queue.get()

    assert result is not None
    popped_item, task_id = result
    assert popped_item[1] == "prompt-abc-123"

    row_after = qm_queue.qm_db.read_single(
        "SELECT status FROM queue WHERE prompt_id = ?",
        ("prompt-abc-123",),
    )
    assert row_after["status"] == 1


def test_queue_put_upsert_preserves_row_id_and_meta(qm_queue):
    item = _make_item(100, "prompt-xyz-789", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)

    first_row = qm_queue.qm_db.read_single(
        "SELECT id FROM queue WHERE prompt_id = ?",
        ("prompt-xyz-789",),
    )
    first_id = first_row["id"]

    qm_queue.qm_db.write_query(
        "INSERT INTO meta (item_id, key, value) VALUES (?, 'execution_time', '1.23')",
        (first_id,),
    )

    meta_count_before = qm_queue.qm_db.read_single(
        "SELECT COUNT(*) as count FROM meta WHERE item_id = ?",
        (first_id,),
    )["count"]
    assert meta_count_before == 1

    item2 = _make_item(50, "prompt-xyz-789", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item2)

    second_row = qm_queue.qm_db.read_single(
        "SELECT id FROM queue WHERE prompt_id = ?",
        ("prompt-xyz-789",),
    )
    second_id = second_row["id"]

    assert first_id == second_id

    meta_count_after = qm_queue.qm_db.read_single(
        "SELECT COUNT(*) as count FROM meta WHERE item_id = ?",
        (first_id,),
    )["count"]
    assert meta_count_after == 1


def test_queue_put_ignores_resubmission_of_running_item(qm_queue):
    item = _make_item(100, "prompt-running-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    qm_queue.native_queue.get()

    row_running = qm_queue.qm_db.read_single(
        "SELECT id, number, status FROM queue WHERE prompt_id = ?",
        ("prompt-running-1",),
    )
    assert row_running["status"] == 1

    resubmit = _make_item(200, "prompt-running-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(resubmit)

    row_after = qm_queue.qm_db.read_single(
        "SELECT id, number, status FROM queue WHERE prompt_id = ?",
        ("prompt-running-1",),
    )
    assert row_after["id"] == row_running["id"]
    assert row_after["status"] == 1
    assert row_after["number"] == row_running["number"]


def test_higher_priority_item_dequeues_before_earlier_queued_items(qm_queue):
    for number, prompt_id, priority in ((1, "prompt-low-1", 0), (2, "prompt-high", 1), (3, "prompt-low-2", 0)):
        item = _make_item(number, prompt_id, "Workflow A", "wf-a")
        item[3]["qm_priority"] = priority
        qm_queue.native_queue.put(item)

    dequeued = [qm_queue.native_queue.get()[0][1] for _ in range(3)]

    assert dequeued == ["prompt-high", "prompt-low-1", "prompt-low-2"]


def test_queue_put_preempts_prefetched_lower_priority_item(qm_queue):
    prefetched = _make_item(10, "prompt-prefetched", "Workflow A", "wf-a")
    qm_queue.native_queue.put(prefetched)
    assert [heap_item[1] for heap_item in qm_queue.native_queue.queue] == ["prompt-prefetched"]

    urgent = _make_item(11, "prompt-urgent", "Workflow A", "wf-a")
    urgent[3]["qm_priority"] = 1
    qm_queue.native_queue.put(urgent)

    assert [heap_item[1] for heap_item in qm_queue.native_queue.queue] == ["prompt-urgent"]

    row = qm_queue.qm_db.read_single(
        "SELECT priority, prompt FROM queue WHERE prompt_id = ?",
        ("prompt-urgent",),
    )
    assert row["priority"] == 1
    assert "qm_priority" not in row["prompt"]

    assert qm_queue.native_queue.get()[0][1] == "prompt-urgent"
    assert qm_queue.native_queue.get()[0][1] == "prompt-prefetched"


def test_task_done_dedupes_meta_on_repeat_completion(qm_queue):
    history_result = {
        "outputs": {
            "9": {
                "images": [{"filename": "out.png", "subfolder": "", "type": "output"}],
            }
        }
    }
    status = (
        "success",
        None,
        [
            ("execution_start", {"timestamp": 1000}),
            ("execution_success", {"timestamp": 2000}),
        ],
    )

    item = _make_item(100, "prompt-repeat-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    _, task_id = qm_queue.native_queue.get()
    qm_queue.qm.task_done(task_id, history_result, status)

    db_id = qm_queue.qm_db.read_single(
        "SELECT id FROM queue WHERE prompt_id = ?",
        ("prompt-repeat-1",),
    )["id"]

    resubmit = _make_item(50, "prompt-repeat-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(resubmit)
    _, task_id2 = qm_queue.native_queue.get()
    qm_queue.qm.task_done(task_id2, history_result, status)

    outputs_count = qm_queue.qm_db.read_single(
        "SELECT COUNT(*) as count FROM meta WHERE item_id = ? AND key = 'outputs'",
        (db_id,),
    )["count"]
    exec_time_count = qm_queue.qm_db.read_single(
        "SELECT COUNT(*) as count FROM meta WHERE item_id = ? AND key = 'execution_time'",
        (db_id,),
    )["count"]

    assert outputs_count == 1
    assert exec_time_count == 1


def test_task_done_records_node_error(qm_queue):
    history_result = {"outputs": {}}
    status = (
        "error",
        False,
        [
            ("execution_start", {"timestamp": 1000}),
            (
                "execution_error",
                {
                    "prompt_id": "prompt-error-1",
                    "node_id": "7",
                    "node_type": "KSampler",
                    "executed": [],
                    "exception_message": "CUDA out of memory",
                    "exception_type": "RuntimeError",
                    "traceback": ["line 1", "line 2"],
                    "current_inputs": {},
                    "current_outputs": [],
                },
            ),
        ],
    )

    item = _make_item(100, "prompt-error-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    _, task_id = qm_queue.native_queue.get()
    qm_queue.qm.task_done(task_id, history_result, status)

    row = qm_queue.qm_db.read_single(
        "SELECT id, status FROM queue WHERE prompt_id = ?",
        ("prompt-error-1",),
    )
    assert row["status"] == -1

    meta_row = qm_queue.qm_db.read_single(
        "SELECT value FROM meta WHERE item_id = ? AND key = 'error'",
        (row["id"],),
    )
    assert meta_row is not None
    error_meta = json.loads(meta_row["value"])
    assert error_meta["kind"] == "error"
    assert error_meta["message"] == "CUDA out of memory"
    assert error_meta["node_id"] == "7"
    assert error_meta["node_type"] == "KSampler"
    assert error_meta["traceback"] == ["line 1", "line 2"]


def test_task_done_records_interruption(qm_queue):
    history_result = {"outputs": {}}
    status = (
        "error",
        False,
        [
            ("execution_start", {"timestamp": 1000}),
            (
                "execution_interrupted",
                {
                    "prompt_id": "prompt-interrupted-1",
                    "node_id": "3",
                    "node_type": "KSampler",
                    "executed": [],
                },
            ),
        ],
    )

    item = _make_item(100, "prompt-interrupted-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    _, task_id = qm_queue.native_queue.get()
    qm_queue.qm.task_done(task_id, history_result, status)

    row = qm_queue.qm_db.read_single(
        "SELECT id, status FROM queue WHERE prompt_id = ?",
        ("prompt-interrupted-1",),
    )
    assert row["status"] == -1

    meta_row = qm_queue.qm_db.read_single(
        "SELECT value FROM meta WHERE item_id = ? AND key = 'error'",
        (row["id"],),
    )
    assert meta_row is not None
    error_meta = json.loads(meta_row["value"])
    assert error_meta["kind"] == "interrupted"
    assert error_meta["node_id"] == "3"
    assert error_meta["node_type"] == "KSampler"
    assert error_meta["message"] is None
    assert error_meta["traceback"] is None


def test_get_current_queue_completed_route_includes_errored_job(qm_queue):
    history_result = {"outputs": {}}
    status = (
        "error",
        False,
        [
            ("execution_start", {"timestamp": 1000}),
            (
                "execution_error",
                {
                    "prompt_id": "prompt-completed-error-1",
                    "node_id": "7",
                    "node_type": "KSampler",
                    "executed": [],
                    "exception_message": "CUDA out of memory",
                    "exception_type": "RuntimeError",
                    "traceback": ["line 1", "line 2"],
                    "current_inputs": {},
                    "current_outputs": [],
                },
            ),
        ],
    )

    item = _make_item(100, "prompt-completed-error-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    _, task_id = qm_queue.native_queue.get()
    qm_queue.qm.task_done(task_id, history_result, status)

    success_item = _make_item(100, "prompt-completed-success-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(success_item)
    qm_queue.qm_db.write_query("UPDATE queue SET status = 2 WHERE prompt_id = ?", ("prompt-completed-success-1",))

    _, completed = qm_queue.qm.get_current_queue(page_size=20, route="completed")

    by_prompt_id = {row[1]: row for row in completed}

    errored = by_prompt_id["prompt-completed-error-1"]
    assert errored[3]["status"] == -1
    assert errored[3]["error"]["kind"] == "error"
    assert errored[3]["error"]["message"] == "CUDA out of memory"
    assert errored[3]["error"]["node_id"] == "7"
    assert errored[3]["error"]["node_type"] == "KSampler"
    assert errored[3]["error"]["traceback"] == ["line 1", "line 2"]

    succeeded = by_prompt_id["prompt-completed-success-1"]
    assert succeeded[3]["status"] == 2
    assert succeeded[3]["error"] is None


def test_task_done_clears_stale_error_meta_on_successful_resubmission(qm_queue):
    error_history_result = {"outputs": {}}
    error_status = (
        "error",
        False,
        [
            ("execution_start", {"timestamp": 1000}),
            (
                "execution_error",
                {
                    "prompt_id": "prompt-retry-1",
                    "node_id": "7",
                    "node_type": "KSampler",
                    "executed": [],
                    "exception_message": "CUDA out of memory",
                    "exception_type": "RuntimeError",
                    "traceback": ["line 1", "line 2"],
                    "current_inputs": {},
                    "current_outputs": [],
                },
            ),
        ],
    )

    item = _make_item(100, "prompt-retry-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    _, task_id = qm_queue.native_queue.get()
    qm_queue.qm.task_done(task_id, error_history_result, error_status)

    row = qm_queue.qm_db.read_single("SELECT status FROM queue WHERE prompt_id = ?", ("prompt-retry-1",))
    assert row["status"] == -1

    success_history_result = {
        "outputs": {
            "9": {"images": [{"filename": "out.png", "subfolder": "", "type": "output"}]},
        }
    }
    success_status = (
        "success",
        None,
        [
            ("execution_start", {"timestamp": 1000}),
            ("execution_success", {"timestamp": 2000}),
        ],
    )

    resubmit = _make_item(50, "prompt-retry-1", "Workflow A", "wf-a")
    qm_queue.native_queue.put(resubmit)
    _, task_id2 = qm_queue.native_queue.get()
    qm_queue.qm.task_done(task_id2, success_history_result, success_status)

    _, completed = qm_queue.qm.get_current_queue(page_size=20, route="completed")
    by_prompt_id = {row[1]: row for row in completed}
    retried = by_prompt_id["prompt-retry-1"]
    assert retried[3]["status"] == 2
    assert retried[3]["error"] is None


def test_queue_put_exposes_card_metadata_on_pending_item(qm_queue):
    item = _make_item(100, "prompt-card-pending", "Workflow Card", "wf-card")
    item[2] = _card_graph()

    qm_queue.native_queue.put(item)
    running, pending = qm_queue.qm.get_current_queue(page_size=20)

    assert running == []
    assert pending[0][3]["card"] == [
        {"index": 2, "label": "summary", "kind": "text", "value": "card value"}
    ]


@pytest.mark.parametrize("value", [[1, 2], ["literal", "text"], [["nested"], 0], [{"nested": 1}, 0]])
def test_queue_put_accepts_literal_lists_in_card(qm_queue, value):
    item = _make_item(100, "literal-card", "Workflow", "wf")
    item[2] = _card_graph(value)

    qm_queue.native_queue.put(item)

    _, pending = qm_queue.qm.get_current_queue(page_size=20)
    assert pending[0][3]["card"][0]["value"] == str(value)


@pytest.mark.parametrize("status", [0, 3])
def test_import_queue_extracts_cards_only_for_successfully_inserted_items(qm_queue, status):
    existing = _make_item(1, "existing", "Workflow", "wf")
    existing[2] = _card_graph("preserve")
    qm_queue.native_queue.put(existing)
    duplicate = _make_item(2, "existing", "Workflow", "wf")
    duplicate[2] = _card_graph("discard")
    imported = _make_item(3, "imported", "Workflow", "wf")
    imported[2] = _card_graph("imported value")
    repeated = _make_item(4, "imported", "Workflow", "wf")
    repeated[2] = _card_graph("discard duplicate")

    assert qm_queue.qm.import_queue([duplicate, imported, repeated], client_id="client", status=status) == (1, 3)

    rows = qm_queue.qm_db.read_query("SELECT queue.prompt_id, queue.status, meta.value FROM queue JOIN meta ON meta.item_id = queue.id WHERE meta.key = 'card'")
    import json

    cards = {row[0]: (row[1], json.loads(row[2])) for row in rows}
    assert cards["existing"][1][0]["value"] == "preserve"
    assert cards["imported"] == (status, [{"index": 2, "label": "summary", "kind": "text", "value": "imported value"}])
    messages = len(qm_queue.server.messages)
    assert qm_queue.qm.import_queue([duplicate], status=status) == (0, 1)
    assert len(qm_queue.server.messages) == messages


def test_get_current_queue_exposes_card_on_archive_and_completed_items(qm_queue):
    item = _make_item(100, "prompt-card-routes", "Workflow Card", "wf-card")
    item[2] = _card_graph("all routes")
    qm_queue.native_queue.put(item)

    qm_queue.qm_db.write_query("UPDATE queue SET status = 3 WHERE prompt_id = ?", (item[1],))
    _, archived = qm_queue.qm.get_current_queue(page_size=20, route="archive")
    assert archived[0][3]["card"][0]["value"] == "all routes"

    qm_queue.qm_db.write_query("UPDATE queue SET status = 2 WHERE prompt_id = ?", (item[1],))
    _, completed = qm_queue.qm.get_current_queue(page_size=20, route="completed")
    assert completed[0][3]["card"][0]["value"] == "all routes"


def test_get_current_queue_uses_one_legacy_duplicate_card_row(qm_queue):
    item = _make_item(100, "prompt-card-duplicate", "Workflow Card", "wf-card")
    qm_queue.native_queue.put(item)
    db_id = qm_queue.qm_db.read_single("SELECT id FROM queue WHERE prompt_id = ?", (item[1],))["id"]
    qm_queue.qm_db.write_query(
        "INSERT INTO meta (item_id, key, value) VALUES (?, 'card', ?)",
        (db_id, '[{"index": 1, "label": "", "kind": "text", "value": "older"}]'),
    )
    qm_queue.qm_db.write_query(
        "INSERT INTO meta (item_id, key, value) VALUES (?, 'card', ?)",
        (db_id, '[{"index": 1, "label": "", "kind": "text", "value": "newer"}]'),
    )

    _, pending = qm_queue.qm.get_current_queue(page_size=20)

    assert len(pending) == 1
    assert pending[0][3]["card"][0]["value"] == "newer"


def test_running_card_metadata_does_not_mutate_native_item(qm_queue):
    item = _make_item(100, "prompt-card-running", "Workflow Card", "wf-card")
    item[2] = _card_graph("running")
    qm_queue.native_queue.put(item)
    popped_item, task_id = qm_queue.native_queue.get()
    native_extra_data = popped_item[3]

    running, pending = qm_queue.qm.get_current_queue(page_size=20)

    assert pending == []
    assert running[0][3]["card"][0]["value"] == "running"
    assert running[0][3] is not native_extra_data
    assert "card" not in native_extra_data


def test_queue_put_without_card_entries_preserves_existing_card(qm_queue):
    item = _make_item(100, "prompt-card-preserved", "Workflow Card", "wf-card")
    item[2] = _card_graph("original")
    qm_queue.native_queue.put(item)

    resubmitted = _make_item(50, item[1], "Workflow Card", "wf-card")
    qm_queue.native_queue.put(resubmitted)
    _, pending = qm_queue.qm.get_current_queue(page_size=20)

    assert pending[0][3]["card"][0]["value"] == "original"


def test_deletion_paths_remove_only_their_card_images(qm_queue, monkeypatch, tmp_path):
    import src.comfyui_queue_manager.qm_card as qm_card_module

    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()
    monkeypatch.setattr(qm_card_module, "CARDS_DIR", cards_dir)
    rows = [
        ("explicit_1", 0),
        ("explicit", 2),
        ("wipe_pending", 0),
        ("archived_prompt", 3),
    ]
    for prompt_id, status in rows:
        qm_queue.qm_db.write_query(
            "INSERT INTO queue (prompt_id, prompt, status) VALUES (?, '[]', ?)",
            (prompt_id, status),
        )
        (cards_dir / qm_card_module._card_image_name(prompt_id, 1)).write_bytes(b"png")

    assert qm_queue.qm.delete_items(["explicit_1", "missing"]) is None
    assert not (cards_dir / qm_card_module._card_image_name("explicit_1", 1)).exists()
    assert (cards_dir / qm_card_module._card_image_name("explicit", 1)).is_file()

    assert qm_queue.qm.wipe_queue() is None
    assert not (cards_dir / qm_card_module._card_image_name("wipe_pending", 1)).exists()
    assert qm_queue.qm.delete_from_queue("archive") == 1
    assert not (cards_dir / qm_card_module._card_image_name("archived_prompt", 1)).exists()
    assert (cards_dir / qm_card_module._card_image_name("explicit", 1)).is_file()


def test_delete_running_job_marks_pending_delete_and_interrupts(qm_queue):
    import nodes as nodes_module

    item = _make_item(100, "prompt-delete-running", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    qm_queue.native_queue.get()

    calls_before = len(nodes_module.interrupt_calls)

    assert qm_queue.qm.delete_running_job("prompt-delete-running") == 1
    assert "prompt-delete-running" in qm_queue.qm.pending_delete
    assert len(nodes_module.interrupt_calls) == calls_before + 1

    row = qm_queue.qm_db.read_single(
        "SELECT status FROM queue WHERE prompt_id = ?",
        ("prompt-delete-running",),
    )
    assert row["status"] == 1


def test_delete_running_job_does_not_interrupt_when_no_match(qm_queue):
    import nodes as nodes_module

    item = _make_item(100, "prompt-already-done", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    qm_queue.native_queue.get()
    qm_queue.qm_db.write_query("UPDATE queue SET status = 2 WHERE prompt_id = ?", ("prompt-already-done",))

    calls_before = len(nodes_module.interrupt_calls)

    assert qm_queue.qm.delete_running_job("prompt-already-done") == 0
    assert "prompt-already-done" not in qm_queue.qm.pending_delete
    assert len(nodes_module.interrupt_calls) == calls_before

    assert qm_queue.qm.delete_running_job("prompt-does-not-exist") == 0
    assert len(nodes_module.interrupt_calls) == calls_before


def test_task_done_pending_delete_forwards_process_item(qm_queue):
    item = _make_item(100, "prompt-sensitive-delete", "Workflow A", "wf-a")
    item.append({"api_key_comfy_org": "secret-key"})
    qm_queue.native_queue.put(item)
    _, task_id = qm_queue.native_queue.get()

    native_item = qm_queue.native_queue.currently_running[task_id]
    assert len(native_item) == 6
    assert native_item[5] == {"api_key_comfy_org": "secret-key"}

    assert qm_queue.qm.delete_running_job("prompt-sensitive-delete") == 1

    captured = {}

    def spy_original_task_done(item_id, history_result, status, process_item=None):
        captured["item_id"] = item_id
        captured["process_item"] = process_item
        if process_item is not None:
            captured["stripped"] = process_item(native_item)

    qm_queue.qm.original_task_done = spy_original_task_done

    def remove_sensitive(prompt):
        return prompt[:5] + prompt[6:]

    qm_queue.qm.task_done(task_id, {"outputs": {}}, None, remove_sensitive)

    assert captured["item_id"] == task_id
    assert captured["process_item"] is remove_sensitive
    assert captured["stripped"] == native_item[:5]
    assert "api_key_comfy_org" not in json.dumps(captured["stripped"])


def test_task_done_deletes_row_for_job_marked_pending_delete(qm_queue, monkeypatch, tmp_path):
    import src.comfyui_queue_manager.qm_card as qm_card_module

    cards_dir = tmp_path / "cards"
    cards_dir.mkdir()
    monkeypatch.setattr(qm_card_module, "CARDS_DIR", cards_dir)

    item = _make_item(100, "prompt-delete-flow", "Workflow A", "wf-a")
    qm_queue.native_queue.put(item)
    (cards_dir / qm_card_module._card_image_name("prompt-delete-flow", 1)).write_bytes(b"png")
    _, task_id = qm_queue.native_queue.get()

    assert qm_queue.qm.delete_running_job("prompt-delete-flow") == 1

    status = (
        "error",
        False,
        [
            ("execution_start", {"timestamp": 1000}),
            (
                "execution_interrupted",
                {
                    "prompt_id": "prompt-delete-flow",
                    "node_id": "3",
                    "node_type": "KSampler",
                    "executed": [],
                },
            ),
        ],
    )
    qm_queue.qm.task_done(task_id, {"outputs": {}}, status)

    row = qm_queue.qm_db.read_single(
        "SELECT id FROM queue WHERE prompt_id = ?",
        ("prompt-delete-flow",),
    )
    assert row is None
    assert "prompt-delete-flow" not in qm_queue.qm.pending_delete
    assert not (cards_dir / qm_card_module._card_image_name("prompt-delete-flow", 1)).exists()
    assert task_id not in qm_queue.native_queue.currently_running
