def _make_item(number, prompt_id, workflow_name, workflow_id):
    return [
        number,
        prompt_id,
        {"some": "graph"},
        {"extra_pnginfo": {"workflow": {"workflow_name": workflow_name, "id": workflow_id}}},
        [],
    ]


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
