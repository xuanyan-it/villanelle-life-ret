import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  existsSyncMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  copyFileSyncMock: vi.fn(),
  writeFileSyncMock: vi.fn(),
  parseElectronEnvMock: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {},
  dialog: {
    showSaveDialog: (...args: unknown[]) => mocks.showSaveDialogMock(...args),
  },
  ipcMain: {
    handle: (...args: unknown[]) => mocks.handleMock(...args),
  },
}));

vi.mock("fs", () => ({
  default: {
    existsSync: (...args: unknown[]) => mocks.existsSyncMock(...args),
    mkdirSync: (...args: unknown[]) => mocks.mkdirSyncMock(...args),
    copyFileSync: (...args: unknown[]) => mocks.copyFileSyncMock(...args),
    writeFileSync: (...args: unknown[]) => mocks.writeFileSyncMock(...args),
  },
}));

vi.mock("../../config/env", () => ({
  parseElectronEnv: (...args: unknown[]) => mocks.parseElectronEnvMock(...args),
}));

describe("registerFileHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, "resourcesPath", {
      value: "C:\\resources",
      configurable: true,
      writable: true,
    });
    mocks.parseElectronEnvMock.mockReturnValue({});
    delete process.env.RET_E2E_SAVE_DIR;
  });

  it("copies existing template file to selected save path", async () => {
    mocks.existsSyncMock.mockImplementation((candidate: string) => candidate.endsWith("template_zh-CN.csv"));
    mocks.showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: "C:\\output\\template.csv",
    });

    const { registerFileHandlers } = await import("../fileHandlers");
    registerFileHandlers({ nodeEnv: "development", authSession: undefined as never });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const download = handlers.get("download");
    expect(download).toBeTruthy();
    await expect(download?.({}, "template_zhCN.csv")).resolves.toEqual({ canceled: false });
    expect(mocks.copyFileSyncMock).toHaveBeenCalledTimes(1);
    expect(mocks.writeFileSyncMock).not.toHaveBeenCalled();
  });

  it("throws stable not-found error when source template file does not exist", async () => {
    mocks.existsSyncMock.mockReturnValue(false);
    mocks.showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: "C:\\output\\template.csv",
    });

    const { registerFileHandlers } = await import("../fileHandlers");
    registerFileHandlers({ nodeEnv: "development", authSession: undefined as never });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const download = handlers.get("download");
    await expect(download?.({}, "template_zh-CN.csv")).rejects.toThrow(SharedClientErrorMessage.templateNotFound);
    expect(mocks.copyFileSyncMock).not.toHaveBeenCalled();
    expect(mocks.writeFileSyncMock).not.toHaveBeenCalled();
  });

  it("returns canceled when save dialog is canceled", async () => {
    mocks.existsSyncMock.mockReturnValue(true);
    mocks.showSaveDialogMock.mockResolvedValue({
      canceled: true,
      filePath: undefined,
    });

    const { registerFileHandlers } = await import("../fileHandlers");
    registerFileHandlers({ nodeEnv: "development", authSession: undefined as never });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const download = handlers.get("download");
    await expect(download?.({}, "template_zh-CN.csv")).resolves.toEqual({ canceled: true });
    expect(mocks.copyFileSyncMock).not.toHaveBeenCalled();
    expect(mocks.writeFileSyncMock).not.toHaveBeenCalled();
  });

  it("wraps download errors with a stable message", async () => {
    mocks.existsSyncMock.mockImplementation(() => {
      throw new Error("disk unavailable");
    });
    mocks.showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: "C:\\output\\template.csv",
    });

    const { registerFileHandlers } = await import("../fileHandlers");
    registerFileHandlers({ nodeEnv: "development", authSession: undefined as never });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const download = handlers.get("download");
    await expect(download?.({}, "template_zh-CN.csv")).rejects.toThrow(SharedClientErrorMessage.downloadFailed);
  });

  it("rejects unsupported template filename", async () => {
    const { registerFileHandlers } = await import("../fileHandlers");
    registerFileHandlers({ nodeEnv: "development", authSession: undefined as never });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const download = handlers.get("download");
    await expect(download?.({}, "template_en-US.csv")).rejects.toThrow(SharedClientErrorMessage.invalidTemplateFilename);
  });

  it("bypasses native save dialog in e2e mode and writes to the configured directory", async () => {
    process.env.RET_E2E_SAVE_DIR = "C:\\e2e-downloads";
    mocks.existsSyncMock.mockImplementation((candidate: string) => candidate.endsWith("template_zh-CN.csv"));

    const { registerFileHandlers } = await import("../fileHandlers");
    registerFileHandlers({ nodeEnv: "development", authSession: undefined as never });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const download = handlers.get("download");
    await expect(download?.({}, "template_zh-CN.csv")).resolves.toEqual({ canceled: false });
    expect(mocks.showSaveDialogMock).not.toHaveBeenCalled();
    expect(mocks.mkdirSyncMock).toHaveBeenCalledWith("C:\\e2e-downloads", { recursive: true });
    expect(mocks.copyFileSyncMock).toHaveBeenCalledWith(
      expect.stringContaining("template_zh-CN.csv"),
      path.join("C:\\e2e-downloads", "template_zh-CN.csv"),
    );
  });
});
