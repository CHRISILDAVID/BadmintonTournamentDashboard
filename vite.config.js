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
const offlineShell = {
  name: "prepared-scoring-shell",
  generateBundle(_, bundle) {
    const files = ["/", "/manifest.webmanifest", "/icon.jpg", ...Object.keys(bundle).map(name => `/${name}`)];
    const version = Date.now().toString(36);
    this.emitFile({ type: "asset", fileName: "sw.js", source: `
const CACHE = "shuttlehub-shell-${version}";
const FILES = ${JSON.stringify(files)};
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("shuttlehub-shell-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || u.pathname.startsWith("/api/") || e.request.method !== "GET") return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => r.ok ? r : caches.open(CACHE).then(c => c.match("/")).then(hit => hit || r)).catch(() => caches.open(CACHE).then(c => c.match("/")))); return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
` });
  },
};
export default defineConfig(({ mode }) => ({
  define: { __SHUTTLE_CLOUD__: mode === "cloud" },
  plugins: [react(), tailwindcss(), excelBrowserAsset, ...(mode === "cloud" ? [offlineShell] : [])],
  // Keep assets needed by organizer/display tabs that are still running an older build.
  build: { emptyOutDir: false },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
}));
