# Milestone 5: Job priority levels

Every job gets an integer `priority` (default 0, user range −100…100). The scheduler picks the
highest priority first and falls back to the existing `number` ordering within a level, so the
current "run at front" (negative `number`) behaviour is preserved inside each level. Priority is
set from the selection bar (presets Low −1 / Normal 0 / High +1 and a custom integer), shown as a
badge on the card, kept across archive/run, and carried through export/import. Two values above
the user range are reserved for M6 (`PRIORITY_INTERACTIVE = 1000`, `PRIORITY_PREEMPTED = 999`).

## Phase 5.1: Backend

- [x] M5.P1.T1 — Schema migration: `queue.priority`
  - files: `src/comfyui_queue_manager/qm_db.py`, `tests/test_qm_db.py`
  - approach: In `init_schema()`, after the `CREATE TABLE IF NOT EXISTS queue`, run a guarded
    migration: if `PRAGMA table_info(queue)` lacks `priority`, `ALTER TABLE queue ADD COLUMN
    priority INTEGER NOT NULL DEFAULT 0`. Replace index `idx_queue_status_number` with
    `idx_queue_status_priority_number ON queue(status, priority DESC, number)` (`DROP INDEX IF
    EXISTS` the old one). Add the column to the `CREATE TABLE` statement too so fresh databases
    get it directly. Test: create a DB with the old schema (copy the pre-change `CREATE TABLE`
    into the test), run `init_schema()` twice, assert the column and index exist and that
    existing rows read back `priority = 0`.
  - verify: `pytest tests/test_qm_db.py` passes; `ruff check .` passes.
  - size: S

- [ ] M5.P1.T2 — Scheduler honours priority (and front-of-queue against the prefetched heap item)
  - files: `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: Define module constants `PRIORITY_MIN = -100`, `PRIORITY_MAX = 100`,
    `PRIORITY_PREEMPTED = 999`, `PRIORITY_INTERACTIVE = 1000`. Change every pending-item pick to
    `ORDER BY priority DESC, number`: the head selection in `queue_put`, the DB pull in
    `queue_get`, the `queue` route in `get_current_queue`, and the "lowest number" lookup in
    `restore_queue` (restored items keep their own priority). Add a helper
    `outranks_heap_head(priority, number) -> bool` that compares against the item currently
    in `self.native_queue.queue` (look up that item's priority by `prompt_id`); in `queue_put`,
    when the heap is non-empty and the new row outranks its head, clear the heap
    (`self.native_queue.queue = []`) and re-pull the best DB row exactly as the empty-heap
    branch does — this also fixes native Shift+Run ("front") being ignored while the extension
    has already prefetched the next item. `queue_put` reads `priority` from
    `item[3].pop("qm_priority", 0)` if the frontend/import supplies it (clamped to the user
    range unless it equals a reserved value) and stores it in the INSERT. Tests: three pending
    rows with priorities 0/1/0 dequeue in order 1, then by number; a new item with priority 1
    put while a priority-0 item sits in the heap runs next.
  - verify: `pytest tests/test_qm_queue.py` passes; `ruff check .` passes.
  - size: M

- [ ] M5.P1.T3 — `POST /queue_manager/priority` endpoint
  - files: `src/comfyui_queue_manager/qm_server.py`, `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: `QM_Queue.set_priority(db_ids, priority)`: validate `priority` is an int in
    `[PRIORITY_MIN, PRIORITY_MAX]` (raise `BadRouteException` from `inc/exceptions.py` so the
    error middleware returns 422), `UPDATE queue SET priority = ? WHERE id IN (...) AND status
    IN (0, 3)` under the mutex, then — if any updated row is pending and the heap is non-empty —
    clear the heap and `not_empty.notify()` as `play_items` does, and `send_sync(
    "queue-manager-queue-updated", {"priority": len(ids)})` + `queue_updated()`. Route handler
    reads `{items: [db_ids], priority: int}` and returns `{"updated": n}`. Test `set_priority`
    directly with the fixture (bad value raises; good value reorders the next `queue_get`).
  - verify: `pytest tests/` passes; `ruff check .` passes.
  - size: S

- [ ] M5.P1.T4 — Priority survives archive/run, export and import
  - files: `src/comfyui_queue_manager/qm_queue.py`, `src/comfyui_queue_manager/qm_server.py`, `tests/test_qm_queue.py`
  - approach: `play_items`/`play_archive`/`archive_items` already leave other columns alone —
    confirm with a test that an archived priority-2 item runs as priority 2. Export:
    `get_full_queue` selects `priority` too and stamps `item[3]["qm_priority"]` on each exported
    item; import: `import_queue` pops `item[3]["qm_priority"]` (default 0, clamped) into the
    INSERT's new `priority` column. Test an export→import round trip keeps the value.
  - verify: `pytest tests/` passes; `ruff check .` passes.
  - size: S

## Phase 5.2: Frontend

- [ ] M5.P2.T1 — Priority badge on cards and "Priority" action on the selection bar
  - files: `src/gui/app/components/QueueCard.jsx`, `src/gui/app/components/SelectionBar.jsx`, `src/gui/app/components/PriorityMenu.jsx` (new), `src/gui/styles/_queue.scss`
  - approach: The backend exposes `item[3].priority` (add it to `get_current_queue`'s item
    decoration in T2 if not already there). `QueueCard` shows a `.priority-badge` in the header
    when `priority !== 0`: `+N`/`−N`, green for positive, grey-blue for negative, `title=
    "Priority N"`. `PriorityMenu` is an MUI `Menu` opened from a **Priority** button on the
    `SelectionBar` (queue and archive routes) with items Low (−1), Normal (0), High (+1) and a
    small numeric `TextField` (−100…100) with Apply; it calls `apiCall("queue_manager/
    priority", {items: dbIds, priority}, "POST")`, then `clear()` + `fetchQueueItems({reload:
    true})`. Running/external cards show no badge and are excluded from the action.
  - verify: In `npm run dev` against ComfyUI: set two pending jobs to High → they move above the
    others in the Queue tab and run first; the badge renders in both themes; lint passes.
  - size: M

- [ ] M5.P2.T2 — Rebuild, docs, changelog
  - files: `web/.gui/**`, `README.md`, `CHANGELOG.md`
  - approach: `npm run build`; commit `web/.gui/`. README: new manual section "Priority"
    (how levels interact with "run at front": front-of-queue orders within a level; presets
    and custom values; export/import carry it) plus TOC entry; changelog entry.
  - verify: README section present; rebuilt bundle in `git status`.
  - size: S

**Verification gate:** `pytest tests/` (including the new ordering tests) and `ruff check .`
green; `npm run build`/`npm run lint` green; manual check in ComfyUI that a High job queued last
runs next and that Shift+Run from the archive still puts an item ahead of others at the same
level; rebuilt `web/.gui/` committed.

## Decisions

- 2026-09-11 — Integer priority with a small user range (−100…100) instead of a fixed enum: the
  user asked for "numeric priority levels"; the UI offers three presets so the common case stays
  one click, and the reserved values 999/1000 give M6 a place above anything a user can set.
- 2026-09-11 — Priority is an ordering key *above* the native `number` rather than a rewrite of
  `number`: keeps "run at front" and crash-restore numbering untouched and makes the migration a
  single added column.
