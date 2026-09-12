# Milestone 1: Groundwork: green test suite and build

Make the verification gates of the later milestones meaningful: the shipped test module imports a
node that no longer exists, so `pytest tests/` fails on every PR today; and the GUI build has never
been run in this workspace. Also establish a test harness that stubs `server.PromptServer` so the
backend can be unit-tested without a ComfyUI install.

## Phase 1.1: Tests

- [x] M1.P1.T1 — Replace the stale `Example` node test with tests for the `WorkflowName` node
  - files: `tests/test_comfyui_queue_manager.py`, `tests/conftest.py`
  - approach: In `tests/conftest.py`, before any package import, install a stub `server` module
    into `sys.modules` exposing a `PromptServer` class with a class attribute `instance` whose
    `prompt_queue.currently_running` is a plain dict (so `nodes.py`'s `from server import
    PromptServer` works without ComfyUI). Rewrite the test module to import `WorkflowName` from
    `src.comfyui_queue_manager.nodes`, assert `RETURN_TYPES == ("STRING",)`, `CATEGORY ==
    "Queue Manager"`, that `run()` returns `("",)` when nothing is running, and returns the name
    when `currently_running` holds a tuple whose `[3]["extra_pnginfo"]["workflow"]
    ["workflow_name"]` is set. Delete the duplicate `tests/pytest.ini` so `pyproject.toml`'s
    `[tool.pytest.ini_options]` is the only pytest config.
  - verify: `pytest tests/` passes; `ruff check .` passes.
  - size: S

- [x] M1.P1.T2 — Add a sqlite fixture and a first test for `qm_db.init_schema`
  - files: `tests/conftest.py`, `tests/test_qm_db.py`, `src/comfyui_queue_manager/qm_db.py`
  - approach: `qm_db.py` hard-codes the DB path at module level (`data/qm-queue.db`). Make the
    path overridable via an environment variable `QM_DB_PATH` read at import (default unchanged),
    and add a pytest fixture `qm_db(tmp_path, monkeypatch)` that sets it to a temp file, reloads
    `qm_db`, calls `init_schema()`, and yields the module. Test that tables `queue`, `meta`,
    `options` exist and that `write_query`/`read_single` round-trip a row. This fixture is what
    M3/M5/M6 backend tests build on.
  - verify: `pytest tests/` passes and the new test creates no file under `data/`.
  - size: S

- [ ] M1.P1.T3 — Add a fake-ComfyUI fixture that can construct `QM_Queue`
  - files: `tests/conftest.py`, `tests/fake_comfy.py` (new), `tests/test_qm_queue.py` (new)
  - approach: `qm_queue.py` imports `execution.PromptQueue`, `server.PromptServer`,
    `folder_paths`; `qm_server.py` additionally needs `aiohttp.web`. In `tests/fake_comfy.py`
    build minimal stand-ins: `FakePromptQueue` with `mutex = threading.RLock()`, `queue = []`,
    `currently_running = {}`, `not_empty = threading.Condition(mutex)`, `task_counter = 0`, and
    real-enough `put` (heappush), `get` (heappop or `None`), `task_done` (pop from
    `currently_running`), `get_current_queue`, `get_tasks_remaining` methods;
    `FakePromptServer` with `instance`, `prompt_queue`, `number = 0`, `user_manager.settings.
    get_settings()` returning `{}`, `send_sync()`/`queue_updated()` that append to a `messages`
    list; a `folder_paths` stub with `get_input_directory()/get_output_directory()/
    get_temp_directory()` pointing at `tmp_path`. Extend the `conftest.py` stubbing from T1 to
    register `server`, `execution`, `folder_paths` in `sys.modules` (skipped if a real ComfyUI
    is importable). Add a `qm_queue` fixture that combines the `qm_db` fixture from T2 with a
    fresh `FakePromptServer` and constructs `QM_Queue` with a minimal `queue_manager` object
    whose `.options` is a dict-backed stub with `get(key, default, with_timestamp=False)` /
    `set(key, value)`. First test: `queue_put` with an item carrying
    `extra_pnginfo.workflow` inserts a row and pushes it into the fake heap; `queue_get`
    returns it and marks the row `status = 1`.
  - verify: `pytest tests/test_qm_queue.py` passes without ComfyUI installed.
  - size: M

## Phase 1.2: Build

- [ ] M1.P2.T1 — Confirm the GUI builds reproducibly from a clean checkout and document it
  - files: `src/gui/README.md`, `README.md` (Development section)
  - approach: From `src/gui/`, run `npm install` then `npm run build`; confirm `web/.gui/assets/
    index.js` and `index.css` are regenerated and that `git diff --stat web/.gui` is empty or
    contains only benign ordering changes (if the diff is large, the lockfile/toolchain has
    drifted — record what changed in the milestone `## Decisions`). Write down the exact build
    steps and the "rebuild + commit `web/.gui` with every GUI change" convention in
    `src/gui/README.md` and the README Development section.
  - verify: `npm run build` exits 0; `npm run lint` exits 0 (or its pre-existing failures are
    listed in `## Decisions`); the two READMEs describe the steps.
  - size: S

## Phase 1.3: Small backend fixes

- [ ] M1.P3.T2 — Fix ruff `target-version` so `ruff check .` can run at all
  - files: `pyproject.toml`
  - approach: `[tool.ruff] target-version = "py39"` rejects `qm_queue.py`'s and `qm_server.py`'s
    pre-existing `match`/`case` statements (3.10+ syntax) as `invalid-syntax`, so `ruff check .`
    fails on every commit today regardless of what else changes — discovered while verifying
    M1.P1.T1. CI (`.github/workflows/build-pipeline.yml`) actually runs Python 3.12, so `py39`
    was stale config, not a deliberate supported-version floor. Bump `target-version` to
    `"py312"` to match CI.
  - verify: `ruff check .` no longer reports `invalid-syntax` on the `match` statements (other
    pre-existing findings, if any, are noted here rather than silently fixed).
  - size: S

- [ ] M1.P3.T1 — Replace `INSERT OR REPLACE` in `queue_put` with an upsert that keeps the row id
  - files: `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: `INSERT OR REPLACE INTO queue …` deletes and re-inserts the row when a
    `prompt_id` is submitted twice, which changes `queue.id` and cascade-deletes the row's
    `meta` entries (execution time, outputs — and the card data M3 adds). Change it to
    `INSERT INTO queue (…) VALUES (…) ON CONFLICT(prompt_id) DO UPDATE SET number =
    excluded.number, name = excluded.name, workflow_id = excluded.workflow_id, prompt =
    excluded.prompt, status = 0` (sqlite ≥ 3.24, available on every supported Python). Test:
    put the same prompt twice with a `meta` row attached after the first; the id and the meta
    row survive.
  - verify: `pytest tests/test_qm_queue.py` passes; `ruff check .` passes.
  - size: S

**Verification gate:** `pytest tests/` green, `ruff check .` green, `npm run build` from
`src/gui/` succeeds, rebuilt `web/.gui/` committed.
