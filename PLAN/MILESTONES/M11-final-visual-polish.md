# Milestone 11: Final visual polish pass

Everything built after M10 — cards (M2), card-info tiles (M3), error blocks (M9), the selection
bar (M4), priority badges and menu (M5), interactive/resumed badges (M6) — used the `--qm-*`
tokens, but each landed in its own milestone. This pass looks at the whole panel at once, in
ComfyUI's Dark and Light palettes and at the narrow sidebar width, and fixes what reads as
inconsistent or unfinished: alignment, density, badge colours, motion, focus states, empty
states. No new features.

## Phase 11.1: Audit

- [ ] M11.P1.T1 — Visual audit checklist with findings
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
    (audit findings). Group them into the two fix tasks below (T2 structural, T3 cosmetic) and
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
