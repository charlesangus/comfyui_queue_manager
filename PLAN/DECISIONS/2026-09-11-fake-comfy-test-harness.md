# Backend tests run against a fake ComfyUI, not a ComfyUI checkout

The backend imports `server`, `execution`, `folder_paths` and `nodes` from a running ComfyUI. Rather
than requiring a ComfyUI checkout on `sys.path` for `pytest`, `tests/conftest.py` installs minimal
stand-ins (`tests/fake_comfy.py`) into `sys.modules` when the real modules are not importable.
Every milestone's backend behaviour (queue ordering, card persistence, priority, preemption) is
then unit-testable in CI and in this workspace, which has no ComfyUI install. Live-server checks
remain in each milestone's verification gate as manual end-to-end steps.
