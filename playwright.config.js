import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 40000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5175",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: "node tests/server.mjs",
    url: "http://127.0.0.1:5175/api/",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
