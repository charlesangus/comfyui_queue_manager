# Milestone 8: Frontend refactor and a JS test runner

`src/gui/app/index.jsx` (~960 lines before M7) owns the queue fetch loop, the parent-window
message protocol, the footer with its bulk actions and pagination, the splash screen and the
upload/import flow. M4 has to add selection state and an action bar to it, so split it first into
hooks and components with single responsibilities, and add Vitest so the stores, models and pure
helpers get unit tests (the project has no JS test runner today). Behaviour must not change —
this milestone is a pure move.

## Phase 8.1: Split `index.jsx`

- [x] M8.P1.T1 — Extract the parent-window message protocol into `useParentMessages`
  - files: `src/gui/app/hooks/useParentMessages.js` (new), `src/gui/app/internals/parentBridge.js` (new), `src/gui/app/index.jsx`
  - approach: Move `handleMessage` and the `window.addEventListener("message", …)` effect into
    a hook `useParentMessages({ onQueueStatusUpdated, onSettingChanged, onHello })` that keeps
    the `QM_QueueManager_Hello` handshake, `QM_ParentKeypress` shift tracking (writes to
    `appStore.shiftDown`) and `QM_Setting_Changed` → `optionsStore` sync. Put the outbound
    postMessage helpers (`msgLoadWorkflow` from `internals/functions.js`, the Hello request) in
    `parentBridge.js` with the message type names as exported constants, used by both sides of
    the iframe boundary (`web/js/functions.js` keeps its own copy of the strings — note the
    coupling in a comment there).
  - verify: `npm run lint` and `npm run build` pass; in `npm run dev` the Hello handshake still
    populates `clientId` and settings, Shift still shows the "front of queue" indicator.
  - size: M

- [x] M8.P1.T2 — Extract queue fetching and progress into `useQueue`
  - files: `src/gui/app/hooks/useQueue.js` (new), `src/gui/app/index.jsx`
  - approach: Move `appStatus`, `currentJob`/progress, `fetchQueueItems`, `appendFilters`,
    `appendRoute`, `isFilterOn`, `onQueueStatusUpdated` and the node-progress bookkeeping into
    `useQueue()` returning `{ data, isLoading, error, progress, fetchQueueItems, isFilterOn }`.
    `index.jsx` composes `useQueue` + `useParentMessages`. Keep `AppContext` exposing
    `fetchQueueItems` and `openSplash` so `QueueCard` is untouched.
  - verify: `npm run lint`/`npm run build` pass; running-job progress bar and page navigation
    behave as before in `npm run dev`.
  - size: M

- [x] M8.P1.T3 — Extract the footer, pagination and import/export into components
  - files: `src/gui/app/components/Footer.jsx` (new), `src/gui/app/components/Pagination.jsx` (new), `src/gui/app/components/ImportExport.jsx` (new), `src/gui/app/index.jsx`
  - approach: Move the footer JSX (Archive All / Delete All / Run All / Export per route, the
    `*` filtered-view marker, the front-of-queue indicator), the pagination controls, and
    `uploadQueue` + the export link building into the three components, each receiving what
    it needs as props from `index.jsx` (`route`, `isFilterOn`, `fetchQueueItems`, `data.info`).
    After this task `index.jsx` should be under ~200 lines: store wiring, hooks, layout.
  - verify: `npm run lint`/`npm run build` pass; every footer action still works in `npm run
    dev` (archive all, delete all, run all with and without Shift, export, import).
  - size: M

## Phase 8.2: Tests

- [x] M8.P2.T3 — Fix pre-existing lint errors blocking the milestone gate
  - files: `src/gui/eslint.config.mjs`, `src/gui/app/components/MediaItem.jsx`, `src/gui/app/components/SplashScreen.jsx`
  - approach: `npm run lint` currently fails with 4 errors that predate M8 entirely (trace to
    M2/M7/pre-fork commits, confirmed via `git log`/`git stash`): a missing `<track>` on a
    media element in `MediaItem.jsx`, an unescaped apostrophe in `SplashScreen.jsx`, and
    `process`/`__dirname` `no-undef` in `app/internals/config.js`/`vite.config.js` because
    `eslint.config.mjs` applies only `globals.browser` everywhere. Fix each at its root cause
    (add a `<track kind="captions" />`, escape the apostrophe, scope Node globals to
    Node-context config files in `eslint.config.mjs`) rather than suppressing. Do not touch the
    7 pre-existing warnings — out of scope.
  - verify: `npm run lint` exits 0 with 0 errors; `npm test` and `npm run build` still pass.
  - size: S

- [x] M8.P2.T1 — Add Vitest and tests for stores, models and helpers
  - files: `src/gui/package.json`, `src/gui/vite.config.js`, `src/gui/app/stores/appStore.test.js` (new), `src/gui/app/models/MediaOutputs.test.js` (new), `src/gui/app/internals/functions.test.js` (new)
  - approach: Add `vitest` and `@testing-library/react` + `jsdom` as devDependencies, a
    `"test": "vitest run"` script, and a `test: { environment: "jsdom" }` block in
    `vite.config.js`. Tests: `appStore` route/filter/clientId/shift setters; `MediaOutputs`
    flattens `images`/`gifs`/`files` outputs into `.files` with the right `filename`/
    `subfolder`/`type`, and `.total`; `compareVersions` from `internals/functions.js`
    (`mediaType` no longer exists there — removed with the gallery in M7; dropped from this
    task, see `## Decisions`). Keep `npm run lint` covering test files.
  - verify: `npm test` passes; `npm run lint` passes.
  - size: S

- [x] M8.P2.T2 — Run the JS tests and lint in CI
  - files: `.github/workflows/build-pipeline.yml`
  - approach: Add a job `gui` (ubuntu, `actions/setup-node@v4` with node 24, working directory
    `src/gui`) running `npm ci`, `npm run lint`, `npm test`, `npm run build`, and failing if
    `git diff --quiet -- ../../web/.gui` is non-empty (the committed bundle must match source).
    If that diff check proves non-deterministic across node versions, drop it and record why
    in `## Decisions`. Keep the Python job unchanged.
  - verify: The workflow YAML validates (`gh workflow view` or `actionlint` if available) and
    the milestone PR's checks show both jobs green.
  - size: S

**Verification gate:** `npm run lint`, `npm test`, `npm run build` green and the rebuilt
`web/.gui/` committed (pure move: no visual or behavioural change in a manual pass over all
three tabs); `pytest tests/` and `ruff check .` green; both CI jobs green on the PR;
`index.jsx` under ~200 lines.

## Decisions

- 2026-09-13 — Freshness check (§5a) before promoting M8 to `doing`: all files named in every
  task's `files` list exist and the approach descriptions matched current code, with one
  exception — `internals/functions.js` no longer exports `mediaType` (removed along with the
  gallery lightbox in M7, which was its only caller). Dropped it from M8.P2.T1's test list
  rather than re-adding a helper with no production caller just to test it.
- 2026-09-13 — `index.jsx` landed at 245 lines after Phase 8.1 (M8.P1.T1-T3), not the ~200
  the milestone estimated. The remainder is irreducible store wiring, the mount effect, and
  tab/filter layout that doesn't cleanly fit any of the three extracted components or
  `useQueue`/`useParentMessages`; forcing a fourth split would fragment closely-related layout
  code for no reuse benefit. Accepted as close enough to the intent (single-responsibility
  hooks/components, no god-file) rather than a literal line-count target.
- 2026-09-13 — At M8.P2.T1 start, found `npm run lint` already failing with 4 errors
  pre-dating M8 (M2/M7/pre-fork), which would break M8.P2.T2's new CI job and the milestone's
  own verification gate. User decided (asked via AskUserQuestion) to fix now rather than
  relax the gate; added M8.P2.T3 to cover it. Also found the uncommitted-but-not-yet-landed
  M8.P2.T1 work (test files + vitest config) already present in the working tree from a prior
  session, pinning `vitest@^2.0.0` which doesn't support Vite 7 as a peer — bumped to `^3.2.7`
  as part of completing T1.
- 2026-09-13 — M8.P2.T1 landed without `@testing-library/react`: the tests written cover
  `appStore` (Zustand setters), `MediaOutputs` (pure model), and `compareVersions`
  (pure helper) — none render a component, so the dependency wasn't needed. Dropped it
  rather than adding an unused devDependency.
- 2026-09-13 — M8.P2.T2's `git diff --quiet -- ../../web/.gui` staleness check was kept
  (verified locally: deterministic, byte-identical rebuild, sourcemap uses relative not
  absolute paths) rather than dropped per the task's fallback clause. Watch the milestone
  PR's first real CI run for a false positive before trusting it long-term — it's only been
  verified on one machine/Node version, not GitHub's actual runner.
