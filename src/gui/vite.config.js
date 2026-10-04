import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// ComfyUI's app module, resolved relative to web/.gui/assets/index.js at runtime.
const COMFY_APP = "comfy/app";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname),
      },
    },

    // Library builds leave process.env alone, but React needs it resolved.
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode === "development" ? "development" : "production"),
    },

    esbuild: {
      loader: "jsx",
      include: [/src\/.*\.jsx?$/],
    },

    css: {
      devSourcemap: true,
    },

    build: {
      minify: false, // Keep generated JavaScript readable
      cssMinify: true,
      sourcemap: mode === "development",
      outDir: "../../web/.gui",
      emptyOutDir: true,
      lib: {
        entry: "main.jsx",
        formats: ["es"],
        fileName: () => "assets/index.js",
        cssFileName: "assets/index",
      },
      rollupOptions: {
        external: [COMFY_APP],
        output: {
          paths: { [COMFY_APP]: "../../../../scripts/app.js" },
        },
      },
    },

    test: {
      environment: "jsdom",
    },
  };
});
