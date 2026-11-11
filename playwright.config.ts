import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e", workers: 1, fullyParallel: false, timeout: 60_000, globalTimeout: 900_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3100", locale: "ru-RU", trace: "off", video: "off", screenshot: "only-on-failure", actionTimeout: 10_000, navigationTimeout: 30_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    ...[320,375,390,430].map(width=>({name:`mobile-${width}`,use:{...devices["Pixel 7"],viewport:{width,height:844}}})),
    {name:'firefox-navigation',testMatch:['safari-navigation.spec.ts'],use:{...devices['Desktop Firefox']}},
    {name:'webkit-desktop',testMatch:['rutube-links.spec.ts','safari-navigation.spec.ts','customer-journey.spec.ts','resilience.spec.ts','professional-ui.spec.ts','catalog-startup.spec.ts','production-bootstrap.spec.ts','final-client-ux.spec.ts','compact-calendar.spec.ts'],use:{...devices['Desktop Safari']}},
    {name:'webkit-narrow',testMatch:['compact-calendar.spec.ts'],use:{...devices['iPhone SE'],viewport:{width:320,height:568}}},
    {name:'webkit-mobile',testMatch:['rutube-links.spec.ts','safari-navigation.spec.ts','customer-journey.spec.ts','resilience.spec.ts','professional-ui.spec.ts','catalog-startup.spec.ts','production-bootstrap.spec.ts','final-client-ux.spec.ts','compact-calendar.spec.ts'],use:{...devices['iPhone 13']}},
  ],
  webServer: { command: "node scripts/start-standalone.mjs", url: "http://localhost:3100/api/health",
    reuseExistingServer: false, timeout: 120_000 },
});
