import React from "react";
import ReactDOM from "react-dom/client";

import AppRoot from "./AppRoot.jsx";

import "./styles/styles.scss";

const STYLESHEET_ID = "comfyui-queue-manager-gui-stylesheet";

/**
 * Mounts the Queue Manager into the given sidebar element and returns a function that unmounts it.
 */
export function mountQueueManager(el) {
  if (!document.getElementById(STYLESHEET_ID)) {
    const link = document.createElement("link");
    link.id = STYLESHEET_ID;
    link.rel = "stylesheet";
    link.href = import.meta.url.replace(/index\.js$/, "index.css");
    document.head.appendChild(link);
  }

  const root = ReactDOM.createRoot(el);
  root.render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>
  );
  return () => root.unmount();
}
