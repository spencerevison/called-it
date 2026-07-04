import { defineConfig, devices } from "@playwright/test";
import "./e2e/env";

const MOCK_ANTHROPIC_PORT = 4010;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // stands in for api.anthropic.com so the T36 happy-path spec never makes a live LLM call
      command: `MOCK_ANTHROPIC_PORT=${MOCK_ANTHROPIC_PORT} node e2e/mock-anthropic-server.mjs`,
      port: MOCK_ANTHROPIC_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm dev --port 3100",
      url: "http://localhost:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ANTHROPIC_API_KEY: "e2e-test-key",
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_ANTHROPIC_PORT}`,
        E2E_TEST_MODE: "1",
      },
    },
  ],
});
