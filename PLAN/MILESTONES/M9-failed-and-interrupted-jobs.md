# Milestone 9: Failed and interrupted jobs are kept, not lost

Today a job that errors is marked completed like any other, and a job that is interrupted is
deleted outright by the `/api/interrupt` middleware (`delete_running`). Both make failures
invisible. This milestone uses the status value the schema comments already reserve
(`-1` = error) for jobs that ended with `execution_error` or `execution_interrupted`, stores the
failure details in `meta` (`key = 'error'`), shows them on the completed card, and makes the
Queue Manager's own "delete a running job" explicit so it no longer piggybacks on the native
interrupt route.

## Phase 9.1: Backend

- [ ] M9.P1.T1 — `task_done` records error/interrupted outcomes
  - files: `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: In `task_done`, before the
    `UPDATE … SET status = 2`, inspect `status` (`ExecutionStatus(status_str, completed,
    messages)`): when `status[0] == "error"`, set `status = -1` instead of 2 and write a `meta`
    row `key = 'error'` whose value is JSON `{"kind": "interrupted" | "error", "message": …,
    "node_id": …, "node_type": …, "traceback": [...]}` built from the first
    `execution_interrupted` or `execution_error` event in `status[2]` (payload keys:
    `exception_message`, `exception_type`, `traceback`, `node_id`, `node_type`). Keep the
    existing `outputs` persistence (partial outputs are still useful). Keep this block a single
    well-named branch — M6 later inserts its preemption check immediately before it. Test both
    kinds with the fixture by passing hand-built status tuples.
  - verify: `pytest tests/test_qm_queue.py` passes; `ruff check .` passes.
  - size: S

- [ ] M9.P1.T2 — Explicit "delete running job" endpoint; native interrupt no longer deletes
  - files: `src/comfyui_queue_manager/qm_server.py`, `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`, `tests/fake_comfy.py`, `tests/conftest.py`
  - approach: Add `DELETE /queue_manager/running` accepting `{prompt_id}` (or none for the
    current job): `QM_Queue.delete_running_job(prompt_id)` adds it to `self.pending_delete`
    (a set) and calls `nodes.interrupt_processing()` (`import nodes` at the top of
    `qm_queue.py` next to the other ComfyUI imports; add a recording stub `nodes` module to
    `tests/fake_comfy.py` and register it in `conftest.py`); `task_done` deletes the row (and its
    `meta` via cascade) when the finished `prompt_id` is in `pending_delete`, then discards it.
    In the `post_queue` middleware remove the `/api/interrupt` → `delete_running` branch (keep
    the `/api/queue` clear/delete handling); delete `delete_running` if nothing else calls it.
    Test: interrupt via the native path leaves a `-1` row; the QM endpoint path leaves no row.
  - verify: `pytest tests/` passes; `ruff check .` passes.
  - size: S

- [ ] M9.P1.T3 — Completed route includes failed jobs and exposes the error
  - files: `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: `get_route_query("completed")` → `status IN (2, -1)` (both `include_running`
    variants); in `get_current_queue`'s `completed` branch add `LEFT JOIN meta AS error ON
    queue.id = error.item_id AND error.key = 'error'` and set `item[3]["error"] =
    json.loads(row["error"])` when present, plus `item[3]["status"] = row["status"]` (select
    it). Test that an errored job appears in the completed page with its `error` payload.
  - verify: `pytest tests/` passes; `ruff check .` passes.
  - size: S

## Phase 9.2: Frontend

- [ ] M9.P2.T1 — Cards show failure state; running-job delete uses the new endpoint
  - files: `src/gui/app/components/QueueCard.jsx`, `src/gui/styles/_queue.scss`, `src/gui/app/internals/functions.js`
  - approach: When `item[3].error` is present, the card gets a `.failed` class, a header badge
    "Interrupted" or "Error" (`kind`), and a collapsible `.error-details` block showing
    `message`, `node_type #node_id`, and the traceback in a `<pre>` (collapsed by default,
    toggle on click). Replace every frontend call of `api/interrupt` for running items (the
    card's `cancelQueueItem` in M2's form, or the selection bar's Delete if M4 has landed) with
    `apiCall("queue_manager/running", { prompt_id }, "DELETE")` via a shared
    `deleteRunningJob(promptId)` helper in `internals/functions.js`.
  - verify: In `npm run dev` against ComfyUI: a workflow with a deliberately failing node shows
    an "Error" card in Completed with the message; pressing ComfyUI's native Stop shows an
    "Interrupted" card; deleting a running job from the Queue Manager leaves nothing behind.
  - size: M

- [ ] M9.P2.T2 — Docs, changelog, release build
  - files: `README.md`, `CHANGELOG.md`, `web/.gui/**`
  - approach: README manual: add "Failed and interrupted jobs" (what shows in Completed, how
    to re-run via Load or Run, how deleting a running job differs from native Stop); update
    the Troubleshooting section if it mentions vanished jobs. Changelog entry. `npm run
    build`; commit `web/.gui/`.
  - verify: README section present; rebuilt bundle in `git status`.
  - size: S

**Verification gate:** `pytest tests/` (error, interrupted, pending-delete paths) and `ruff check
.` green; `npm run build`/`npm run lint`/`npm test` green; the three manual scenarios in
M9.P2.T1 pass; rebuilt `web/.gui/` committed.

## Decisions

- 2026-09-11 — Native Stop/interrupt keeps the job as "Interrupted" in Completed; only the
  Queue Manager's own delete action removes a running job. Rationale: the native button is
  "stop what you're doing", not "forget it"; the extension's Delete is explicit.
- 2026-09-11 — No separate "Bin" yet: failed jobs land in Completed with a badge. A bin can be
  layered on later as another status value without touching this design.
