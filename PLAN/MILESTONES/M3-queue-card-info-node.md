# Milestone 3: Queue Card Info node

A new custom node, **Queue Card Info** (category "Queue Manager"), with one wildcard input
`value`, an INT `index` (default 1) that orders multiple instances on the card, and a STRING
`label`. Whatever is connected shows up on that job's card: a `LoadImage` gives a thumbnail of
the loaded file, a text/prompt node gives its text, an IMAGE tensor at runtime gives a thumbnail
of the actual image, and anything else degrades to a short textual description.

Two phases of data, both writing the same `meta` row (`key = 'card'`, JSON array in the contract
defined in M2):

1. **Static extraction at queue time** (`queue_put`): the prompt graph is scanned for
   `Queue Card Info` nodes and each one's `value` link is resolved *without executing anything*,
   so pending and archived cards are already informative.
2. **Runtime capture** (the node's `run`): when the job executes, each instance replaces its
   static entry with the real value if that value is renderable (image tensor → thumbnail saved
   under `data/cards/`, string/number → text); non-renderable values (LATENT, MODEL, CONDITIONING
   …) leave the static entry alone.

## Phase 3.1: Backend

- [x] M3.P1.T1 — Static extraction of card entries from a prompt graph
  - files: `src/comfyui_queue_manager/qm_card.py` (new), `tests/test_qm_card.py` (new)
  - approach: Pure function `extract_card_entries(prompt_graph: dict) -> list[dict]`. The graph is
    `{node_id: {"class_type": str, "inputs": {name: literal | [src_node_id, slot]}}}`. For every
    node whose `class_type == "Queue Card Info"`, build an entry with `index` (int, default 1),
    `label` (str, default ""), and resolve `inputs["value"]`: a literal → `kind: "text"`, `value:
    str(literal)`; a link → look at the source node: `class_type == "LoadImage"` (or
    `LoadImageMask`) → `kind: "image"`, `value: {filename, subfolder, type: "input"}` parsed from
    its `image` widget (strip a trailing ` [input|output|temp]` annotation into `type`, split
    the last `/` into `subfolder`/`filename`); otherwise, if the source node has any
    string-valued non-link input, `kind: "text"` with the longest such string (covers
    `CLIPTextEncode.text`, `PrimitiveStringMultiline.value`, most custom text nodes); otherwise
    `kind: "text"`, `value: "<class_type>"`, plus `"placeholder": true` so runtime capture may
    replace it. Return entries sorted by `(index, node_id)`; a missing/dangling link yields no
    entry. Unit-test each branch with hand-written graphs.
  - verify: `pytest tests/test_qm_card.py` passes; `ruff check .` passes.
  - size: S

- [ ] M3.P1.T2 — Persist card entries in `meta` and expose them on every queue read
  - files: `src/comfyui_queue_manager/qm_card.py`, `src/comfyui_queue_manager/qm_queue.py`, `tests/test_qm_queue.py`
  - approach: In `qm_card.py` add `save_card(db_id, entries)` (DELETE the existing `meta` row
    with `key='card'` for that `item_id`, then INSERT the JSON — `meta` has no unique constraint
    on `(item_id, key)`), `load_card(db_id)`, `load_card_by_prompt_id(prompt_id)`, and
    `merge_entry(prompt_id, entry)` (replace the entry with the same `index` — or the same
    `index` **and** `placeholder` semantics per the milestone intro — then save). In
    `qm_queue.queue_put`, after the `INSERT OR REPLACE`, call `extract_card_entries(item[2])`
    and `save_card` when non-empty (look up the row id by `prompt_id`). In `get_current_queue`,
    add `LEFT JOIN meta AS card ON queue.id = card.item_id AND card.key = 'card'` for every
    route and set `item[3]["card"] = json.loads(row["card"])` when present; for the `running`
    list (taken from `currently_running`), copy each tuple's `item[3]` dict and set `card` from
    `load_card_by_prompt_id`. Extend `tests/test_qm_queue.py` (M1 fixture): a `queue_put` with a
    graph containing a card node makes `get_current_queue` return `card` on the pending item.
  - verify: `pytest tests/` passes; `ruff check .` passes.
  - size: M

- [ ] M3.P1.T3 — The `Queue Card Info` node with runtime capture and thumbnail files
  - files: `src/comfyui_queue_manager/nodes.py`, `src/comfyui_queue_manager/qm_card.py`, `tests/test_nodes.py` (new)
  - approach: In `nodes.py` define `AnyType(str)` with `__ne__` returning `False` (the
    community wildcard idiom) and `class QueueCardInfo` with `INPUT_TYPES = {"required":
    {"value": (AnyType("*"), {}), "index": ("INT", {"default": 1, "min": 1, "max": 99}),
    "label": ("STRING", {"default": ""})}}`, `RETURN_TYPES = ()`, `OUTPUT_NODE = True`,
    `FUNCTION = "run"`, `CATEGORY = "Queue Manager"`, and `IS_CHANGED` returning
    `float("nan")` so the node re-executes every run even when its inputs are cached (otherwise
    a second job with identical inputs would never write its card). `run(value, index, label)`
    finds the running `prompt_id` the same way `WorkflowName.run` does (factor that lookup into
    a shared `current_running_item()` helper), then calls `qm_card.capture_runtime_value(
    prompt_id, index, label, value)`: a `torch.Tensor` with 4 dims (B,H,W,C) → take `[0]`,
    convert to PIL via the same `255. * tensor.cpu().numpy()` clip as core `PreviewImage`,
    `thumbnail((256, 256))`, save PNG to `data/cards/<prompt_id>_<index>.png`, entry
    `{"kind": "image", "value": {"url": "queue_manager/card-image?name=<file>"}}`; `str` /
    `int` / `float` / `bool` → `kind: "text"`; a `list` → recurse on its first element;
    anything else → return `None` (keep the static entry). When an entry results,
    `merge_entry(prompt_id, entry)` and `PromptServer.instance.send_sync(
    "queue-manager-queue-updated", {"card": prompt_id})`. Return `{"ui": {}}`. Register in
    `NODE_CLASS_MAPPINGS` as `"Queue Card Info"`. Import `torch` lazily inside the capture
    function so tests without torch still pass (skip the tensor test with `pytest.importorskip`).
  - verify: `pytest tests/` passes (node metadata, text capture writes `meta`, non-renderable
    value leaves the static entry); `ruff check .` passes.
  - size: M

- [ ] M3.P1.T4 — Serve card images and clean up orphaned ones
  - files: `src/comfyui_queue_manager/qm_server.py`, `src/comfyui_queue_manager/qm_card.py`, `src/comfyui_queue_manager/qm_queue.py`
  - approach: Add `GET /queue_manager/card-image?name=<file>` in `qm_server.py` that validates
    `name` against `^[A-Za-z0-9_-]+\.png$` (400 otherwise) and returns `web.FileResponse` from
    `data/cards/` (404 if missing), with `Cache-Control: max-age=31536000` since files are
    immutable per name. Add `qm_card.remove_card_images(prompt_ids)` and call it from
    `delete_items`, `delete_running`, `wipe_queue` and `delete_from_queue` in `qm_queue.py`
    (collect `prompt_id`s before deleting rows). Add `qm_card.prune_orphans()` that deletes
    every file in `data/cards/` whose `<prompt_id>` prefix has no `queue` row, called once from
    `QueueManager.__init__` after `init_schema()`.
  - verify: `pytest tests/` passes with a test for `prune_orphans` using the `qm_db` fixture and
    `tmp_path`; manual `curl` of the route returns the PNG; `ruff check .` passes.
  - size: M

## Phase 3.2: Frontend and docs

- [ ] M3.P2.T1 — Node documentation and README section
  - files: `web/docs/Queue Card Info.md` (new), `README.md`, `CHANGELOG.md`
  - approach: Write the node doc in the style of `web/docs/Workflow Name.md`: purpose, the three
    inputs, what shows for LoadImage / text nodes / image tensors / other types, note that the
    node re-executes every run and that runtime thumbnails live under `data/cards/`. Add a
    README manual section "Queue Card Info node" after "Workflow Name node" and a table-of-
    contents entry; add a CHANGELOG entry.
  - verify: Docs render in the ComfyUI node help panel (which reads `web/docs/<Node Name>.md`);
    README TOC link resolves.
  - size: S

- [ ] M3.P2.T2 — Release build and end-to-end check
  - files: `web/.gui/**`
  - approach: No GUI source change is expected (M2 already renders `item[3].card`, including
    `{url}` images); rebuild anyway so the shipped bundle matches source, and verify end-to-end
    in a ComfyUI instance: a workflow with `LoadImage → Queue Card Info(index 1)` and
    `CLIPTextEncode → Queue Card Info(index 2)` queued twice shows a thumbnail and the prompt
    text on both pending cards, and after execution the completed card still shows them. If a
    frontend fix is needed, make it here and note it in `## Decisions`.
  - verify: The end-to-end scenario above; `npm run build` committed.
  - size: S

**Verification gate:** `pytest tests/` and `ruff check .` green; the end-to-end scenario in
M3.P2.T2 passes in a ComfyUI instance; `web/docs/Queue Card Info.md` present; rebuilt
`web/.gui/` committed.

## Decisions

- 2026-09-11 — One node with a wildcard input and an `index` knob (user's call) rather than
  separate image/text nodes: fewer nodes in the menu, and the static+runtime resolution rule
  above covers the typical cases (LoadImage thumbnail, prompt text, decoded image thumbnail).
- 2026-09-11 — Runtime thumbnails are stored under the extension's own `data/cards/` and served
  by `/queue_manager/card-image` rather than written into ComfyUI's `output/` or `temp/`:
  `temp/` is wiped on restart (cards must survive restarts because the queue does) and
  `output/` is the user's; the `/view` endpoint only serves those two plus `input/`.
