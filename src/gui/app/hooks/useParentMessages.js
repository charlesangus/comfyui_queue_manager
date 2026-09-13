import { useEffect } from "react";
import useEvent from "react-use-event-hook";
import { baseURL } from "../internals/config";
import { useAppStore } from "../stores/appStore";
import { useOptionsStore } from "../stores/optionsStore";
import {
  QM_QUEUE_STATUS_UPDATED,
  QM_PARENT_KEYPRESS,
  QM_QUEUE_MANAGER_HELLO,
  QM_SETTING_CHANGED,
} from "../internals/parentBridge";

export function useParentMessages({ onQueueStatusUpdated, onSettingChanged, onHello } = {}) {
  const setShiftDown = useAppStore((state) => state.setShiftDown);
  const options = useOptionsStore((state) => state);
  const setAllOptions = useOptionsStore((state) => state.setAllOptions);
  const setOption = useOptionsStore((state) => state.setOption);

  const handleMessage = useEvent((event) => {
    if (event.origin !== (baseURL === '/' ? window.location.protocol + "//" + window.location.host : baseURL.replace(/\/+$/, ""))) {
      return;
    }

    switch (event.data.type) {
      case QM_QUEUE_STATUS_UPDATED:
        onQueueStatusUpdated?.(event);
        break;
      case QM_PARENT_KEYPRESS: {
          const keypress = event.data.message;
          if (keypress && keypress.key === "Shift") {
            setShiftDown(keypress.isDown);
          }
        }
        break;
      case QM_QUEUE_MANAGER_HELLO:
        useAppStore.getState().setClientId(event.data.clientId);
        setAllOptions({...event.data.settings});
        onHello?.(event);
        break;
      case QM_SETTING_CHANGED: {
          const settingPath = event.data.message.setting.split('.');
          let current = options;
          let exists = true;
          for (const segment of settingPath) {
            if (Object.prototype.hasOwnProperty.call(current, segment)) {
              current = current[segment];
            } else {
              exists = false;
            }
          }

          const CategorySlug = settingPath[0];
          const SettingKey = settingPath[1];

          if (exists) {
            setOption(CategorySlug, SettingKey, event.data.message.newValue);
          }

          onSettingChanged?.(event);
        }
        break;
    }
  });

  useEffect(() => {
    window.addEventListener("message", handleMessage);

    window.parent.postMessage(
      { type: QM_QUEUE_MANAGER_HELLO },
      "*"
    );

    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);
}
