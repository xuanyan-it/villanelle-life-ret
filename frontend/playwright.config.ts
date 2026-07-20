import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./__e2e__",
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: isCI ? 1 : undefined,
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: [
    {
      command: "pnpm -C ../server dev",
      url: "http://127.0.0.1:7001/health",
      timeout: 240_000,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "7001",
        TEMPLATE_DIR: "assets/templates"
      }
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      timeout: 240_000,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SERVICE_BASE_URL: "http://127.0.0.1:7001"
      }
    }
  ]
});
