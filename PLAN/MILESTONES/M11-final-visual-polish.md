# Milestone 11: Final visual polish pass

Everything built after M10 — cards (M2), card-info tiles (M3), error blocks (M9), the selection
bar (M4), priority badges and menu (M5), interactive/resumed badges (M6) — used the `--qm-*`
tokens, but each landed in its own milestone. This pass looks at the whole panel at once, in
ComfyUI's Dark and Light palettes and at the narrow sidebar width, and fixes what reads as
inconsistent or unfinished: alignment, density, badge colours, motion, focus states, empty
states. No new features.

## Phase 11.1: Audit

- [x] M11.P1.T1 — Visual audit checklist with findings
  - files: this milestone file only (findings appended under `## Decisions`); no code
  - approach: In a ComfyUI instance with a few pending, one running, several completed
    (including one errored and one interrupted) and some archived jobs, walk every state at
    sidebar widths ~320 px and ~600 px in Dark and Light palettes: card header alignment and
    truncation of long workflow names, card-info tiles (image + text mixes, 1 vs 6 entries),
    output thumbnail strip wrapping, error block expanded/collapsed, selection outline and the
    selection bar with 1 / many / mixed selections, priority and interactive badges next to each
    other, running-card progress bar, footer and pagination at both widths, splash and top
    menu, keyboard focus rings on every interactive element, empty/loading/error list states.
    Record each defect as one line `- <surface>: <what's wrong> → <fix>` under `## Decisions`
    (audit findings). Group them into the two fix tasks below (M11.P2.T1 structural, M11.P2.T2 cosmetic) and
    add trailing-numbered tasks here if a finding does not fit either.
  - verify: The findings list exists and every entry names a surface and a fix.
  - size: S

## Phase 11.2: Fixes

- [ ] M11.P2.T1 — Structural fixes: layout, density, responsiveness
  - files: `src/gui/styles/_queue.scss`, `src/gui/styles/_footer.scss`, `src/gui/app/components/QueueCard.jsx`, `src/gui/app/components/SelectionBar.jsx`, `src/gui/app/components/CardInfo.jsx`
  - approach: Apply the layout findings from T1: consistent `--qm-space` multiples for card
    padding and gaps; a `container` query (or `min-width` breakpoints on `.qm-cards`) so cards
    stack header/info/outputs vertically under ~400 px and place info beside the header above
    it; workflow names truncate with ellipsis and full name in `title`; the selection bar
    wraps its buttons at narrow widths instead of overflowing; thumbnails and info tiles share
    one size token (`--qm-thumb`) and one radius.
  - verify: The T1 findings tagged structural are closed; both widths and both palettes
    re-checked.
  - size: M

- [ ] M11.P2.T2 — Cosmetic fixes: badges, colours, motion, focus
  - files: `src/gui/styles/_common.scss`, `src/gui/styles/_queue.scss`, `src/gui/styles/_variables.scss`, `src/gui/app/components/QueueCard.jsx`
  - approach: One `.qm-badge` style with colour variants derived from tokens (priority
    positive `--qm-success`, negative `--qm-fg-muted`, interactive `--qm-primary`, resumed
    `--qm-warning`, error `--qm-danger`, interrupted `--qm-warning`), 0.75rem text, pill
    radius, consistent height so they align on one baseline. Hover/selection transitions
    150 ms on background/border only (no layout motion); `:focus-visible` rings using
    `--qm-primary` on cards, buttons, tabs and the error toggle; `prefers-reduced-motion`
    disables transitions. Check contrast of muted text against `--qm-surface` in the Light
    palette and adjust the fallback tokens if under 4.5:1.
  - verify: The T1 findings tagged cosmetic are closed; a keyboard-only pass (Tab through the
    panel) shows a visible ring on every stop.
  - size: M

## Phase 11.3: Release

- [ ] M11.P3.T1 — Rebuild, changelog, README screenshot list
  - files: `web/.gui/**`, `CHANGELOG.md`, `README.md`
  - approach: `npm run build`; commit `web/.gui/`. Changelog entry. Replace the "screenshots
    predate the redesign" note from M10 with an explicit list of the screenshots the README
    references that need retaking (file name → what to capture), so the user can retake them
    in one sitting; keep the old images in place until then.
  - verify: Rebuilt bundle in `git status`; README lists the screenshots to retake.
  - size: S

**Verification gate:** `npm run lint`, `npm test`, `npm run build` green; `pytest tests/`, `ruff
check .` green; every audit finding under `## Decisions` is marked closed; manual pass in Dark and
Light palettes at both widths shows no regressions in any feature from M2–M9; rebuilt
`web/.gui/` committed.

## Decisions

Audit performed against a live ComfyUI v0.35.1 instance (`.local/ComfyUI`) via Playwright, walking
the Queue/Archive/Completed tabs at ~320px and ~600px sidebar widths in both Dark and Light
(`Comfy.ColorPalette`) palettes. Data mix used: ~774 pre-existing completed jobs from prior manual
QA sessions (including real `qa-error-test` / Error and `qa-interrupt-test` / `qa-slow-test` /
Interrupted jobs, and `manual-verify-check*-interactive` / `-resumed` priority jobs), plus
newly-submitted jobs for a 6-entry mixed image+text card-info tile, a long workflow name
(`extra_pnginfo.workflow.workflow_name` patched directly in `data/qm-queue.db` for one job to force
truncation, since the live app's workflow-name field isn't writable via the public app API), an
8-image `SaveImage` batch (patched to `priority=1000` for badge-adjacency), and several
`EmptyImage`→chained-`ImageBlur`→`PreviewImage` jobs used purely to keep the queue busy long enough
to capture running/pending states and archive a couple of pending jobs live through the UI. Could
not reproduce a *new* errored/interrupted job through the UI within the session (ComfyUI's own
client-side node validation rejects out-of-range `ImageBlur` params before submission, so a bad-param
attempt never reaches the DB); the real historical error/interrupted jobs already in the DB were
used instead and give full coverage of the error-block states.

- Selection: `.qm-card.selected`'s `box-shadow: inset 0 0 0 2px var(--qm-primary)` computes
  correctly (verified via `getComputedStyle`) but is fully hidden behind the opaque
  `.card-header` background on any card whose body is empty (all pending cards, running cards,
  and archived cards with no card-info/outputs) — selecting a card produces no visible highlight
  at all in either palette → paint the selection indicator somewhere that isn't occluded by
  `.card-header` (e.g. a border/outline on the header itself, or restructure so the ring paints
  above children).
- Card header badges: the execution-time badge (bordered box, `padding: 2px 8px`, no fixed
  height) sits next to `.qm-badge` pills (priority/danger/output-count, `height: 1.25rem`) and is
  visibly taller than them, so badges in the same header row don't share a baseline → give the
  execution-time badge the same `.qm-badge` sizing.
- Card header badges: the plain `.qm-badge` (used for the output-count pill) pairs
  `--qm-fg-muted` text on `--qm-surface-hover` background; measured contrast in the Light palette
  is 4.34:1, under the WCAG AA 4.5:1 minimum for normal text (Dark palette measures 5.58:1, fine)
  → use `--qm-fg` or a higher-contrast background for that badge.
- Running card progress bar: `.qm-card.running:after` fills with `background-color:
  var(--qm-primary)` at `opacity: 0.2`; pixel-sampled against both palettes this is a barely
  perceptible tint (Dark: rgb(48,48,48)→rgb(57,71,88); Light: rgb(238,238,238)→rgb(201,216,239))
  — hard to gauge run progress at a glance → raise the fill opacity and/or add a full-opacity
  accent line at the progress edge.
- Keyboard focus: `.tabs .tab` sets `outline: none` with no `:focus-visible` replacement, so
  Tabbing to the Queue/Archive/Completed tabs shows no visible focus indicator at all (confirmed
  by tabbing through and screenshotting each stop) → add a `.tab:focus-visible` ring matching
  `.qm-btn:focus-visible`.
- Keyboard focus: elements with no explicit `:focus-visible` rule (e.g. the workflow-name
  `.name-cell button.plain`) fall back to the browser's native outline, which looks visibly
  different from the app's custom blue `.qm-btn:focus-visible` ring — focus styling is
  inconsistent across the panel → apply one shared focus-visible treatment everywhere instead of
  only on `.qm-btn`.
- Priority menu: the dropdown (Low/Normal/High + Custom/Apply) opens anchored below the
  selection bar's "Priority" button and, at 600px width with a short card list, overlaps the
  sticky footer's action buttons below it (the footer's red-bordered delete button is visible
  showing through underneath the open menu) → make the menu flip upward or otherwise avoid the
  sticky footer.
- Card-info tiles: `.card-info` is `display:flex; flex-wrap:wrap` with the default
  `align-items: stretch`, so a short text tile (e.g. a "Seed" tile with a short numeric value)
  sharing a row with a taller multi-line text tile or an image tile gets stretched to match the
  tallest sibling, leaving a large empty gap under its own content → set
  `align-items: flex-start` on `.card-info`.
- Selection bar / footer actions: `margin-left: auto` on the danger button
  (`.selection-bar .delete`, `.footer .actions button.delete`) makes it wrap onto its own line at
  ~320px width, isolated with a large gap from the button group above it (confirmed in both the
  selection bar with 3 selected and the Queue-tab footer at 320px) → drop the auto-margin once
  buttons wrap, or lay out the wrapped group as a plain left-aligned row.
- Splash screen: the "Queue Manager Manual" / "Changelog" / "Issues" links use a hardcoded
  `color: dodgerblue` instead of `var(--qm-primary)`, so they don't exactly match the app's
  primary blue and won't track future token changes → replace with `var(--qm-primary)`.
- **Investigated and closed, not a defect**: a full-window screenshot comparison (Dark vs Light
  palette, `.local/qm-m11-screenshots/full-window-{dark,light}.png`) was suspected to show the
  panel stuck in Dark when ComfyUI switched to Light. Root-caused with live instrumentation
  (`document.documentElement`'s `style`/`class` mutations, `QM_Theme` postMessage payloads before/
  after `Comfy.ToggleTheme`) and confirmed by direct pixel sampling of both screenshots
  (panel background `srgb(23,23,24)`→`srgb(255,255,255)`, header/tabs `srgb(48,48,48)`→
  `srgb(238,238,238)` — a full, correct theme flip). The M10 theme bridge
  (`web/js/functions.js`'s `setupThemeObserver`/`collectTheme`, `useComfyTheme.js`) works as
  designed; the initial read of the screenshots was a visual misjudgment. No task needed.
  Two low-risk hardening ideas surfaced but are optional, not required: (1) `collectTheme()` drops
  vars with empty values and the iframe side never calls `removeProperty`, so a future palette that
  omits a var one theme defines could leave a stale inline value — not triggered by any palette
  today; (2) the observer is coupled to ComfyUI 0.35.1's specific mechanism (mutating `style`/
  `class` on `<html>`) rather than a public event, so a future ComfyUI frontend change could
  silently break it. Neither is in scope for M11.

### Structural (M11.P2.T1)
- Selection: `.qm-card.selected` box-shadow ring invisible behind opaque `.card-header` on
  empty-bodied cards → repaint the selection indicator so it isn't occluded.
- Priority menu overlaps/collides with the sticky footer at 600px width → collision-aware
  positioning (flip upward).
- Card-info tiles stretch short text tiles to match taller siblings, leaving unwanted empty
  space → `align-items: flex-start` on `.card-info`.
- Selection bar / footer action buttons isolate the danger button on its own line at 320px width
  due to `margin-left: auto` → fix wrap behavior.

### Cosmetic (M11.P2.T2)
- Card header badges (execution-time vs. `.qm-badge` pills) don't share a consistent height/
  baseline → unify badge sizing.
- Default `.qm-badge` (output-count) fails WCAG AA contrast (4.34:1) in the Light palette →
  higher-contrast text/background pairing.
- Running-card progress fill (`opacity: 0.2`) is barely visible in both palettes → raise opacity
  / add an accent line.
- `.tabs .tab` has no `:focus-visible` ring at all → add one matching `.qm-btn`.
- Focus ring styling is inconsistent (custom ring on `.qm-btn`, native browser outline
  elsewhere) → apply one shared focus-visible treatment app-wide.
- Splash-screen links use hardcoded `dodgerblue` instead of `var(--qm-primary)` → swap to the
  token.
- `_variables.scss`'s `$archive-color`/`$archive-color-light`/`$archive-color-darker` and
  `--background-light` are hardcoded and unreferenced anywhere in `src/gui/styles/` → dead code,
  remove (found during the theme-bridge investigation above; file already in this task's scope).
