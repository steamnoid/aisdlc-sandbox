import { mkdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import { BASE_URL, DATA_DB, E2E_PORT } from "./tests/e2e/infra/env";

mkdirSync(path.dirname(DATA_DB), { recursive: true });

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `npx next dev web-app -p ${E2E_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, DATA_DB },
  },
});
