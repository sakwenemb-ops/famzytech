import { defineConfig, devices } from "@playwright/test";
import { TEST_ENV } from "./tests/e2e/test-env";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
    // Use a preinstalled Chromium when one is provided (e.g. in CI images).
    // Fake camera and microphone, so classroom tests make real video calls.
    launchOptions: {
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
    permissions: ["camera", "microphone"],
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke/ },
  ],
  webServer: {
    // Needs a production build first (npm run build)
    command: `npx next start -p ${port}`,
    port,
    // Never reuse a server started by hand: it would be connected to the development database
    reuseExistingServer: false,
    env: TEST_ENV,
  },
});
