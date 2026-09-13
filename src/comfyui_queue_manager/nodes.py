from __future__ import annotations

from inspect import cleandoc
from typing import Any, Dict

from server import PromptServer

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


def current_running_item():
    return next(iter(PromptServer.instance.prompt_queue.currently_running.values()), None)


class WorkflowName:
    """
    Emits the currently running workflow's name.
    """

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        # no sockets, no UI fields
        return {"required": {}}

    RETURN_TYPES = ("STRING",)  # socket type
    RETURN_NAMES = ("workflow_name",)  # socket label
    FUNCTION = "run"  # method to call
    CATEGORY = "Queue Manager"  # node menu group
    DESCRIPTION = cleandoc(__doc__)  # node tooltip

    def run(self):
        running = current_running_item()

        if running is not None:
            wf_name = (
                running[3]  # prompt_options dict
                .get("extra_pnginfo", {})
                .get("workflow", {})
                .get("workflow_name", "")
            )
            if wf_name:
                # If the workflow name is set, return it
                return (wf_name,)
        # If no workflow is running or the name is not set, return an empty string
        return ("",)


class QueueCardInfo:
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        return {
            "required": {
                "value": (AnyType("*"), {}),
                "index": ("INT", {"default": 1, "min": 1, "max": 99}),
                "label": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "run"
    CATEGORY = "Queue Manager"

    @classmethod
    def IS_CHANGED(cls, *args, **kwargs):
        return float("nan")

    def run(self, value, index, label):
        running = current_running_item()
        if running is not None:
            from . import qm_card

            prompt_id = running[1]
            entry = qm_card.capture_runtime_value(prompt_id, index, label, value)
            if entry is not None:
                qm_card.merge_entry(prompt_id, entry)
                PromptServer.instance.send_sync("queue-manager-queue-updated", {"card": prompt_id})
        return {"ui": {}}


NODE_CLASS_MAPPINGS = {
    "Queue Card Info": QueueCardInfo,
    "Workflow Name": WorkflowName,
}
NODE_DISPLAY_NAME_MAPPINGS = {}
