import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_DISABLE_MAPS: "1",
      NEXT_PUBLIC_TEST_AUTH_BYPASS: "1",
      TEST_AUTH_BYPASS_ENABLED: "1",
      TEST_AUTH_BYPASS_DRIVER_ID: "11111111-1111-4111-8111-111111111111",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

