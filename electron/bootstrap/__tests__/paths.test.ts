import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "C:\\app\\app.exe"),
  },
}));

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
}));

import { app } from "electron";
import fs from "fs";

import { resolveRuntimePaths } from "../paths";

describe("resolveRuntimePaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (app.getPath as any).mockImplementation(() => "C:\\app\\app.exe");
    (fs.existsSync as any).mockImplementation(() => true);
    delete process.env.PORTABLE_EXECUTABLE_DIR;
  });

  test("resolves development paths from fixed project root", () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("C:\\repo");
    const ret = resolveRuntimePaths("development");
    expect(ret.envLabel).toBe("dev");
    expect(ret.rootDir).toBe("C:\\repo");
    expect(ret.pythonExePath).toMatch(/python(\.exe)?$/);
    expect(ret.workerScriptPath).toContain("worker.py");
    expect(ret.hasRuntimePython).toBe(true);
    cwdSpy.mockRestore();
  });

  test("resolves production paths from PORTABLE_EXECUTABLE_DIR when provided", () => {
    process.env.PORTABLE_EXECUTABLE_DIR = "D:\\portable";
    const ret = resolveRuntimePaths("production");
    expect(ret.envLabel).toBe("prod");
    expect(ret.rootDir).toBe("D:\\portable");
    expect((fs.existsSync as any).mock.calls.length).toBeGreaterThan(0);
  });
});
