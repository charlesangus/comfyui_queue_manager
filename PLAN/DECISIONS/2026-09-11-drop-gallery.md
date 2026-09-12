# The gallery is removed; the extension stays focused on queue management

At the user's request the full-screen Gallery lightbox, the cover/grid thumbnail modes, the
size sliders, every `QueueManager.Gallery.*` / `Completed.*ThumbMode` setting, `qm_gallery.py`
and the `open_location` route are removed (M7). Completed jobs keep their persisted outputs and
show them as a fixed-size thumbnail strip on the card, below the card-info area; clicking a
thumbnail opens the file's `/view` URL in a new tab. The Queue Card Info node (M3) is the way to
put arbitrary images on a card. Consequence: the server-side `options` table now holds only
server state (`queue_paused`, `splash_screen`, `takeover_client`) and native ComfyUI settings
are the single mechanism for user preferences.
