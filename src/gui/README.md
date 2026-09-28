The frontend is a React project built with Vite as a library. `web/js/functions.js` imports the bundle and mounts it straight into the Queue Manager sidebar tab. It is part of the ComfyUI page (no iframe), so it talks to ComfyUI through `app` (imported as `comfy/app`) and inherits ComfyUI's fonts, colours and Tailwind utilities.

## Building

```bash
npm install
npm run build
```

This outputs to `../../web/.gui/` (i.e. `web/.gui/` at the repo root), which is what ComfyUI actually serves — there's no build step at install time, so the built output has to be committed. **Any change under `src/gui/` must be followed by `npm run build` here, and the resulting `web/.gui/` diff committed together with the source change.** Commits that do this are tagged `- Release build;` in the git history.

The folder name starts with a dot so ComfyUI doesn't load the bundle as a separate extension script.

## Development

```bash
npm run dev
```

Rebuilds `web/.gui/` in development mode on every change. Reload the ComfyUI page to pick it up. Run `npm run build` before committing.

## Styles

Every rule in `styles/` is nested under `.qm-root` (see `styles/styles.scss`) so nothing leaks into the rest of ComfyUI. The only global rules are the `--qm-*` colour aliases in `styles/_variables.scss`, which map to ComfyUI's own theme variables.
