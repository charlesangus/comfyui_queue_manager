# Milestone 2: Rich queue cards

Replace the `<table>` of `<tr>` rows in the Queue Manager iframe with a vertical list of cards. A
card shows the same facts a row does after M7 (serial number, workflow name, running spinner and
progress bar, execution time and the output-thumbnail strip for completed jobs, the per-item
action buttons) plus a new **info area** that renders arbitrary image and text entries attached
to the item as `item[3].card` — the data M3's node will supply. Card layout, top to bottom:
header → `.card-info` (M3 entries) → `.card-outputs` (completed-job thumbnails, from M7) →
actions. This milestone ships with the info area
driven by an empty/absent `card` array (nothing visible), so the UI change is complete and
reviewable on its own and M3 only has to populate data. All styling uses the `--qm-*` tokens
and `.qm-btn` classes from M10 — no new colours, radii or fonts.

Card data contract (consumed here, produced in M3): `item[3].card` is an array, sorted by
`index`, of entries:

```json
{ "index": 1, "label": "Prompt", "kind": "text",  "value": "a cat in a hat" }
{ "index": 2, "label": "Input",  "kind": "image", "value": { "filename": "cat.png", "subfolder": "", "type": "input" } }
```

`kind: "image"` values are either `{filename, subfolder, type}` triples resolvable with the
existing `MediaItem` component (which builds a `/view?...` URL) or `{ "url": "<path relative to
baseURL>" }` for images the extension serves itself; `kind: "text"` values are strings.

## Phase 2.1: Card component

- [x] M2.P1.T1 — Create `QueueCard` from `QueueItemRow`, keeping all behaviour, as a `<div>`-based card
  - files: `src/gui/app/components/QueueCard.jsx` (new), `src/gui/app/components/QueueItemRow.jsx` (delete after T2)
  - approach: Copy `QueueItemRow.jsx` to `QueueCard.jsx` and restructure the markup into
    `<article className="qm-card {running|pending} ...">` with three regions: `.card-header`
    (serial `rowIndex`, `LoaderSpinner` when `loader`, the workflow-name button that calls
    `filterByWorkflow`, `executionTimeLabel` for completed, the `mediaOutputs.total` badge),
    `.card-body` (an empty `.card-info` container reserved for T3, then `.card-outputs`
    holding M7's thumbnail strip for completed items, logic unchanged), and
    `.card-actions` (the existing Delete/Load/Archive/Run/View buttons, identical handlers).
    Keep the same props, the `memo` custom comparator and the `AppContext` usage. Do not change
    any API call.
  - verify: `npm run lint` passes; component renders in `npm run dev` for all three routes
    (queue/archive/completed) with the same buttons as before.
  - size: M

- [x] M2.P1.T2 — Switch `Queue.jsx` from table markup to a card list and restyle
  - files: `src/gui/app/components/Queue.jsx`, `src/gui/styles/_queue.scss`, `src/gui/app/components/QueueItemRow.jsx` (delete)
  - approach: In `Queue.jsx` replace `<table>/<thead>/<tbody>` with `<div className="qm-cards">`
    and render `QueueCard` instead of `QueueItemRow` for `running` and `pending`; keep the
    `error`, "No items." and "Loading..." states as plain `<div>`s; keep the `--job-progress`
    CSS variable on the wrapper. In `_queue.scss` rewrite the `table`/`tr`/`td`-scoped rules
    (`.running` progress bar at `width: var(--job-progress)`, `.pending`, hover rules, the
    `.outputs` strip sizing from M7) to target `.qm-card`, `.card-header`, `.card-body`,
    `.card-outputs`, `.card-actions`. The running card keeps its progress bar. Delete
    `QueueItemRow.jsx`.
  - verify: `npm run build` succeeds; in `npm run dev` against a ComfyUI instance, a running job
    shows the progress bar filling, completed jobs show their thumbnail strip, and
    archive/queue cards show the right action buttons.
  - size: M

- [x] M2.P1.T3 — Render the card info area from `item[3].card`
  - files: `src/gui/app/components/QueueCard.jsx`, `src/gui/app/components/CardInfo.jsx` (new), `src/gui/styles/_queue.scss`
  - approach: New `CardInfo` component takes `entries` (the array described in the contract
    above), sorts by `index`, and renders a horizontal flex-wrap of tiles: `kind === "image"` →
    `MediaItem` with `file={value}` (no autoplay, no controls) at `--qm-thumb`, or a plain
    `<img src={baseURL + value.url}>` when `value.url` is set, with the `label` as a caption; `kind === "text"` → a tile with the label as caption and the value
    clamped to 3 lines (CSS `line-clamp`) with the full text in the `title` attribute and a
    click-to-expand toggle. Unknown kinds render the label and `String(value)`. `QueueCard`
    renders `<CardInfo entries={item?.[3]?.card} />` inside `.card-info` only when the array is
    non-empty. Include `item?.[3]?.card` in the memo comparator (compare by reference).
  - verify: Temporarily feeding a fake `card` array in `npm run dev` (e.g. via the React devtools
    or a hard-coded fixture removed before commit) shows image and text tiles in index order;
    lint passes.
  - size: S

## Phase 2.2: Release

- [x] M2.P2.T1 — Rebuild the GUI, update README screenshots text and changelog
  - files: `web/.gui/**`, `README.md`, `CHANGELOG.md`
  - approach: `npm run build` in `src/gui/`; commit `web/.gui/`. In the README "Running and main
    Queue Manager window" section, replace the "actions column"/"table" wording with card
    wording (screenshots can be refreshed by the user later — add a note). Add a CHANGELOG entry
    "Queue entries are now cards".
  - verify: `git status` shows the rebuilt `web/.gui/assets/index.js`; README wording no longer
    refers to table columns.
  - size: S

**Verification gate:** `npm run build` and `npm run lint` pass in `src/gui/`; `pytest tests/` and
`ruff check .` pass; rebuilt `web/.gui/` committed; manual check in a ComfyUI instance that
queue, archive and completed tabs render as cards with the previous actions working (delete,
load, archive, run, run-at-front with Shift, thumbnails opening in a new tab).

## Decisions

- 2026-09-12 — Verification gate passed: `npm run build`/`npm run lint` clean (only pre-existing
  warnings/errors, none new), `pytest tests/` (13 passed) and `ruff check .` clean, rebuilt
  `web/.gui/` committed in M2.P2.T1. Manual check done against the local ComfyUI v0.35.1 test
  instance (`.local/ComfyUI`) using a headless Chromium (playwright, installed ad hoc for this
  check) driving the real iframe: submitted tiny `EmptyImage → PreviewImage` prompts through the
  native `/prompt` API with proper `extra_pnginfo`, and screenshotted the Queue (pending card,
  dimmed styling, Delete/Load/Archive buttons), Completed (4 cards with workflow name, `0.01s`
  execution-time badge, an output-count `.qm-badge`, and real thumbnail images rendering in
  `.card-outputs`), and Archive ("No items." empty state) tabs — all rendered correctly with the
  `.qm-card`/`.qm-btn`/`--qm-*` styling. Did not click Run/Shift-run or a thumbnail's new-tab open
  live (no archived item left after cleanup to click Run on); confirmed instead via diff review
  that `playItem`/Shift-detection/`handleThumbnailClick` are byte-for-byte unchanged from the old
  `QueueItemRow.jsx`, only the surrounding markup moved to `QueueCard.jsx`. Test queue/history
  data cleaned up afterward (`DELETE /queue_manager/queue`, unpaused).
- 2026-09-12 — While driving the manual check, a raw `/prompt` submission without
  `extra_data.extra_pnginfo` crashed the ComfyUI `prompt_worker` thread (`qm_queue.py`'s
  `queue_get` assumes `extra_pnginfo` is always present, unlike `queue_put` which already
  guards for it) and required a full server restart to recover. Pre-existing, unrelated to M2's
  frontend-only scope — logged as an open question on the board for a follow-up decision rather
  than fixed here.
