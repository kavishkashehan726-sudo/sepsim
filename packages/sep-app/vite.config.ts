import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Relative asset paths so the build also loads from file:// inside the desktop shells.
  base: "./",
  build: {
    // Electron 22 (the shell for Windows 7 and 8) ships Chromium 108.
    target: "chrome108",
    chunkSizeWarningLimit: 4000,
  },
  worker: { format: "es" },
});
