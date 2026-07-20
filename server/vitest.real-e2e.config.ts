import { defineConfig } from "vitest/config";

import { checkRealE2ePrerequisites } from "./src/__e2e__/real-e2e-prerequisites";

const forceRun = process.env.RUN_SERVER_REAL_E2E === "1";
const prereqs = checkRealE2ePrerequisites();

if (forceRun && !prereqs.ok) {
  throw new Error(`real e2e (RUN_SERVER_REAL_E2E=1): ${prereqs.reason}`);
}

const skipRealE2e = !prereqs.ok && !forceRun;
if (skipRealE2e && prereqs.ok === false) {
  console.warn(`[vitest] real e2e skipped: ${prereqs.reason}`);
}

export default defineConfig({
  test: {
    include: skipRealE2e ? [] : ["src/**/*.real.e2e.test.ts"],
    passWithNoTests: skipRealE2e,
    pool: "threads",
    maxWorkers: 1,
    setupFiles: skipRealE2e ? [] : ["./src/__e2e__/real-e2e.setup.ts"],
  },
});
