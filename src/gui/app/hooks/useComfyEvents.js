import { useEffect } from "react";
import useEvent from "react-use-event-hook";
import { app } from "comfy/app";
import { useOptionsStore } from "../stores/optionsStore";

const STATUS_EVENTS = ["status", "execution_start", "execution_cached", "executing", "queue-manager-queue-updated"];

// QueueManager.* settings the GUI reads, as [category, key].
const SETTINGS = [["Basic", "PageSize"], ["Completed", "ListOrder"]];

export function useComfyEvents({ onQueueStatusUpdated }) {
  const setOption = useOptionsStore((state) => state.setOption);

  const handleStatus = useEvent((event) => onQueueStatusUpdated(event.type, event.detail));

  useEffect(() => {
    for (const name of STATUS_EVENTS) {
      app.api.addEventListener(name, handleStatus);
    }
    return () => {
      for (const name of STATUS_EVENTS) {
        app.api.removeEventListener(name, handleStatus);
      }
    };
  }, [handleStatus]);

  useEffect(() => {
    const listeners = SETTINGS.map(([category, key]) => {
      const id = `QueueManager.${category}.${key}`;
      setOption(category, key, app.extensionManager.setting.get(id));

      const listener = (event) => setOption(category, key, event.detail.value);
      app.ui.settings.addEventListener(`${id}.change`, listener);
      return [`${id}.change`, listener];
    });

    return () => {
      for (const [name, listener] of listeners) {
        app.ui.settings.removeEventListener(name, listener);
      }
    };
  }, [setOption]);
}
