import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "C:\\repo\\electron"),
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
    (app.getAppPath as any).mockImplementation(() => "C:\\repo\\electron");
    (app as any).isPackaged = false;
    (fs.existsSync as any).mockImplementation(() => true);
    delete process.env.PORTABLE_EXECUTABLE_DIR;
  });

  test("resolves development paths from fixed project root", () => {
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("C:\\repo");
    const ret = resolveRuntimePaths("development");
    expect(ret.envLabel).toBe("dev");
    expect(ret.rootDir).toBe("C:\\repo");
    // default mock: everything exists → model/ is preferred (unchanged dev logic)
    expect(ret.modelDir).toBe("C:\\repo\\model");
    expect(ret.modelRoot).toBe("C:\\repo\\model");
    expect(ret.pythonExePath).toMatch(/python(\.exe)?$/);
    expect(ret.workerScriptPath).toContain("worker.py");
    expect(ret.hasRuntimePython).toBe(true);
    cwdSpy.mockRestore();
  });

  test("resolves development modelDir to assets/models when model/ is missing", () => {
    // only the dev repo layout (assets/models/worker.py) exists
    (fs.existsSync as any).mockImplementation((p: string) =>
      p.includes("assets") &&
      p.includes("models") &&
      p.includes("worker.py"),
    );
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue("C:\\repo");
    const ret = resolveRuntimePaths("development");
    expect(ret.modelDir).toBe("C:\\repo\\assets\\models");
    cwdSpy.mockRestore();
  });

  test("resolves production paths from PORTABLE_EXECUTABLE_DIR when provided", () => {
    (app as any).isPackaged = true;
    process.env.PORTABLE_EXECUTABLE_DIR = "D:\\portable";
    Object.defineProperty(process, "resourcesPath", {
      configurable: true,
      value: "D:\\portable\\resources",
    });
    const ret = resolveRuntimePaths("production");
    expect(ret.envLabel).toBe("prod");
    expect(ret.rootDir).toBe("D:\\portable");
    // default mock: everything exists → model/artificial/models is preferred
    expect(ret.modelDir).toBe("D:\\portable\\model\\artificial\\models");
    expect(ret.modelRoot).toBe("D:\\portable\\model");
    expect((fs.existsSync as any).mock.calls.length).toBeGreaterThan(0);
  });

  test("resolves production modelDir to model/ when artificial/ is absent", () => {
    (app as any).isPackaged = true;
    process.env.PORTABLE_EXECUTABLE_DIR = "D:\\portable";
    // previous portable layout: worker.py directly at model/
    (fs.existsSync as any).mockImplementation((p: string) =>
      !p.includes("artificial"),
    );
    const ret = resolveRuntimePaths("production");
    expect(ret.modelDir).toBe("D:\\portable\\model");
  });

  test("defaults production modelDir to model/artificial/models when nothing found", () => {
    (app as any).isPackaged = true;
    process.env.PORTABLE_EXECUTABLE_DIR = "D:\\portable";
    (fs.existsSync as any).mockImplementation(() => false);
    const ret = resolveRuntimePaths("production");
    expect(ret.modelDir).toBe("D:\\portable\\model\\artificial\\models");
  });
});
