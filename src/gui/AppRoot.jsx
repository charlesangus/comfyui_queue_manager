import { useEffect, useMemo, useState } from "react";

import Home from "./app/index.jsx";

import { ThemeProvider } from "@mui/material/styles";
import { buildTheme } from "./theme.js";

const isDark = () => document.documentElement.classList.contains("dark-theme");

export default function AppRoot() {
  const [dark, setDark] = useState(isDark);
  const theme = useMemo(() => buildTheme(dark), [dark]);

  // ComfyUI toggles `dark-theme` on <html> when the palette changes.
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider theme={theme} disableTransitionOnChange>
      <Home />
    </ThemeProvider>
  );
}
