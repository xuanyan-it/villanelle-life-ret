import { describe, expect, it, vi } from "vitest";

import { computeDET, evaluateRecord } from "../evaluation";

const spawnSyncMock = vi.fn();
const existsSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
}));

describe("evaluation helpers", () => {
  it("computes DET values", () => {
    const det = computeDET("3", "4", "5", "1");
    expect(det).toEqual({
      DET_PKHD1L1: 2,
      DET_RPS4Y1: 3,
      DET_CRABP1: 4,
    });
  });

  it("returns external script output when runtime script succeeds", () => {
    existsSyncMock.mockReturnValue(true);
    spawnSyncMock.mockReturnValue({ status: 0, stdout: "1\n" });
    const result = evaluateRecord("1", "1", "1", "0", {
      modelRoot: "C:\\models",
      scriptPath: "C:\\models\\evaluation.py",
      pythonCmd: "python",
    });
    expect(result).toBe("1");
    expect(spawnSyncMock).toHaveBeenCalled();
  });

  it("falls back to threshold logic when script is unavailable", () => {
    existsSyncMock.mockReturnValue(false);
    expect(evaluateRecord("1.1", "1.1", "1.1", "0")).toBe("0");
    expect(evaluateRecord("1.2", "1", "1", "0")).toBe("1");
    expect(evaluateRecord("2.2", "1", "1", "0")).toBe("2");
    expect(evaluateRecord("0.1", "0.2", "0.3", "0")).toBe("0");
  });

  it("returns process error for invalid input", () => {
    existsSyncMock.mockReturnValue(false);
    expect(evaluateRecord("x", "1", "1", "0")).toBe("process error");
  });
});
