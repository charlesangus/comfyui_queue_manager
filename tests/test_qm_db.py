#!/usr/bin/env python


def test_init_schema_creates_tables(qm_db):
    conn = qm_db.get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = {row[0] for row in cursor.fetchall()}

    assert "queue" in tables
    assert "meta" in tables
    assert "options" in tables


def test_write_and_read_queue_item(qm_db):
    insert_query = """
        INSERT INTO queue (prompt_id, number, name, workflow_id, prompt, status)
        VALUES (?, ?, ?, ?, ?, ?)
    """
    params = ("test-prompt-001", 1, "Test Job", "workflow-123", "{}", 0)

    qm_db.write_query(insert_query, params)

    read_query = "SELECT id, prompt_id, number, name, workflow_id, status FROM queue WHERE prompt_id = ?"
    result = qm_db.read_single(read_query, ("test-prompt-001",))

    assert result is not None
    assert result["prompt_id"] == "test-prompt-001"
    assert result["number"] == 1
    assert result["name"] == "Test Job"
    assert result["workflow_id"] == "workflow-123"
    assert result["status"] == 0
