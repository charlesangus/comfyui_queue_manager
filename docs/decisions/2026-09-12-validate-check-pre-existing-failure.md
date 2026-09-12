# "Validate backwards compatibility" CI check fails, pre-existing and unrelated to M1

GitHub Actions was disabled on this fork until the user enabled it during M1's shipping step
(2026-09-12). On the first-ever run, `.github/workflows/validate.yml`'s `comfy-org/node-diff@main`
step failed: `❌ Error loading nodes: No module named 'execution'` — it imports the node package
directly, without a real ComfyUI install or any stub, so any commit that imports `server`/
`execution`/`folder_paths` at module level (which `qm_queue.py` and `nodes.py` have always done,
unchanged by M1) fails it. This is structural and pre-existing, not something M1's changes
caused — M1 didn't touch any top-level import in `qm_queue.py`/`nodes.py`. The repo's `main`
branch has no branch protection rule requiring this check, so it doesn't block merging.

The `comfyui_queue_manager CI build` workflow (the one M1's Context section describes: `ruff
check .` and `pytest tests/`) passed cleanly on Python 3.12, which is what M1's verification
gate actually cares about.

**Follow-up (not part of M1):** either fix `node-diff`'s environment (it may need a ComfyUI
install or a stub package in its own setup step), or remove `validate.yml` if this fork doesn't
intend to publish to the Comfy registry (see the still-open board question about fork metadata
under `[project.urls]`/`[tool.comfy] Icon`). Left as-is; flag for the user's own decision on the
registry-publishing question, and address the workflow at that time.
