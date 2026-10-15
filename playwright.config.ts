import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e", workers: 1, fullyParallel: false, timeout: 60_000, globalTimeout: 300_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3100", locale: "ru-RU", trace: "off", video: "off", screenshot: "only-on-failure", actionTimeout: 10_000, navigationTimeout: 30_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node scripts/start-standalone.mjs", url: "http://localhost:3100/api/health",
    reuseExistingServer: false, timeout: 120_000 },
});
