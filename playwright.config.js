import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.CLOUD_TEST_ORIGIN || "http://127.0.0.1:8799", headless: true,
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    viewport: { width: 1280, height: 800 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  reporter: [["list"], ["html", { open: "never", outputFolder: "output/playwright/report" }]],
});
