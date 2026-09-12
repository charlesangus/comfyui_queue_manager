# npm registry reachable again — GUI build blocker lifted

Resolves the board's open question "GUI builds are blocked in this workspace."

`registry.npmjs.org` responds 200 from this sandbox as of 2026-09-12 (re-checked with a plain
`curl`), matching the user's earlier note that access was unblocked on 2026-09-11. `src/gui/`
has no `node_modules/` yet, so the first milestone that touches `src/gui/` should run
`npm install` there before `npm run build`. If a future session hits registry failures again,
re-check with `curl -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/` before
assuming the blocker is back — don't skip GUI milestones on stale information.
