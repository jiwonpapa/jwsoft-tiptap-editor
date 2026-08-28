import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.G7_BASE_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/playwright",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.G7_E2E_COMMAND
    ? {
        command: process.env.G7_E2E_COMMAND,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
