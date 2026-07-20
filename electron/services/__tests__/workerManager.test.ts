import { beforeEach, describe, expect, test, vi } from "vitest";

import { EventEmitter } from "events";

import { createWorkerManager } from "../workerManager";

const mockSpawn = vi.fn();
const mockCreateInterface = vi.fn();

vi.mock("child_process", () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

vi.mock("readline", () => ({
  default: {
    createInterface: (...args: any[]) => mockCreateInterface(...args),
  },
}));

const createMockProcess = () => {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn() };
  proc.kill = vi.fn();
  return proc;
};

describe("createWorkerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("waits for ready before sending request and resolves by response id", async () => {
    const proc = createMockProcess();
    let lineHandler: ((line: string) => void) | undefined;
    mockCreateInterface.mockReturnValue({
      on: (event: string, cb: (line: string) => void) => {
        if (event === "line") {
          lineHandler = cb;
        }
      },
    });
    mockSpawn.mockReturnValue(proc);

    const onReady = vi.fn();
    const emitShellOutput = vi.fn();
    const manager = createWorkerManager({ onReady, emitShellOutput });

    const startPromise = manager.start("python", ["-u", "worker.py"]);
    proc.emit("spawn");
    await startPromise;

    const requestPromise = manager.request({
      DET_PKHD1L1: "1",
      DET_RPS4Y1: "2",
      DET_CRABP1: "3",
      Gender: "1",
      sampleType: "r",
    });

    expect(proc.stdin.write).not.toHaveBeenCalled();

    lineHandler?.(JSON.stringify({ type: "ready", ok: true }));
    await Promise.resolve();
    expect(onReady).toHaveBeenCalledWith({
      type: "ready",
      ok: true,
      error: undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(proc.stdin.write).toHaveBeenCalledTimes(1);
    const sentPayload = String(proc.stdin.write.mock.calls[0][0]);
    expect(sentPayload).toContain('"id":"1"');
    expect(sentPayload).toContain('"cmd":"predict"');

    lineHandler?.(JSON.stringify({ id: "1", ok: true, result: 0.73 }));
    await expect(requestPromise).resolves.toBe(0.73);
  });

  test("rejects waiting requests when worker ready fails", async () => {
    const proc = createMockProcess();
    let lineHandler: ((line: string) => void) | undefined;
    mockCreateInterface.mockReturnValue({
      on: (event: string, cb: (line: string) => void) => {
        if (event === "line") {
          lineHandler = cb;
        }
      },
    });
    mockSpawn.mockReturnValue(proc);

    const emitShellOutput = vi.fn();
    const manager = createWorkerManager({
      onReady: vi.fn(),
      emitShellOutput,
    });

    const startPromise = manager.start("python", ["-u", "worker.py"]);
    proc.emit("spawn");
    await startPromise;

    const requestPromise = manager.request({
      DET_PKHD1L1: "1",
      DET_RPS4Y1: "2",
      DET_CRABP1: "3",
      Gender: "1",
      sampleType: "r",
    });

    lineHandler?.(JSON.stringify({ type: "ready", ok: false, error: "load failed" }));

    await expect(requestPromise).rejects.toThrow("load failed");
    expect(emitShellOutput).toHaveBeenCalledWith(
      "[worker] ready failed: load failed",
    );
  });
});
