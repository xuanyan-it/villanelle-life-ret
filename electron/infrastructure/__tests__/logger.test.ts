import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createElectronLogger } from "../logger";

const tempDirs: string[] = [];

describe("createElectronLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("persists structured logs in production", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "ret-electron-log-"));
    tempDirs.push(baseDir);
    const logger = createElectronLogger({
      nodeEnv: "production",
      baseDir
    });

    logger.info("boot complete", {
      requestId: "req-1",
      scope: "boot",
      password: "Abcd1234",
      email: "admin@ret.local"
    });

    expect(logger.logPath).toBe(path.join(baseDir, "logs", "electron.log"));
    const lines = fs.readFileSync(logger.logPath!, "utf8").trim().split(/\r?\n/);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "info",
      msg: "boot complete",
      requestId: "req-1",
      scope: "boot",
      password: "[REDACTED]",
      email: "a***@ret.local"
    });
  });

  it("keeps development logs on console only", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createElectronLogger({
      nodeEnv: "development",
      baseDir: "C:\\repo\\electron"
    });

    logger.info("dev event", { channel: "ipc" });

    expect(logger.logPath).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith("dev event", { channel: "ipc" });
  });
});
