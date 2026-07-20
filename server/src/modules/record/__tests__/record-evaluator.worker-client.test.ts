import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const existsSyncMock = vi.fn();
const createInterfaceMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
  },
}));

vi.mock("node:readline", () => ({
  default: {
    createInterface: (...args: unknown[]) => createInterfaceMock(...args),
  },
}));

vi.mock("../../model/model-config", () => ({
  resolveServerModelDir: () => "C:\\models",
}));

import { PythonRecordEvaluator } from "../record-evaluator";

type FakeProc = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn> };
  kill: ReturnType<typeof vi.fn>;
};

const createProc = (): FakeProc => {
  const proc = new EventEmitter() as FakeProc;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn() };
  proc.kill = vi.fn();
  return proc;
};

describe("PythonWorkerClient edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  it("returns early when start is called while process already exists", async () => {
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;
    worker.workerProcess = { already: true };

    await expect(worker.start("python", ["-u", "worker.py"])).resolves.toBeUndefined();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("throws when request is called without running worker process", async () => {
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;
    worker.workerReady = true;
    worker.workerProcess = null;

    await expect(
      worker.request({
        DET_PKHD1L1: "1",
        DET_RPS4Y1: "1",
        DET_CRABP1: "1",
        Gender: "1",
        sampleType: "r",
      }),
    ).rejects.toThrow(/worker not running/);
  });

  it("captures startup exception and stores failed ready message", async () => {
    const proc = createProc();
    spawnMock.mockReturnValue(proc);
    createInterfaceMock.mockImplementation(() => {
      throw new Error("readline boom");
    });

    const evaluator = new PythonRecordEvaluator({
      get: vi.fn((key: string) => {
        if (key === "SERVICE_PYTHON_CMD") return "python";
        if (key === "SERVICE_EVAL_SCRIPT") return "C:\\models\\worker.py";
        return undefined;
      }),
    } as never);
    const worker = (evaluator as any).workerClient;

    await expect(worker.start("python", ["-u", "C:\\models\\worker.py"])).rejects.toThrow(
      /readline boom/,
    );
    expect(worker.workerReadyMessage?.ok).toBe(false);
  });

  it("warns but does not throw when stop kill fails", () => {
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;
    worker.workerProcess = createProc();
    worker.workerProcess.kill.mockImplementation(() => {
      throw new Error("kill failed");
    });

    expect(() => worker.stop()).not.toThrow();
    expect(worker.workerProcess).toBeNull();
  });

  it("fails startup when command is empty", async () => {
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;

    await expect(worker.start("", [])).rejects.toThrow(/worker command is empty/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("fails startup when script path is missing", async () => {
    existsSyncMock.mockImplementation((v: string) => v !== "C:\\missing\\worker.py");
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;

    await expect(worker.start("python", ["-u", "C:\\missing\\worker.py"])).rejects.toThrow(
      /worker script not found/,
    );
  });

  it("handles worker ready failure and unknown pending messages", async () => {
    const proc = createProc();
    const rl = new EventEmitter();
    spawnMock.mockReturnValue(proc);
    createInterfaceMock.mockReturnValue(rl);
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;

    const startPromise = worker.start("python", ["-u", "worker.py"]);
    proc.emit("spawn");
    await startPromise;

    const readyPromise = worker.ensureReady(200);
    rl.emit("line", `{"type":"ready","ok":false}`);
    await expect(readyPromise).rejects.toThrow(/worker ready failed/);

    rl.emit("line", "   ");
    rl.emit("line", "not-json");
    rl.emit("line", `{"id":"unknown","ok":true,"result":1}`);
  });

  it("rejects pending request on worker error and supports non-error payload", async () => {
    const proc = createProc();
    const rl = new EventEmitter();
    spawnMock.mockReturnValue(proc);
    createInterfaceMock.mockReturnValue(rl);
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;

    const startPromise = worker.start("python", ["-u", "worker.py"]);
    proc.emit("spawn");
    proc.emit("spawn");
    await startPromise;

    const readyPromise = worker.ensureReady(1000);
    rl.emit("line", `{"type":"ready","ok":true}`);
    await readyPromise;

    const requestPromise = worker.request({
      DET_PKHD1L1: "1",
      DET_RPS4Y1: "2",
      DET_CRABP1: "3",
      Gender: "0",
      sampleType: "r",
    });
    await Promise.resolve();
    proc.emit("error", "boom");
    await expect(requestPromise).rejects.toThrow(/worker spawn error/);
  });

  it("rejects request when worker response is not ok and error is omitted", async () => {
    const proc = createProc();
    const rl = new EventEmitter();
    spawnMock.mockReturnValue(proc);
    createInterfaceMock.mockReturnValue(rl);
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;

    const startPromise = worker.start("python", ["-u", "worker.py"]);
    proc.emit("spawn");
    await startPromise;

    const readyPromise = worker.ensureReady(1000);
    rl.emit("line", `{"type":"ready","ok":true}`);
    await readyPromise;

    const requestPromise = worker.request({
      DET_PKHD1L1: "1",
      DET_RPS4Y1: "2",
      DET_CRABP1: "3",
      Gender: "0",
      sampleType: "r",
    });
    await Promise.resolve();
    rl.emit("line", `{"id":"1","ok":false}`);
    await expect(requestPromise).rejects.toThrow(/worker response error/);
  });

  it("handles worker exit after ready without pre-ready error path", async () => {
    const proc = createProc();
    const rl = new EventEmitter();
    spawnMock.mockReturnValue(proc);
    createInterfaceMock.mockReturnValue(rl);
    const evaluator = new PythonRecordEvaluator({ get: vi.fn() } as never);
    const worker = (evaluator as any).workerClient;

    const startPromise = worker.start("python", ["-u", "worker.py"]);
    proc.emit("spawn");
    await startPromise;

    const readyPromise = worker.ensureReady(1000);
    rl.emit("line", `{"type":"ready","ok":true}`);
    await readyPromise;

    proc.emit("exit", 0, "SIGTERM");
    expect(worker.workerProcess).toBeNull();
  });
});
