import { useMemo, useState } from "react";

import Home from "./app/index.jsx";

import { ThemeProvider } from "@mui/material/styles";
import { buildTheme } from "./theme.js";

export default function AppRoot() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark-theme"));
  const theme = useMemo(() => buildTheme(dark), [dark]);

  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      <Home onDarkChange={setDark} />
    </ThemeProvider>
  );
}
