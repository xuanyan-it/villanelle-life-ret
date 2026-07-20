import { describe, expect, test, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  registerAuthHandlers: vi.fn(),
  registerFileHandlers: vi.fn(),
  registerRecordHandlers: vi.fn(),
  registerSystemHandlers: vi.fn()
}));

vi.mock("../authHandlers", () => ({
  registerAuthHandlers: mocks.registerAuthHandlers
}));

vi.mock("../fileHandlers", () => ({
  registerFileHandlers: mocks.registerFileHandlers
}));

vi.mock("../recordHandlers", () => ({
  registerRecordHandlers: mocks.registerRecordHandlers
}));

vi.mock("../systemHandlers", () => ({
  registerSystemHandlers: mocks.registerSystemHandlers
}));

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("registers all handler groups with context", async () => {
    const { registerIpcHandlers } = await import("../index");
    const context = {
      mainWindow: {},
      nodeEnv: "development",
      workerManager: {},
      authSession: {
        isAuthenticated: vi.fn(),
        markAuthenticated: vi.fn(),
        getPrincipal: vi.fn(),
        clear: vi.fn(),
        requireAuthenticated: vi.fn()
      },
      workerCommand: "python",
      workerArgs: ["-u", "worker.py"],
      emitShellOutput: vi.fn()
    } as any;

    registerIpcHandlers(context);

    expect(mocks.registerAuthHandlers).toHaveBeenCalledWith(context);
    expect(mocks.registerFileHandlers).toHaveBeenCalledWith(context);
    expect(mocks.registerRecordHandlers).toHaveBeenCalledWith(context);
    expect(mocks.registerSystemHandlers).toHaveBeenCalledWith(context);
  });

  test("registers only once in one process lifecycle", async () => {
    const { registerIpcHandlers } = await import("../index");
    const context = {
      mainWindow: {},
      nodeEnv: "production",
      workerManager: {},
      authSession: {
        isAuthenticated: vi.fn(),
        markAuthenticated: vi.fn(),
        getPrincipal: vi.fn(),
        clear: vi.fn(),
        requireAuthenticated: vi.fn()
      },
      workerCommand: "python",
      workerArgs: [],
      emitShellOutput: vi.fn()
    } as any;

    registerIpcHandlers(context);
    registerIpcHandlers(context);

    expect(mocks.registerAuthHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.registerFileHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.registerRecordHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.registerSystemHandlers).toHaveBeenCalledTimes(1);
  });
});
