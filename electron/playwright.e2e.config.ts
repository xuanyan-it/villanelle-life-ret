import path from "path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: path.join(__dirname, "__e2e__"),
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm -C ../frontend exec vite --host localhost --port 5173 --strictPort",
    cwd: __dirname,
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
