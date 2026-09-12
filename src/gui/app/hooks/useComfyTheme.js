import { useEffect } from "react";
import { baseURL } from "../internals/config";

function applyTheme({ vars, fontFamily, fontSize, dark }) {
  const root = document.documentElement;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
  }

  if (fontFamily) {
    root.style.setProperty("--qm-font-family", fontFamily);
    document.body.style.fontFamily = fontFamily;
  }

  if (fontSize) {
    document.body.style.fontSize = fontSize;
  }

  root.classList.toggle("dark-theme", !!dark);
}

export function useComfyTheme(onDarkChange) {
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== (baseURL === '/' ? window.location.protocol + "//" + window.location.host : baseURL.replace(/\/+$/, ""))) {
        return;
      }

      if (event.data.type === "QM_Theme") {
        applyTheme(event.data);
        onDarkChange?.(!!event.data.dark);
      }

      if (event.data.type === "QM_QueueManager_Hello" && event.data.vars) {
        applyTheme(event.data);
        onDarkChange?.(!!event.data.dark);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onDarkChange]);
}
