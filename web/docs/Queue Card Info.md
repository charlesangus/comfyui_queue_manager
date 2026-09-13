Adds information from a workflow to its Queue Manager card.

### Usage:
Drop Queue Card Info into your workflow, connect a value to its `value` input, and optionally set `index` and `label`.

### Use case:
Use Queue Card Info to show useful values alongside a queued job. For example, connect a prompt or an image to the node to display it on the job's card.

The card gets a static preview when the job is queued. Literal values are shown as text. For `LoadImage` and `LoadImageMask`, the selected file is shown as an image. For another linked node, the longest string input is shown when one is available.

When the workflow runs, the node executes on every run and replaces its static entry when it can capture the runtime value. Runtime `IMAGE` tensors are shown as thumbnails. Scalar values are shown as text, and lists use their first element. Unsupported or non-renderable runtime values leave the static preview in place.

Runtime thumbnails are stored under `data/cards` while their queue items exist and are cleaned up with those queue items.

### Inputs:

| Name      | Type       | Description                                      |
|-----------|------------|--------------------------------------------------|
| `value`   | `*`        | Value to display on the queue card               |
| `index`   | `INT`      | Card position from 1 to 99 (default: 1)          |
| `label`   | `STRING`   | Caption displayed with the value (default: empty) |
