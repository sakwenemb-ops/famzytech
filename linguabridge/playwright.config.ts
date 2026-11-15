import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "off",
    // Use a preinstalled Chromium when one is provided (e.g. in CI images)
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /smoke/ },
  ],
  webServer: {
    // Needs a production build first (npm run build)
    command: `npx next start -p ${port}`,
    port,
    reuseExistingServer: true,
  },
});
