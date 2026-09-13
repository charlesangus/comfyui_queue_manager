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


def test_priority_column_migration(tmp_path, monkeypatch):
    import sqlite3
    import importlib

    db_file = tmp_path / "test_migration.db"
    monkeypatch.setenv("QM_DB_PATH", str(db_file))

    conn = sqlite3.connect(str(db_file))
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_id  VARCHAR(255) NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            number     INTEGER,
            name       TEXT,
            workflow_id   VARCHAR(255),
            prompt    TEXT,
            status     INTEGER DEFAULT 0
        )
    """)
    cursor.execute("""
        CREATE TABLE options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE meta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT  NULL,
            key VARCHAR(255) NOT NULL,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES queue(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("CREATE INDEX idx_queue_status_number ON queue(status, number)")
    cursor.execute("CREATE INDEX idx_meta_queue_id ON meta(item_id)")
    conn.commit()
    conn.close()

    insert_query = """
        INSERT INTO queue (prompt_id, number, name, workflow_id, prompt, status)
        VALUES (?, ?, ?, ?, ?, ?)
    """
    old_conn = sqlite3.connect(str(db_file))
    old_conn.execute(insert_query, ("test-prompt-001", 1, "Test Job", "workflow-123", "{}", 0))
    old_conn.commit()
    old_conn.close()

    import comfyui_queue_manager.qm_db
    qm_db = importlib.reload(comfyui_queue_manager.qm_db)

    qm_db.init_schema()

    conn = qm_db.get_conn()
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(queue)")
    columns = {row[1] for row in cursor.fetchall()}
    assert "priority" in columns

    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_queue_status_priority_number'")
    assert cursor.fetchone() is not None

    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_queue_status_number'")
    assert cursor.fetchone() is None

    result = qm_db.read_single("SELECT priority FROM queue WHERE prompt_id = ?", ("test-prompt-001",))
    assert result["priority"] == 0

    qm_db.init_schema()

    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(queue)")
    columns = {row[1] for row in cursor.fetchall()}
    assert "priority" in columns

    result = qm_db.read_single("SELECT priority FROM queue WHERE prompt_id = ?", ("test-prompt-001",))
    assert result["priority"] == 0
