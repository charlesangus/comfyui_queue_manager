# Local ComfyUI v0.35.1 instance for manual verification

Answers the open question "which ComfyUI instance should be used for manual verification".

**Superseded 2026-09-12:** the instance moved from `~/ComfyUI` to `<repo>/.local/ComfyUI`
(gitignored) after a container reboot wiped the original `~/ComfyUI` checkout — only the repo
directory itself survives a reboot in this sandbox. All commands below are relative to the repo
root; see `memory/comfyui-test-instance.md` for the rebuild recipe if `.local/ComfyUI` is ever
missing again.

- Install: `<repo>/.local/ComfyUI` (git checkout of tag `v0.35.1`, shallow), venv at
  `.local/ComfyUI/.venv` (Python 3.11, torch 2.14 CPU-capable wheel from PyPI — no GPU on this
  machine). Frontend package `comfyui-frontend-package 1.51.10`.
- This repo is symlinked as `.local/ComfyUI/custom_nodes/comfyui_queue_manager`, so code changes
  are live after a server restart (backend) or a GUI rebuild (`npm run build` in `src/gui/`).
- Start: `cd .local/ComfyUI && .venv/bin/python main.py --cpu --listen 127.0.0.1 --port 8188
  --enable-cors-header http://localhost:3000` (the CORS flag is what `npm run dev` on port 3000
  needs). Log to `/tmp/comfy-server.log`. Stop with `pkill -f "ComfyUI/main.py"`.
- Verified endpoints once up: `GET /queue_manager/version`, `GET /queue_manager/queue`,
  `/extensions/comfyui_queue_manager/queue-manager.js`, `/extensions/comfyui_queue_manager/.gui/index.html`,
  `/object_info/Workflow%20Name`.
- CPU only: use tiny workflows for end-to-end checks (e.g. `LoadImage → PreviewImage`, or a
  `EmptyLatentImage → VAEDecode` at 64×64 with a small VAE) — no model checkpoints are installed;
  download only what a test needs into `.local/ComfyUI/models/`.
- Browser-driven checks (palette switching, partial execution from the canvas, screenshots) need a
  browser pointed at `http://127.0.0.1:8188`; the PM should use a headless-browser MCP/tool if one
  is available in the session, otherwise perform the API-level equivalent and flag the visual step
  for the user.
