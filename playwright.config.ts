import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e", workers: 1, fullyParallel: false, timeout: 60_000, globalTimeout: 900_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3100", locale: "ru-RU", trace: "off", video: "off", screenshot: "only-on-failure", actionTimeout: 10_000, navigationTimeout: 30_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    ...[320,375,390,430].map(width=>({name:`mobile-${width}`,use:{...devices["Pixel 7"],viewport:{width,height:844}}})),
    {name:'webkit-desktop',testMatch:['customer-journey.spec.ts','resilience.spec.ts','professional-ui.spec.ts','catalog-startup.spec.ts'],use:{...devices['Desktop Safari']}},
    {name:'webkit-mobile',testMatch:['customer-journey.spec.ts','resilience.spec.ts','professional-ui.spec.ts','catalog-startup.spec.ts'],use:{...devices['iPhone 13']}},
  ],
  webServer: { command: "node scripts/start-standalone.mjs", url: "http://localhost:3100/api/health",
    reuseExistingServer: false, timeout: 120_000 },
});
