import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const excelSource = () => readFileSync(require.resolve("exceljs/dist/exceljs.min.js"));
const excelBrowserAsset = {
  name: "local-excel-reader",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "vendor/exceljs.min.js", source: excelSource() });
  },
  configureServer(server) {
    server.middlewares.use("/vendor/exceljs.min.js", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-cache");
      res.end(excelSource());
    });
  },
};
export default defineConfig({
  plugins: [react(), tailwindcss(), excelBrowserAsset],
  // Keep assets needed by organizer/display tabs that are still running an older build.
  build: { emptyOutDir: false },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
