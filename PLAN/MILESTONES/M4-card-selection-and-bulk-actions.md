# Milestone 4: Card selection and bulk actions

Cards become selectable (click, Ctrl/Cmd-click to toggle, Shift-click for a range, Ctrl/Cmd-A for
the page, Escape to clear) and a selection action bar replaces the per-card Delete/Load/Archive/Run
buttons. The bar shows only the actions valid for the current selection and route, and calls the
existing bulk endpoints (`api/queue {delete}`, `queue_manager/archive`,
`queue_manager/play`, and M9's `DELETE queue_manager/running` for running jobs). Output
thumbnails stay clickable on the card (they open in a new tab). M5 adds a "Priority" action to
this bar.

## Phase 4.1: Selection state

- [x] M4.P1.T1 — Selection store
  - files: `src/gui/app/stores/selectionStore.js` (new), `src/gui/app/stores/selectionStore.test.js` (new), `src/gui/app/index.jsx`
  - approach: Zustand store `useSelectionStore` with `selected` (a `Set` of `db_id`; use
    `item[1]` prompt_id as the key for items without `db_id`, i.e. external jobs), `anchor`
    (last clicked key), and actions `select(key)`, `toggle(key)`, `selectRange(orderedKeys,
    key)` (from `anchor` to `key` inclusive in the given order), `selectAll(orderedKeys)`,
    `clear()`, `retain(keys)` (drop keys no longer present). In `index.jsx`, call `clear()`
    whenever `route` changes or a filter is applied, and `retain(currentKeys)` after every
    successful `fetchQueueItems` so deleted/moved items fall out of the selection.
  - verify: `src/gui/app/stores/selectionStore.test.js` (Vitest, from M8) covers select /
    toggle / range / retain; `npm test` and `npm run lint` pass.
  - size: S

- [x] M4.P1.T2 — Make cards selectable and remove per-card action buttons
  - files: `src/gui/app/components/QueueCard.jsx`, `src/gui/app/components/Queue.jsx`, `src/gui/styles/_queue.scss`
  - approach: `Queue.jsx` computes `orderedKeys` for `running + pending` and passes each card an
    `isSelected` boolean and an `onSelect(event)` handler that maps modifier keys to the store
    actions (Shift → `selectRange`, Ctrl/Meta → `toggle`, plain → `select`). `QueueCard`
    renders `aria-selected` and a `.selected` class, and stops propagation on the
    workflow-name filter button, on output thumbnails and on the M9 error-details toggle so
    those keep their existing click behaviour. Remove the Delete/Load/Archive/Run buttons and the `.card-actions` region
    (keep the `cancelQueueItem`/`loadQueueItem`/... logic out of the card — it moves to T3).
    Include `isSelected` in the memo comparator. Style `.selected` with an accent outline in
    both light and dark themes (see `_variables.scss`/`_mixins.scss`).
  - verify: In `npm run dev`, click/ctrl-click/shift-click select as described across running and
    pending cards; thumbnails still open in a new tab; lint passes.
  - size: M

- [x] M4.P1.T3 — Selection action bar
  - files: `src/gui/app/components/SelectionBar.jsx` (new), `src/gui/app/index.jsx`, `src/gui/styles/_footer.scss`
  - approach: `SelectionBar` renders above the existing footer only when the selection is
    non-empty: "N selected", **Clear**, and the actions valid for the route and composition:
    **Delete** (always; running/external keys go through M9's `deleteRunningJob(promptId)`
    helper one by one, the rest in a single `POST api/queue {delete: [prompt_ids]}` — the bar needs the
    items, so pass `data.running`/`data.pending` from `index.jsx` and resolve keys → items),
    **Load** (exactly one non-external item selected; reuse `msgLoadWorkflow(workflow,
    item[0])`), **Archive** (queue route, only pending items selected; `POST
    queue_manager/archive {archive: [db_ids]}`), **Run** (archive route; `POST
    queue_manager/play {items: [db_ids], front: shiftDown, clientId}` — show the existing
    "run at front" indicator when Shift is held, as `index.jsx` does for Run All). After each
    action `clear()` then `fetchQueueItems({reload: true})`. Mount it in `index.jsx` next to the
    footer; reuse the footer's button classes.
  - verify: In `npm run dev` against ComfyUI: select two pending jobs → Delete removes both;
    select an archived job → Run (and Shift+Run) queues it; Load appears only for a single
    selection; lint passes.
  - size: M

- [x] M4.P1.T4 — Keyboard handling for the selection
  - files: `src/gui/app/index.jsx`, `src/gui/app/components/SelectionBar.jsx`
  - approach: In `index.jsx`'s existing keyboard handling (the `QM_ParentKeypress` relay covers
    keys pressed while the parent page has focus; add a `keydown` listener on the iframe's
    `window` for keys pressed inside it): `Escape` → `clear()`, `Ctrl/Cmd+A` (when the
    event target is not an input) → `selectAll(orderedKeys)` and `preventDefault`, `Delete`/
    `Backspace` → the same handler as the bar's Delete button; ask for confirmation via
    `window.confirm` only when more than 5 items are selected.
  - verify: In `npm run dev`, the three shortcuts work with focus inside the iframe; typing in the
    filter/page inputs is unaffected.
  - size: S

## Phase 4.2: Release

- [x] M4.P2.T1 — Rebuild, README manual update, changelog
  - files: `web/.gui/**`, `README.md`, `CHANGELOG.md`
  - approach: `npm run build`; commit `web/.gui/`. Rewrite the README "Running and main Queue
    Manager window" and "Archive" sections to describe selecting cards and the action bar
    (including the Shift-for-front behaviour now living on the bar's Run button); add a
    "Selection" subsection listing the keyboard shortcuts; changelog entry.
  - verify: README describes selection; `git status` shows the rebuilt bundle.
  - size: S

**Verification gate:** `npm run build`/`npm run lint`, `pytest tests/`, `ruff check .` all pass;
manual check in ComfyUI: every action previously reachable per row (delete, interrupt running,
load, archive, run, run-at-front) is reachable through selection; rebuilt `web/.gui/` committed.

## Decisions

- 2026-09-13 — M4.P1.T4 extracted delete logic into a new `src/gui/app/internals/deleteUtils.js`
  (not in the task's original `files` list): the keyboard Delete/Backspace handler in `index.jsx`
  needed the same running-vs-pending delete logic as `SelectionBar`'s Delete button, and a shared
  helper was the smaller diff than duplicating it or lifting state.
- 2026-09-13 — Manual verification gate: 10/11 scripted checks passed as specified. The one
  "deviation" (shift-range using the last-clicked card as anchor rather than the first-clicked)
  is not a bug — it matches this milestone's own spec (`## Phase 4.1` intro: "Shift-click for a
  range" using `anchor` = last clicked key, per `selectionStore.js`'s design in M4.P1.T1); the
  verification checklist's wording was imprecise, not the implementation. Gate passes.
- 2026-09-13 — PR #8 review round 1 (Codex): 5 findings. Fixed in-scope: stale `onSelect`
  closure on `QueueCard`'s memo comparator after a queue refresh (major — `Queue.jsx`'s
  `handleSelect` is now a stable `useCallback` reading `orderedKeys` via a ref, and the
  comparator now checks `onSelect`/`itemKey`), the selection bar's Load button silently
  no-op'ing for a running item with `extra_pnginfo` but no `.workflow` (minor —
  `canLoad` now checks the workflow directly), the Ctrl+A/Delete keyboard guard missing
  contentEditable descendants (minor — switched to `event.target.isContentEditable`), and a
  leftover dead `.card-actions` CSS block. Declined as out-of-scope, logged instead as a project
  open question: `qm_queue.py`'s `delete_running_job` only matches DB `status = 1` rows, so it
  can't actually interrupt an external job (pre-existing since before this milestone; M4's bulk
  Delete inherits it from the same helper the old per-card Delete used). One round; no second
  round needed.
