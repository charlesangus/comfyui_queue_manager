import React from "react";
import ReactDOM from "react-dom/client";

import AppRoot from "./AppRoot.jsx";

import "./styles/tailwind.css";

import "./styles/styles.scss";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
