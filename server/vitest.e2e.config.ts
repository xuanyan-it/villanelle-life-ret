import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.e2e.test.ts"],
    exclude: ["src/**/*.real.e2e.test.ts"],
    // Default 5s is easy to hit on GitHub runners (Nest + many HTTP steps; argon2 if mocks register late).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Ensure vi.mock runs before test files import `app.factory` (import order differs from local bundling).
    setupFiles: ["./src/__e2e__/e2e-harness.ts"],
    pool: "threads",
    maxWorkers: 1
  }
});
