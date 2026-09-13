---
title: Queue Manager upgrades — gallery removal, ComfyUI-native look, rich cards, card-info node, selection, priority, interactive preemption, failure tracking
status: running
current: M9.P2.T2
pm_heartbeat: 2026-09-13T10:05:00-04:00
ship: pr-per-milestone
publish_decisions: docs/decisions/
---

# Goal

The extension is focused purely on queue management: the Gallery lightbox and its thumbnail
modes/settings are gone (completed jobs keep a plain strip of output thumbnails). The Queue
Manager sidebar shows each job as a rich card instead of a table row: the card carries the
workflow name, status, a priority badge, any images/text the workflow "pushed" onto it through a
new **Queue Card Info** node, and — for finished jobs — output thumbnails or the error that
stopped them. Cards can be multi-selected and acted on in bulk (delete,
archive, run, set priority). Jobs have an integer priority the scheduler honours. Running a single
node / partial workflow interactively takes precedence over background queue work — either by
jumping to the front of the queue or (opt-in) by interrupting the running job and re-queuing it.
Failed and interrupted jobs stay visible in Completed instead of vanishing. The panel follows the
user's ComfyUI colour palette and font and reads as a native part of the ComfyUI UI. The frontend is split
into hooks/components with a Vitest suite, and CI runs both the Python and the GUI checks.
Done when every milestone below is merged into `main` on the fork with a release build of the GUI,
`pytest tests/` and `ruff check .` pass, and the README manual documents the new features.

# Context and constraints

- ComfyUI custom-node extension; fork of `QuietNoise/comfyui_queue_manager` at
  `github.com/charlesangus/comfyui_queue_manager` (remote `origin`). Python 3.12 (matches CI's
  `build-pipeline.yml`; ruff `target-version` fixed to match in M1.P3.T2 — was stale `py39`),
  line length 140, double quotes. `ruff check .` and `pytest tests/` run in CI on PRs to `main`.
- **Backend** `src/comfyui_queue_manager/`: `qm_queue.py` (hijacks native `PromptQueue.put/get/
  task_done/get_current_queue/get_tasks_remaining`), `qm_db.py` (sqlite at `data/qm-queue.db`,
  tables `queue`/`meta`/`options`, helpers `write_query/read_query/read_single/write_many`),
  `qm_server.py` (aiohttp routes under `/queue_manager/*` plus a middleware intercepting native
  `POST /api/queue` and `POST /api/interrupt`), `nodes.py` (custom nodes; `Workflow Name` exists),
  `qm_options.py`, `queue_manager.py` (wires the singletons; instance is `queueManager` in the
  package `__init__.py`). `qm_gallery.py` exists until M7 removes it.
- Queue ordering: column `queue.number` ascending; negative numbers = "front of queue" (native
  ComfyUI convention, `PromptServer.instance.number * -1`). Status: 0 pending, 1 running,
  2 completed, 3 archived. The extension keeps **at most one** pending item in the native heap
  (`self.native_queue.queue`) and pulls the next from the DB in `queue_get`.
- **Frontend** is two layers: `web/queue-manager.js` + `web/js/*.js` run inside ComfyUI (register
  the sidebar tab, inject toolbar buttons, wrap `app.api.queuePrompt`, relay websocket events to
  the iframe via `postMessage`), and the React 19 / Vite 7 / MUI 7 / Zustand 5 / Tailwind 4 +
  SCSS app in `src/gui/` that renders inside the iframe. The React app talks to the backend with
  `apiCall()` from `src/gui/app/internals/functions.js` and receives updates as `window` messages
  of type `QM_queueStatusUpdated`, `QM_Setting_Changed`, `QM_ParentKeypress`,
  `QM_QueueManager_Hello`. Queue items are the native tuple shape
  `[number, prompt_id, prompt_graph, extra_data, outputs_to_execute, …]`; the backend adds
  `item[3].db_id`, `.outputs`, `.execution_time`, `.total_files` for the frontend.
- User-facing settings are native ComfyUI settings declared in `web/js/settings.js`
  (`QueueManager.<Group>.<Name>`), read on the parent page via
  `app.extensionManager.setting.get(id)` and relayed to the iframe; server-side options live in
  the `options` table (`qm_options.py`, whitelisted in `qm_server.py`).
- **Build convention:** any change under `src/gui/` must be followed by `npm run build` from
  `src/gui/` (outputs `web/.gui/`, unminified on purpose) and the rebuilt `web/.gui/` committed
  with the change (history uses `- Release build;` commits). `npm install` in `src/gui/` first
  (`node_modules/` is not present in a fresh clone; node 24 is available). Never hand-edit
  `web/.gui/assets/index.js`.
- **Test instance:** ComfyUI v0.35.1 (frontend 1.51.10) at `~/ComfyUI`, CPU only, with this repo
  symlinked into its `custom_nodes/`; start/stop commands and caveats in
  `PLAN/DECISIONS/2026-09-11-local-comfyui-test-instance.md`. Backend logic is still unit-tested
  with the fake-ComfyUI harness (M1); the live instance is for the manual gate checks and for
  reading real ComfyUI internals (`~/ComfyUI/server.py`, `execution.py`, `nodes.py`, and the
  frontend bundle under `~/ComfyUI/.venv/lib/python3.11/site-packages/comfyui_frontend_package/static/`).
- Docs: README "Manual" section documents each feature with screenshots under `readme-img/`; node
  docs live in `web/docs/<Node Name>.md`. Update both when a feature lands. `CHANGELOG.md` gets
  an entry per milestone.
- **Styling (from M10 on):** the iframe receives ComfyUI's live theme variables via a `QM_Theme`
  message and exposes them as `--qm-*` tokens in `src/gui/styles/_variables.scss`; all new UI
  uses those tokens and the `.qm-btn`/`.qm-badge` classes. No hard-coded colours, no
  `prefers-color-scheme`, no bundled fonts. Visual reference is ComfyUI's own sidebar tabs
  and PrimeVue controls.
- No multi-user support is intended (README "Important"); don't design for it.

# Board

| ID | Milestone | Status | File |
|----|-----------|--------|------|
| M1 | Groundwork: green test suite and build | done | [M1-groundwork.md](PLAN/MILESTONES/M1-groundwork.md) |
| M7 | Remove the gallery | done | [M7-remove-gallery.md](PLAN/MILESTONES/M7-remove-gallery.md) |
| M10 | ComfyUI theme bridge and design system | done | [M10-comfyui-theme-bridge-and-design-system.md](PLAN/MILESTONES/M10-comfyui-theme-bridge-and-design-system.md) |
| M2 | Rich queue cards | done | [M2-rich-queue-cards.md](PLAN/MILESTONES/M2-rich-queue-cards.md) |
| M3 | Queue Card Info node | done | [M3-queue-card-info-node.md](PLAN/MILESTONES/M3-queue-card-info-node.md) |
| M8 | Frontend refactor and a JS test runner | done | [M8-frontend-refactor-and-tests.md](PLAN/MILESTONES/M8-frontend-refactor-and-tests.md) |
| M9 | Failed and interrupted jobs are kept | doing | [M9-failed-and-interrupted-jobs.md](PLAN/MILESTONES/M9-failed-and-interrupted-jobs.md) |
| M4 | Card selection and bulk actions | todo | [M4-card-selection-and-bulk-actions.md](PLAN/MILESTONES/M4-card-selection-and-bulk-actions.md) |
| M5 | Job priority levels | todo | [M5-job-priority-levels.md](PLAN/MILESTONES/M5-job-priority-levels.md) |
| M6 | Interactive runs preempt the queue | todo | [M6-interactive-run-preemption.md](PLAN/MILESTONES/M6-interactive-run-preemption.md) |
| M11 | Final visual polish pass | todo | [M11-final-visual-polish.md](PLAN/MILESTONES/M11-final-visual-polish.md) |

Rows are in execution order (IDs are stable; M7–M11 were added after M1–M6 were planned).

# Open questions

- Should the fork's metadata (`pyproject.toml` `[project.urls] Repository`, `[tool.comfy] Icon`
  URL, README links) be repointed from `QuietNoise/...` to `charlesangus/...`? Only matters if the
  fork will be published to the Comfy registry under its own name; left untouched until answered.
- Found during M9's manual verification (not caused by M9, pre-existing): ComfyUI 0.35.1's own
  native `GET /api/jobs` endpoint 500s (`ValueError: too many values to unpack (expected 5)` in
  `comfy_execution/jobs.py:normalize_history_item`) whenever a Queue Manager job sits in native
  history, because the extension has always stored 6-element queue-item tuples (see the
  backwards-compatibility padding in `qm_queue.py`'s `queue_put`/`play_items`) where the native
  Jobs API expects 5. Affects ComfyUI's own native Jobs sidebar, not this extension's panel.
  Worth a fix or an upstream-compat shim at some point; not blocking any current milestone.
- Found during M2's manual verification (not caused by M2, pre-existing): `qm_queue.py`'s
  `queue_get` (~line 472) crashes the `prompt_worker` thread with `KeyError: 'extra_pnginfo'`
  when a prompt is submitted straight to the native `/prompt` endpoint without
  `extra_data.extra_pnginfo.workflow` (e.g. a raw API call, bypassing the ComfyUI graph UI) —
  `queue_put` already handles that case for `original_put` external jobs (qm_queue.py ~line
  349), but `queue_get`'s logging/status-update path assumes every native-heap item has it. Once
  the worker thread dies the whole prompt queue stops processing until ComfyUI is restarted. Fix
  now as a quick patch, or track as a follow-up milestone/task?
