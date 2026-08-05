import { beforeEach, describe, expect, test, vi } from "vitest";

import { EventEmitter } from "events";

import { createWorkerManager } from "../workerManager";

const mockSpawn = vi.fn();

vi.mock("child_process", () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

const createMockProcess = () => {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn() };
  proc.kill = vi.fn();
  return proc;
};

const feedLine = (proc: any, obj: unknown) => {
  proc.stdout.emit("data", Buffer.from(`${JSON.stringify(obj)}\n`, "utf8"));
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createWorkerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("waits for ready before sending request and resolves by response id", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const onReady = vi.fn();
    const emitShellOutput = vi.fn();
    const manager = createWorkerManager({ onReady, emitShellOutput });

    const startPromise = manager.start("python", ["-u", "worker.py"], 1);
    proc.emit("spawn");
    await startPromise;

    const onProgress = vi.fn();
    const requestPromise = manager.request(
      {
        Gender: "1",
        sampleType: "r",
      },
      onProgress,
    );

    expect(proc.stdin.write).not.toHaveBeenCalled();

    feedLine(proc, { type: "ready", ok: true });
    await tick();
    expect(onReady).toHaveBeenCalledWith({
      type: "ready",
      ok: true,
      error: undefined,
    });

    await tick();
    expect(proc.stdin.write).toHaveBeenCalledTimes(1);
    const sentPayload = String(proc.stdin.write.mock.calls[0][0]);
    expect(sentPayload).toContain('"id":"1"');
    expect(sentPayload).toContain('"cmd":"predict"');

    feedLine(proc, { type: "progress", id: "1", pct: 40, step: "features" });
    expect(onProgress).toHaveBeenCalledWith({ pct: 40, step: "features" });

    feedLine(proc, { id: "1", ok: true, result: "class=0(N) prob=0.7300" });
    await expect(requestPromise).resolves.toBe("class=0(N) prob=0.7300");
  });

  test("resolves tile requests from raw binary frames (no base64)", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const manager = createWorkerManager({
      onReady: vi.fn(),
      emitShellOutput: vi.fn(),
    });

    const startPromise = manager.start("python", ["-u", "worker.py"], 1);
    proc.emit("spawn");
    await startPromise;
    feedLine(proc, { type: "ready", ok: true });
    await tick();

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const requestPromise = manager.request(
      { slidePath: "x.svs", level: 0, x: 0, y: 0 },
      undefined,
      "extract-tile",
    );
    await tick();

    feedLine(proc, { id: "1", ok: true, type: "tile", length: png.length });
    proc.stdout.emit("data", png);
    await expect(requestPromise).resolves.toEqual(png);
  });

  test("handles binary frame split across multiple data chunks", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const manager = createWorkerManager({
      onReady: vi.fn(),
      emitShellOutput: vi.fn(),
    });

    const startPromise = manager.start("python", ["-u", "worker.py"], 1);
    proc.emit("spawn");
    await startPromise;
    feedLine(proc, { type: "ready", ok: true });
    await tick();

    const png = Buffer.from([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    const requestPromise = manager.request(
      { slidePath: "x.svs" },
      undefined,
      "extract-tile",
    );
    await tick();

    feedLine(proc, { id: "1", ok: true, type: "tile", length: png.length });
    // split the raw bytes across two chunks
    proc.stdout.emit("data", png.subarray(0, 3));
    proc.stdout.emit("data", png.subarray(3));
    await expect(requestPromise).resolves.toEqual(png);
  });

  test("rejects waiting requests when worker ready fails", async () => {
    const proc = createMockProcess();
    mockSpawn.mockReturnValue(proc);

    const emitShellOutput = vi.fn();
    const manager = createWorkerManager({
      onReady: vi.fn(),
      emitShellOutput,
    });

    const startPromise = manager.start("python", ["-u", "worker.py"], 1);
    proc.emit("spawn");
    await startPromise;

    const requestPromise = manager.request({
      Gender: "1",
    });

    feedLine(proc, { type: "ready", ok: false, error: "load failed" });

    await expect(requestPromise).rejects.toThrow("load failed");
    expect(emitShellOutput).toHaveBeenCalledWith(
      "[worker#0] ready failed: load failed",
    );
  });
});
