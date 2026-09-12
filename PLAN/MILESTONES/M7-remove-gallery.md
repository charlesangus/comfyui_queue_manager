# Milestone 7: Remove the gallery

Drop the full-screen Gallery lightbox, the cover/grid thumbnail modes and their size sliders, the
`QueueManager.Gallery.*` and `Completed.*ThumbMode` settings, the `open_location` route and
`qm_gallery.py`. Completed jobs keep their persisted `outputs` (the `meta` row written in
`task_done`) and show them as a simple row of fixed-size thumbnails; clicking a thumbnail opens
the file's `/view` URL in a new tab. Also trims the server-side `options` table to genuine server
state (`queue_paused`, `splash_screen`, `takeover_client`) so native ComfyUI settings become the
single mechanism for user preferences, and removes the dead code found during planning. Runs
before M2 so the card component is built from the trimmed row, not the gallery-era one.

## Phase 7.1: Backend

- [x] M7.P1.T1 — Remove `QM_Gallery`, `open_location`, and gallery options
  - files: `src/comfyui_queue_manager/qm_gallery.py` (delete), `src/comfyui_queue_manager/queue_manager.py`, `src/comfyui_queue_manager/qm_server.py`, `src/comfyui_queue_manager/qm_queue.py`, `src/comfyui_queue_manager/helpers.py`
  - approach: Delete `qm_gallery.py` and the `QM_Gallery(self)` construction in
    `queue_manager.py`; drop `self.gallery` in `QM_Server.__init__` and the
    `/queue_manager/open_location` route; delete `QM_Queue.open_file_location` and
    `helpers.reveal_file` (its only caller). Shrink `allowed_options` to `queue_paused` and
    `splash_screen` and delete the `thumb_size`/`thumb_mode`/`cover_size`/`show_gallery_ui`
    validation branches in `set_options`. Leave `task_done`'s `outputs` persistence and the
    `completed` join in `get_current_queue` untouched — thumbnails still need them.
  - verify: `pytest tests/` and `ruff check .` pass; `grep -rn "gallery\|thumb_\|cover_size\|
    open_location" src/comfyui_queue_manager` returns nothing.
  - size: S

## Phase 7.2: Frontend

- [x] M7.P2.T1 — Delete the Gallery components, styles, settings and parent-page hooks
  - files: `src/gui/app/components/Gallery.jsx` (delete), `src/gui/app/components/GalleryProgressBar.jsx` (delete), `src/gui/app/components/ThumbSlider.jsx` (delete), `src/gui/styles/_gallery.scss` (delete), `src/gui/styles/styles.scss`, `web/js/settings.js`, `web/js/functions.js`, `web/styles/manager.css`
  - approach: Remove the three components and the SCSS partial (and its `@use` in
    `styles.scss`). In `settings.js` delete `QueueManager.Completed.GridThumbMode`,
    `QueueManager.Completed.CoverThumbMode` and every `QueueManager.Gallery.*` entry; keep
    `Basic.*` and `Completed.ListOrder`. In `functions.js` delete the `QM_Gallery_Show`,
    `QM_Gallery_Close` and `QM_LoadWorkflowFromImage` branches of `handleIframeMessages`; in
    `manager.css` delete the `.comfyui-gallery-overlay*` and `body.show-qm-fullscreen` rules.
  - verify: `npm run lint` reports no unresolved imports (the app will not compile until T2 —
    run lint after T2 if needed, but keep this commit self-contained by removing every import
    of the deleted files in the same change).
  - size: S

- [ ] M7.P2.T2 — Strip gallery state from `index.jsx`, the stores and the models
  - files: `src/gui/app/index.jsx`, `src/gui/app/stores/appStore.js`, `src/gui/app/stores/optionsStore.js`, `src/gui/app/models/MediaOutputs.js`, `src/gui/app/models/OrderedMap.js` (delete if unused), `src/gui/app/internals/app-context.jsx`
  - approach: In `index.jsx` remove the gallery `mode`, `galleryData`, `onMediaItemClick`, the
    `QM_Gallery_Show` postMessage, the `ThumbSlider`s and the thumb-mode toggle in the footer,
    and the `thumb_size`/`cover_size`/`thumb_mode`/`show_gallery_ui` option calls; remove
    `onMediaItemClick` from `AppContext`. In `appStore.js` drop `mode`/`setMode`; in
    `optionsStore.js` drop `Gallery`, the thumb fields and `Completed.*ThumbMode` (keep
    `Basic`, `Completed.ListOrder`). Reduce `MediaOutputs` to "flatten `outputs` into an ordered
    list of `{filename, subfolder, type}` files, images and videos alike" (no option filtering,
    no `cover`); delete `OrderedMap.js` if nothing else imports it.
  - verify: `npm run lint` and `npm run build` pass; in `npm run dev` the queue, archive and
    completed tabs load and the footer shows only pagination and the bulk buttons.
  - size: M

- [ ] M7.P2.T3 — Completed rows show output thumbnails that open in a new tab
  - files: `src/gui/app/components/QueueItemRow.jsx`, `src/gui/app/components/Queue.jsx`, `src/gui/app/components/MediaItem.jsx`, `src/gui/styles/_queue.scss`
  - approach: Replace the `showCover`/`showGrid` branches in `QueueItemRow` with one
    `.outputs` flex-wrap under the row (completed route only) rendering `MediaItem` for every
    file in `MediaOutputs.files` at a fixed CSS size (`--qm-thumb: 96px`), `controls={false}`,
    no autoplay, `onClick` → `window.open(viewURL, "_blank")`. Give `MediaItem` an exported
    `viewURL(file)` helper (it already builds the `/view` URL) and honour `file.type` instead of
    hard-coding `output`. Remove the Thumbnail `<th>` and the `cover-*`/`grid-*` wrapper classes
    from `Queue.jsx`; delete the corresponding `--thumb-size`/`--cover-size`/`.cover`/`.grid`
    rules from `_queue.scss`.
  - verify: In `npm run dev` against ComfyUI, a completed job with two images shows two
    thumbnails; clicking one opens the full image in a new tab; videos show a poster frame.
  - size: S

## Phase 7.3: Dead code, docs, release

- [ ] M7.P3.T1 — Remove dead code and unused config
  - files: `web/js/archive.js` (delete), `web/js/config.js`, `src/gui/app/layout.js` (delete), `web/queue-manager.js`
  - approach: Delete `web/js/archive.js` (fully commented out) and `src/gui/app/layout.js`
    (empty); remove `QM_GALLERY_PROD_URL`/`QM_GALLERY_DEV_URL` and any gallery URL switch from
    `config.js`; remove any import of the deleted files from `web/queue-manager.js`.
  - verify: `grep -rn "archive.js\|GALLERY" web/ src/gui/app` (excluding `web/.gui`) is empty;
    the extension still loads in ComfyUI (sidebar tab appears).
  - size: S

- [ ] M7.P3.T2 — README, changelog, release build
  - files: `README.md`, `CHANGELOG.md`, `web/.gui/**`
  - approach: Remove the "Gallery / output previews" and "Gallery view" manual sections and
    their TOC entries; rewrite "Extension Settings" to list only the remaining settings; update
    "Features" and strike the thumbnails roadmap line to say outputs show as thumbnails on
    completed jobs. Changelog entry "Removed the gallery; completed jobs show output thumbnails
    that open in a new tab." `npm run build`; commit `web/.gui/`.
  - verify: README has no "Gallery" heading; rebuilt bundle in `git status`.
  - size: S

**Verification gate:** `pytest tests/`, `ruff check .`, `npm run lint`, `npm run build` all pass;
`grep -rni gallery` over `src/`, `web/js`, `web/queue-manager.js`, `web/styles` is empty; manual
check in ComfyUI that all three tabs work and completed thumbnails open in a new tab; rebuilt
`web/.gui/` committed.

## Decisions

- 2026-09-11 — Gallery dropped entirely (lightbox, thumbnail modes, sliders, settings) at the
  user's request to keep the extension focused on queue management; completed jobs keep a plain
  thumbnail strip (user's call), so `outputs` persistence stays.
- 2026-09-11 — Settings consolidation resolves itself once the gallery options go: the
  `options` table keeps only server state, native ComfyUI settings hold every user preference.
  No further migration needed.
