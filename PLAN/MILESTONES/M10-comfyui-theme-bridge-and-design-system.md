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

- [ ] M10.P1.T2 — Iframe applies the theme and exposes `--qm-*` tokens
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

- [ ] M10.P1.T3 — MUI is driven by the same tokens (or removed where a plain element does)
  - files: `src/gui/theme.js`, `src/gui/main.jsx`, `src/gui/app/components/TopMenu.jsx`, `src/gui/app/components/SplashScreen.jsx`
  - approach: Audit what `@mui/material` is still used for after M7 (expected: `Menu` in
    `TopMenu`, `Dialog`/`Modal` in `SplashScreen`, `GlobalStyles`, and `@mui/icons-material`
    icons). Rebuild `theme.js` as a function `buildTheme(vars, dark)` producing an MUI theme
    whose `palette.mode`, `background`, `text`, `primary`, `error` and `divider` come from the
    bridged variables, re-created via `useMemo` when the theme message changes; delete the
    `GlobalStyles` neutral-colour shim in `main.jsx` and the Tailwind `neutral-*`/`dark:`
    utility classes in JSX that depended on it, replacing them with token-based classes.
    Where a MUI component is only providing a styled box, replace it with a plain element.
  - verify: `npm run lint`/`npm run build` pass; the top menu and splash dialog match the panel
    colours in both a dark and a light palette.
  - size: M

## Phase 10.2: Restyle the existing surfaces

- [ ] M10.P2.T1 — Buttons, inputs and typography
  - files: `src/gui/styles/_common.scss`, `src/gui/styles/_mixins.scss`, `src/gui/styles/_footer.scss`, `src/gui/app/index.jsx`
  - approach: Replace the `shiny-button` mixin and the `green/red/yellow/blue-button` classes
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

- [ ] M10.P2.T2 — Tabs, list and footer layout
  - files: `src/gui/styles/_queue.scss`, `src/gui/styles/_footer.scss`, `src/gui/styles/_layout.scss`, `src/gui/app/index.jsx`, `src/gui/app/components/Queue.jsx`
  - approach: Tabs (Queue / Archive / Completed) become a segmented control styled like the
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
  - size: M

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

- 2026-09-11 — Theme is bridged from the parent page as computed CSS variables rather than
  re-implemented in the iframe: it follows every palette (including custom ones) with no
  duplication, and the `--qm-*` token layer keeps the app's own styles independent of ComfyUI
  variable names (only `_variables.scss` and the bridge list know them).
- 2026-09-11 — Bundled Roboto is dropped in favour of the parent page's font: matching ComfyUI
  matters more than a fixed typeface, and it removes ~30 font files from the shipped bundle.
