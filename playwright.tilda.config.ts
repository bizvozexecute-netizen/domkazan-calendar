import {defineConfig,devices} from '@playwright/test';

// Explicit, opt-in smoke suite: never navigate to or edit a working Tilda page.
export default defineConfig({
  testDir:'tests/live-tilda',workers:1,timeout:120000,globalTimeout:600000,
  outputDir:'.local-design-review/live-results',reporter:'list',
  use:{baseURL:'https://domkazan116.ru',locale:'ru-RU',trace:'off',video:'on',screenshot:'only-on-failure',actionTimeout:15000},
  projects:[
    {name:'live-desktop',use:{...devices['Desktop Chrome'],channel:'chrome',viewport:{width:1440,height:900}}},
    {name:'live-mobile',use:{...devices['Pixel 7'],channel:'chrome',viewport:{width:390,height:844}}},
    {name:'live-narrow',testMatch:'journey.spec.ts',use:{...devices['Pixel 7'],channel:'chrome',viewport:{width:320,height:844}}},
    {name:'live-webkit-mobile',testMatch:'journey.spec.ts',use:{...devices['iPhone 13']}},
  ],
});
