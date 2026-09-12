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


def test_queue_put_exposes_card_metadata_on_pending_item(qm_queue):
    item = _make_item(100, "prompt-card-pending", "Workflow Card", "wf-card")
    item[2] = _card_graph()

    qm_queue.native_queue.put(item)
    running, pending = qm_queue.qm.get_current_queue(page_size=20)

    assert running == []
    assert pending[0][3]["card"] == [
        {"index": 2, "label": "summary", "kind": "text", "value": "card value"}
    ]


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
