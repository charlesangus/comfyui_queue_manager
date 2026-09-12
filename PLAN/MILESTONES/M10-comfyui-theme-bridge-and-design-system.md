# Milestone 10: ComfyUI theme bridge and design system

The Queue Manager iframe currently looks nothing like ComfyUI: MUI defaults, Roboto, gradient
"shiny" buttons in four colours, and light/dark decided by `prefers-color-scheme` rather than the
user's ComfyUI colour palette. Because the app renders in an iframe it cannot inherit the parent's
CSS variables, so this milestone (1) bridges ComfyUI's live theme variables and font into the
iframe, (2) defines a small set of `--qm-*` design tokens on top of them, and (3) restyles every
existing surface (tabs, list rows, footer, top menu, splash, inputs, buttons) with those tokens so
the panel reads as part of ComfyUI in every palette. It runs before M2 so cards, the selection bar,
badges and error blocks are designed with the tokens from the start.

Reference points on the parent page (already used by `web/js/functions.js` for the injected
Pause/Stop buttons): PrimeVue classes `p-button p-button-text p-button-danger rounded-lg …` and
tokens `--p-toolbar-background`, `--p-primary-color`, `--p-surface-*`, `--p-content-border-color`,
`--p-text-color`, `--p-text-muted-color`, plus ComfyUI's palette variables from the
`comfy_base` section of a colour palette (`--fg-color`, `--bg-color`, `--comfy-menu-bg`,
`--comfy-menu-secondary-bg`, `--comfy-input-bg`, `--input-text`, `--descrip-text`,
`--border-color`, `--error-text`, `--content-bg`, `--content-fg`, `--content-hover-bg`,
`--content-hover-fg`, `--drag-text`, `--tr-even-bg-color`, `--tr-odd-bg-color`, `--bar-shadow`)
set on `document.documentElement`, with `dark-theme` toggled on the root for dark palettes.

## Phase 10.1: Theme bridge

- [x] M10.P1.T1 — Parent page sends the live theme to the iframe
  - files: `web/js/functions.js`, `web/js/config.js`
  - approach: Add `collectTheme()` that reads `getComputedStyle(document.documentElement)`
    for a fixed list of variable names (`QM_THEME_VARS` in `config.js`: the `comfy_base` keys
    verified in frontend 1.51.10 — `fg-color, bg-color, comfy-menu-bg, comfy-menu-secondary-bg,
    comfy-input-bg, input-text, descrip-text, drag-text, error-text, border-color,
    tr-even-bg-color, tr-odd-bg-color, content-bg, content-fg, content-hover-bg,
    content-hover-fg, bar-shadow`, each as `--<key>` — plus the `--p-*` PrimeVue tokens listed
    above; confirm the `--p-*` names by dumping `getComputedStyle(document.documentElement)` in
    the browser on `~/ComfyUI`), `document.body`'s computed `font-family`/`font-size`, and
    `document.documentElement.classList.contains("dark-theme")`. Send it as `{type:
    "QM_Theme", vars, fontFamily, fontSize, dark}` (a) in the `QM_QueueManager_Hello` reply,
    and (b) whenever it changes: a `MutationObserver` on `document.documentElement` for
    `attributes: ["style", "class"]`, debounced 100 ms. Skip sending when nothing changed
    (compare JSON).
  - verify: In ComfyUI, switching Settings → Appearance → Color Palette between Dark, Light and
    a custom palette logs a `QM_Theme` message in the iframe (temporary `console.log`) with
    the new values each time.
  - size: S

- [x] M10.P1.T2 — Iframe applies the theme and exposes `--qm-*` tokens
  - files: `src/gui/app/hooks/useComfyTheme.js` (new), `src/gui/app/index.jsx`, `src/gui/styles/_variables.scss`, `src/gui/styles/_layout.scss`, `src/gui/styles/_mixins.scss`
  - approach: `useComfyTheme()` listens for `QM_Theme` and writes every received variable onto
    `document.documentElement.style`, sets `font-family`/`font-size` on `body`, and toggles a
    `dark-theme` class on the root. In `_variables.scss` define the token layer, each with a
    fallback so `npm run dev` outside ComfyUI still renders: `--qm-bg: var(--comfy-menu-bg,
    #202020)`, `--qm-surface: var(--comfy-menu-secondary-bg, #2a2a2a)`, `--qm-surface-hover:
    var(--content-hover-bg, …)`, `--qm-fg`, `--qm-fg-muted: var(--descrip-text, …)`,
    `--qm-border: var(--border-color, …)`, `--qm-input-bg`, `--qm-primary: var(--p-primary-
    color, …)`, `--qm-primary-fg`, `--qm-danger: var(--error-text, …)`, `--qm-success`,
    `--qm-warning`, `--qm-radius: 0.5rem` (ComfyUI's `rounded-lg`), `--qm-radius-sm: 0.375rem`,
    `--qm-space: 0.5rem`, `--qm-font: var(--qm-font-family, system-ui, sans-serif)`. Delete the
    `prefers-color-scheme` blocks in `_layout.scss` and `_mixins.scss`; `dark-theme` on the root
    is the only theme switch. Remove `@fontsource/roboto` (imports in `main.jsx`, dependency in
    `package.json`) — the bridged font is used, which also drops ~30 font files from `web/.gui/`.
  - verify: In ComfyUI, changing the palette recolours the panel immediately without reload;
    `npm run dev` standalone renders with the fallbacks; `npm run build` output contains no
    `.woff` files.
  - size: M

- [x] M10.P1.T3 — MUI is driven by the same tokens (or removed where a plain element does)
  - files: `src/gui/theme.js`, `src/gui/main.jsx`, `src/gui/app/components/TopMenu.jsx`, `src/gui/app/components/SplashScreen.jsx`, `src/gui/app/index.jsx`, `src/gui/app/components/Queue.jsx`
  - approach: Actual `@mui/material` usage post-M7 (confirmed at M10 start, corrects this
    task's original guess): `TopMenu` uses only `@mui/icons-material` icons (no `Menu`
    component — the dropdown is a hand-rolled `<section>`); `SplashScreen` uses a plain
    `Button` + icon (no `Dialog`/`Modal`); `main.jsx` has the `GlobalStyles` neutral-colour
    shim; the Tailwind `neutral-*`/`dark:` utility classes it feeds live in `index.jsx:597`
    and `Queue.jsx:60`, not in `TopMenu`/`SplashScreen`. Rebuild `theme.js` as a function
    `buildTheme(vars, dark)` producing an MUI theme whose `palette.mode`, `background`,
    `text`, `primary`, `error` and `divider` come from the bridged `--qm-*` tokens (M10.P1.T2),
    re-created via `useMemo` in `main.jsx` when the theme message changes; delete the
    `GlobalStyles` neutral-colour shim in `main.jsx` and the `neutral-*`/`dark:` classes in
    `index.jsx` and `Queue.jsx`, replacing them with token-based classes/inline styles using
    `--qm-*`. `TopMenu`/`SplashScreen` need no MUI-component surgery (nothing to replace) —
    just make sure their `shiny-button`/`close` styling is consistent with the token-driven
    theme (still using `--qm-*` under the hood via M10.P2's `.qm-btn` work if it's landed by
    then; if not, leave their classNames as-is and let M10.P2.T1 restyle them).
  - verify: `npm run lint`/`npm run build` pass; `grep -rn "neutral-\|dark:" src/gui/app` finds
    nothing; the top menu and splash screen match the panel colours in both a dark and a light
    palette.
  - size: M

## Phase 10.2: Restyle the existing surfaces

- [x] M10.P2.T1 — Buttons, inputs and typography
  - files: `src/gui/styles/_common.scss`, `src/gui/styles/_mixins.scss`, `src/gui/styles/_footer.scss`, `src/gui/app/index.jsx`, `src/gui/app/components/QueueItemRow.jsx`, `src/gui/app/components/TopMenu.jsx`
  - approach: `shiny-button`/`green-button`/`red-button`/`yellow-button`/`blue-button` usage was
    confirmed at task start (freshness check, corrects the original file list): the mixin/class
    definitions live in `_common.scss`/`_mixins.scss`, but the classNames are actually applied in
    `index.jsx` (footer close/delete-all/archive-all/run-all buttons), `QueueItemRow.jsx` (the
    per-row Delete/Load/Archive/Run buttons — the largest user), and `TopMenu.jsx` (Take over
    focus / Documentation / About buttons, plain `shiny-button` with no colour variant). All
    three JSX files need their classNames updated to the new `.qm-btn` family. Replace the
    `shiny-button` mixin and the `green/red/yellow/blue-button` classes
    with a `.qm-btn` family modelled on PrimeVue's buttons as ComfyUI renders them: flat,
    `--qm-radius-sm`, 1px border `--qm-border`, `--qm-surface` background, `--qm-surface-hover`
    on hover, `--qm-primary` outline on `:focus-visible`, 32 px tall, icon + label with 0.5rem
    gap; variants `.qm-btn-primary` (filled `--qm-primary`), `.qm-btn-danger` (text/outlined
    `--qm-danger`), `.qm-btn-text` (no border). Inputs (page number, filter chips) use
    `--qm-input-bg`, `--qm-border`, same radius. Body text 0.875rem (ComfyUI's `text-sm`),
    muted labels `--qm-fg-muted`. Update every `className` in `index.jsx` (footer, pagination,
    filter chip, front-of-queue indicator) to the new classes. Provide a `.qm-icon-btn`
    (square 32 px) for icon-only actions.
  - verify: No `shiny-button` or hard-coded hex colour remains in `src/gui/styles` except inside
    the token fallbacks (`grep -n "#[0-9a-fA-F]\{3,6\}" src/gui/styles` shows only
    `_variables.scss`); buttons look like ComfyUI's own in both palettes.
  - size: M

- [x] M10.P2.T2 — Tabs, list and footer layout
  - files: `src/gui/styles/_queue.scss`, `src/gui/styles/_footer.scss`, `src/gui/styles/_layout.scss`, `src/gui/styles/_splash.scss`, `src/gui/app/index.jsx`, `src/gui/app/components/Queue.jsx`
  - approach: M10.P1.T3 deleted `main.jsx`'s `GlobalStyles` block, which was the only definition
    of `--color-neutral-100`…`--color-neutral-900` — every other `var(--color-neutral-*)`
    reference across `_queue.scss`, `_footer.scss`, and `_splash.scss` (none of them Tailwind
    utility classes, so T3's JSX-only sweep didn't catch them) has been dangling/invalid since
    that commit, and `_layout.scss`'s `--background`/`--background-light` are stuck at their
    light-mode values now that the `prefers-color-scheme` override was removed without a
    `dark-theme`-class replacement. Confirmed at this task's start — added to its scope since
    it's the same token-swap work: replace every `--color-neutral-*`/`--background`/
    `--background-light` reference in `_queue.scss`, `_footer.scss`, and `_splash.scss` with the
    matching `--qm-*` token (surface/bg → `--qm-surface`/`--qm-bg`, borders → `--qm-border`,
    text → `--qm-fg`/`--qm-fg-muted`) — `_splash.scss` is small (70 lines) and self-contained,
    just needs its handful of `--color-neutral-*` refs swapped, no structural change. Also:
    M10.P2.T1 left `_queue.scss`'s `button.run { background-color: rgb(96, 165, 250); }`
    in place — its specificity currently overrides the new `.qm-btn-primary` background on the
    per-row Run button. Remove that hardcoded override as part of this task's `_queue.scss` pass
    so Run renders with the token-driven `.qm-btn-primary` styling. Tabs (Queue / Archive / Completed) become a segmented control styled like the
    ComfyUI sidebar's tab header (`--qm-surface` track, active tab `--qm-bg` with
    `--qm-primary` underline, `--qm-fg-muted` inactive text). Rows (still rows — cards come in
    M2) get `--qm-space` padding, a 1px `--qm-border` separator, no zebra striping, hover
    `--qm-surface-hover`; the running row's progress bar uses `--qm-primary` at 20 % opacity
    over the row with a 2px solid `--qm-primary` leading edge. Footer becomes a sticky toolbar
    with `--qm-bg`, top border `--qm-border`, actions right-aligned, pagination left. Empty and
    loading states are centred, muted text with the `pi` icon set not available in the iframe —
    use `@mui/icons-material` equivalents at 20 px.
  - verify: Side-by-side with ComfyUI's native Queue sidebar tab in the same palette, the
    panel's spacing, borders, text sizes and colours match; both palettes checked.
    `grep -rn "color-neutral\|var(--background" src/gui/styles` finds nothing.
  - size: M

- [x] M10.P2.T4 — Filters panel and top-menu dropdown restyle
  - files: `src/gui/styles/_queue.scss`
  - approach: Added after M10.P2.T2 (freshness gap found while verifying it): `.filters`
    (~line 476), `.top-menu`/`.top-menu-toggle` (~line 538-630) in `_queue.scss` weren't in any
    M10 task's file scope and still carry ~10 `prefers-color-scheme` blocks and hardcoded
    colors (`#ffffff44`, `#00000022`, `#333`, `white`, `black`, box-shadow alpha swaps) — this
    milestone's own verification gate requires zero `prefers-color-scheme` dependence, so it
    has to close before the gate. Replace every hardcoded color/`prefers-color-scheme` pair in
    those three blocks with the matching `--qm-*` token (backgrounds → `--qm-surface`/
    `--qm-surface-hover`, text → `--qm-fg`/`--qm-fg-muted`, borders → `--qm-border`), deleting
    the media queries once nothing inside them differs from the token's own light/dark value.
  - verify: `grep -n "prefers-color-scheme" src/gui/styles/_queue.scss` finds nothing;
    `npm run lint`/`npm run build` pass.
  - size: S

- [ ] M10.P2.T5 — Sweep the remaining scattered `prefers-color-scheme` blocks in `_queue.scss`
  - files: `src/gui/styles/_queue.scss`
  - approach: T4's grep verify was scoped by its subagent to the three regions it edited rather
    than the whole file, so it missed five more instances left over from before T2/T4: `.pending
    .total:hover` (white/black background+text swap, ~line 199-207), `.pending button:hover`
    (`gold`/`saddlebrown` text swap, ~line 211-219), `.outputs-row td` background
    (`#ffffff05`/`#ffffff99`, ~line 287-295), `button.plain:hover` color (`white`/`black`
    swap, ~line 403-409), and `.page-selector` background (`#fff8`, ~line 447-451). Replace each
    with the matching `--qm-*` token the same way T2/T4 did (backgrounds → `--qm-surface`/
    `--qm-surface-hover`, text → `--qm-fg`/`--qm-fg-muted`, an accent/highlight color like the
    gold hover can map to `--qm-primary` since there's no dedicated accent token), deleting the
    `prefers-color-scheme` block once folded into the token value. Confirm nothing else remains
    with `grep -c "prefers-color-scheme" src/gui/styles/_queue.scss` returning `0`, and also spot
    -check `_common.scss`/`_footer.scss` for the same pattern in case anything survived earlier
    tasks (they should already be clean, but this task is the last one touching styles before
    the milestone gate, so it's the right place to confirm the whole app is clean, not just
    `_queue.scss`).
  - verify: `grep -rc "prefers-color-scheme" src/gui/styles` shows `0` for every file;
    `npm run lint`/`npm run build` pass.
  - size: S

- [ ] M10.P2.T3 — Rebuild, changelog, screenshot note
  - files: `web/.gui/**`, `CHANGELOG.md`, `README.md`
  - approach: `npm run build`; commit `web/.gui/` (note the font files disappearing). Changelog
    entry "Panel now follows the ComfyUI colour palette and font". Add a one-line note at the
    top of the README Manual that screenshots predate the redesign until they are retaken.
  - verify: Rebuilt bundle in `git status` with no `.woff*` under `web/.gui/assets`.
  - size: S

**Verification gate:** `npm run lint`, `npm run build` (and `npm test` once M8 has landed)
green; `pytest tests/`/`ruff check .` green; manual check in ComfyUI with the Dark, Light and
one custom palette: the panel recolours live, buttons/tabs/footer match native controls, no
`prefers-color-scheme` dependence remains; rebuilt `web/.gui/` committed.

## Decisions

- 2026-09-12 — M10.P2.T4's own verify claim ("prefers-color-scheme grep clean") turned out to be
  scoped to the regions it edited, not the whole file as instructed — five more scattered
  instances remained in `_queue.scss` (`.pending .total:hover`, `.pending button:hover`,
  `.outputs-row`, `button.plain:hover`, `.page-selector`). Added M10.P2.T5 to sweep them plus
  double-check `_common.scss`/`_footer.scss`, since that's the last styles task before the
  gate. Lesson for future PM verification: re-run a task's own stated verify command myself
  against the actual current file rather than trusting a subagent's narrower restatement of it.
- 2026-09-12 — M10.P2.T2 verification surfaced a further gap: `.filters`/`.top-menu`/
  `.top-menu-toggle` in `_queue.scss` were never in any M10 task's file scope and still carry
  `prefers-color-scheme` blocks and hardcoded colors, which the milestone's own verification
  gate ("no `prefers-color-scheme` dependence remains") requires closed. Added
  M10.P2.T4 (before M10.P2.T3's final rebuild) to cover it rather than silently letting the
  gate check fail or expanding T2 after the fact.
- 2026-09-12 — Deleting `main.jsx`'s `GlobalStyles` block in M10.P1.T3 left every
  `var(--color-neutral-*)` reference in `_queue.scss`/`_footer.scss`/`_splash.scss` dangling
  (they aren't Tailwind classes, so T3's JSX-only sweep didn't touch them), and left
  `_layout.scss`'s `--background`/`--background-light` stuck at their light-mode value once the
  `prefers-color-scheme` override was removed. Rather than patch it as a standalone fix, folded
  the cleanup into M10.P2.T2 (which already restyles `_queue.scss`/`_footer.scss`/`_layout.scss`
  with `--qm-*` tokens) and added `_splash.scss` to that task's file list — same token-swap work,
  and `_splash.scss` is small enough not to change the task's `M` sizing.
- 2026-09-11 — Theme is bridged from the parent page as computed CSS variables rather than
  re-implemented in the iframe: it follows every palette (including custom ones) with no
  duplication, and the `--qm-*` token layer keeps the app's own styles independent of ComfyUI
  variable names (only `_variables.scss` and the bridge list know them).
- 2026-09-12 — M10.P1.T3's brief revised at freshness-check/start time: the actual post-M7
  `@mui/material` usage in `TopMenu`/`SplashScreen` is lighter than the original guess (icons
  and a plain `Button` only, no `Menu`/`Dialog`), while the `neutral-*`/`dark:` Tailwind
  classes the task targets actually live in `index.jsx` and `Queue.jsx`. Task's `files` and
  `approach` updated in place to match; scope/intent unchanged.
- 2026-09-11 — Bundled Roboto is dropped in favour of the parent page's font: matching ComfyUI
  matters more than a fixed typeface, and it removes ~30 font files from the shipped bundle.
