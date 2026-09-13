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

- [ ] M8.P2.T1 — Add Vitest and tests for stores, models and helpers
  - files: `src/gui/package.json`, `src/gui/vite.config.js`, `src/gui/app/stores/appStore.test.js` (new), `src/gui/app/models/MediaOutputs.test.js` (new), `src/gui/app/internals/functions.test.js` (new)
  - approach: Add `vitest` and `@testing-library/react` + `jsdom` as devDependencies, a
    `"test": "vitest run"` script, and a `test: { environment: "jsdom" }` block in
    `vite.config.js`. Tests: `appStore` route/filter/shift setters; `MediaOutputs` flattens
    `images` and `gifs` outputs into files with the right `type`; `compareVersions` and
    `mediaType` from `internals/functions.js`. Keep `npm run lint` covering test files.
  - verify: `npm test` passes; `npm run lint` passes.
  - size: S

- [ ] M8.P2.T2 — Run the JS tests and lint in CI
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
