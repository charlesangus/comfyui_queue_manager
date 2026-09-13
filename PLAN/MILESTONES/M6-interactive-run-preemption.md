# Milestone 6: Interactive runs preempt the queue

When the user runs a single node / partial workflow from the ComfyUI canvas (the frontend's
partial-execution path), that prompt should not wait behind background queue work. A new setting
`QueueManager.Basic.InteractiveRunMode` offers:

- **Off** — no special handling.
- **Front of queue** (default) — the interactive prompt is stored with `PRIORITY_INTERACTIVE`
  (1000, reserved in M5) so it runs as soon as the current job finishes, ahead of every pending
  job; it also runs even while the queue is paused.
- **Interrupt and requeue** — as above, plus: if a background job is running, it is interrupted
  immediately and re-queued right behind the interactive prompt (`PRIORITY_PREEMPTED` = 999,
  front-of-level `number`), so the order becomes interactive → interrupted job → the rest. The
  interrupted job loses its in-flight progress, although ComfyUI's node cache typically lets it
  skip nodes that already completed when it re-runs.

The frontend marks an interactive prompt by stamping `qm_interactive: "<mode>"` on the workflow
object it already stamps `workflow_name` onto; the backend reads and **strips** the stamp in
`queue_put` before the prompt is stored or executed (so it never reaches saved PNG metadata).
The backend interrupts by calling `nodes.interrupt_processing()` directly (the same call M9's
`delete_running_job` uses) so the requeue is decided in `task_done` before M9's error/interrupted
handling sees the job.

## Phase 6.1: Frontend hook and setting

- [x] M6.P1.T1 — Setting and `queuePrompt` hook that stamps interactive prompts
  - files: `web/js/settings.js`, `web/js/functions.js`, `web/queue-manager.js`
  - approach: Add to `settings.js` a combo `QueueManager.Basic.InteractiveRunMode` with options
    `Off`, `Front of queue`, `Interrupt and requeue`, default `Front of queue`, and a tooltip
    stating the trade-off above (no iframe relay needed — it is read on the parent page).
    Rename `injectWorkflowName()` to `hookQueuePrompt()` (update the call in
    `web/queue-manager.js`). Inside the wrapper, after stamping `workflow_name`, detect a partial
    execution: `Array.isArray(data.partialExecutionTargets) && data.partialExecutionTargets.
    length > 0` (verified in frontend 1.51.10: `api.queuePrompt` sends
    `partial_execution_targets: n.partialExecutionTargets`; `~/ComfyUI/server.py` reads it at
    `post_prompt`). When it is a partial
    execution and the setting is not `Off`, set `data.workflow.qm_interactive = "front" |
    "interrupt"`. Read the setting with `app.extensionManager.setting.get(id)`.
  - verify: With the setting on `Front of queue`, running a single output node in ComfyUI sends a
    `/prompt` body whose `extra_data.extra_pnginfo.workflow.qm_interactive === "front"` (check in
    the browser network tab); a full Run sends no stamp.
  - size: S

## Phase 6.2: Backend

- [x] M6.P2.T1 — `queue_put` honours the stamp: reserved priority, strip, notify
  - files: `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: At the top of the DB branch of `queue_put`, `mode = item[3]["extra_pnginfo"]
    ["workflow"].pop("qm_interactive", None)` (mutating the dict in place is what strips it from
    the tuple the executor will run and from the JSON stored). If `mode in ("front",
    "interrupt")`, store `priority = PRIORITY_INTERACTIVE` in the INSERT (overriding any
    `qm_priority`), and after the insert call `self.pause_lock.notify()` so a paused `queue_get`
    can re-check (see T3). If `mode == "interrupt"`, call `self.preempt_running()` (T2) before
    the heap logic runs. The M5 heap-outrank logic then guarantees the interactive item is
    next. Test: a stamped put stores priority 1000, the stored `prompt` JSON and the tuple in
    the fake heap carry no `qm_interactive` key.
  - verify: `pytest tests/test_qm_queue.py` passes; `ruff check .` passes.
  - size: S

- [ ] M6.P2.T2 — `preempt_running()` and requeue in `task_done`
  - files: `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`, `tests/fake_comfy.py`
  - approach: `self.preempted = None` in `__init__`. `preempt_running()` (called under the
    mutex): take the first item of `self.native_queue.currently_running.values()`; if none, or
    if its row's priority is `>= PRIORITY_PREEMPTED` (an interactive/preempted job is running —
    never interrupt those), return. Otherwise `PromptServer.instance.number += 1`, set
    `self.preempted = {"prompt_id": item[1], "number": -PromptServer.instance.number}`, log,
    and call `nodes.interrupt_processing()` (the import and the recording stub in
    `tests/fake_comfy.py` exist since M9). In `task_done`, right after resolving `prompt_id` and
    **before** M9's pending-delete and error handling: if `self.preempted` matches, `UPDATE queue
    SET status = 0, number = ?, priority = ? WHERE prompt_id = ?` with the reserved number and
    `PRIORITY_PREEMPTED`, skip the outputs/execution-time persistence, clear `self.preempted`,
    `send_sync("queue-manager-queue-updated", {"requeued": prompt_id})` and `queue_updated()`,
    then call `original_task_done` (respecting the `process_item` signature branch) and return.
    If the job is also in M9's `pending_delete` (user deleted it meanwhile), the delete wins.
    Also make `play_items`/`play_archive` reset reserved priorities (`priority > PRIORITY_MAX`)
    to 0 so a re-run of an old interactive job is ordinary. Test the full sequence with the
    fixture: running job → interactive put with `mode="interrupt"` → `interrupt_processing`
    recorded → `task_done` for the running job leaves it `status = 0`, `priority = 999`,
    negative number, no `meta` rows → next two `queue_get` calls return the interactive item
    then the requeued one.
  - verify: `pytest tests/test_qm_queue.py` passes; `ruff check .` passes.
  - size: M

- [ ] M6.P2.T3 — Interactive prompts run while the queue is paused
  - files: `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: In `queue_get`'s `while self.paused:` loop, before waiting, check
    `read_single("SELECT 1 FROM queue WHERE status = 0 AND priority >= ? LIMIT 1",
    (PRIORITY_INTERACTIVE,))`; if a row exists, break out of the loop for this call (the queue
    stays paused; the empty-heap branch then pulls that row because it has the highest
    priority). Only `PRIORITY_INTERACTIVE` bypasses the pause — a preempted job (999) waits
    like everything else. Test: paused queue, one ordinary pending item, then an interactive
    put → `queue_get(timeout=0.2)` returns the interactive item; a second call returns `None`.
  - verify: `pytest tests/test_qm_queue.py` passes; `ruff check .` passes.
  - size: S

## Phase 6.3: Frontend polish, docs, release

- [ ] M6.P3.T1 — Card badges for reserved priorities and changelog/README
  - files: `src/gui/app/components/QueueCard.jsx`, `web/.gui/**`, `README.md`, `CHANGELOG.md`
  - approach: The M5 badge shows `+1000`/`+999` for reserved values; map `1000` → "Interactive"
    and `999` → "Resumed" (with tooltips explaining each). `npm run build`; commit `web/.gui/`.
    README: new manual section "Interactive runs" describing the three modes, the lost-progress
    caveat, the pause bypass, and how the requeued job is ordered; TOC entry; changelog entry.
  - verify: Badges render for both values in `npm run dev` (feed a fake item); README section
    present; rebuilt bundle in `git status`.
  - size: S

- [ ] M6.P3.T2 — End-to-end check in a ComfyUI instance
  - files: none (verification only; fixes go in the file they belong to and are noted in `## Decisions`)
  - approach: Queue three slow background jobs. (a) `Front of queue`: run a single output node
    on the canvas → it starts as soon as the running job ends, before the two pending jobs.
    (b) `Interrupt and requeue`: run a single node → the running job is interrupted, the node
    runs, the interrupted job restarts (card shows "Resumed") before the two pending jobs.
    (c) Pause the queue, run a single node → it runs; the queue stays paused afterwards.
    (d) `Off`: a single-node run waits its turn as before.
  - verify: All four scenarios behave as described; no orphan `status = 1` rows remain in
    `data/qm-queue.db` afterwards.
  - size: S

**Verification gate:** `pytest tests/` (including the preemption and pause-bypass tests) and
`ruff check .` green; `npm run build` green with the rebuilt bundle committed; the four
end-to-end scenarios in M6.P3.T2 pass.

## Decisions

- 2026-09-11 — Both modes shipped behind a setting, default "Front of queue" (user's call): the
  interrupt mode discards in-flight work, so it is opt-in.
- 2026-09-11 — The interactive marker travels as a key on the workflow object (the same channel
  `workflow_name` uses) and is stripped server-side in `queue_put`, instead of a separate
  "expect an interactive prompt" endpoint: it is deterministic per prompt and has no race with
  other prompts arriving in between.
- 2026-09-11 — Interrupt goes through `nodes.interrupt_processing()` directly rather than an
  HTTP round-trip to `/api/interrupt`, keeping the preempt bookkeeping and the interrupt under one
  mutex acquisition.
