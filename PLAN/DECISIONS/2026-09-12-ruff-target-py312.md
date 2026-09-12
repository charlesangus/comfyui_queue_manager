# ruff target-version bumped from py39 to py312

`ruff check .` failed repo-wide (`invalid-syntax` on `match`/`case` in `qm_queue.py` and
`qm_server.py`) even on a clean `main` checkout, discovered while verifying M1.P1.T1's `ruff
check .` step. `pyproject.toml` had `[tool.ruff] target-version = "py39"`, but no
`requires-python` constraint exists anywhere, and CI (`.github/workflows/build-pipeline.yml`)
actually runs Python 3.12. The `py39` target was stale template config, not a deliberate
supported-version floor — nothing in the project claims 3.9 support elsewhere. Fixed by bumping
`target-version` to `"py312"` (M1.P3.T2), and updated the board's Context line to state the
real target instead of the stale one.
