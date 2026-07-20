import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isElectronRuntimeMock: vi.fn(),
  webHealthMock: vi.fn().mockResolvedValue({ ok: true }),
  electronHealthMock: vi.fn().mockResolvedValue({ ok: true }),
  webDownloadMock: vi.fn().mockResolvedValue({ canceled: false }),
  electronDownloadMock: vi.fn().mockResolvedValue({ canceled: false }),
  electronVerifyTokenMock: vi.fn().mockResolvedValue({ code: 0, status: "success", payload: [{ total: 1, result: [] }], meta: {}, message: "" }),
}));

vi.mock("../../platform/runtime", () => ({
  isElectronRuntime: () => mocks.isElectronRuntimeMock(),
}));

vi.mock("../webApi", () => ({
  webApi: {
    health: (...args: unknown[]) => mocks.webHealthMock(...args),
    download: (...args: unknown[]) => mocks.webDownloadMock(...args),
  },
}));

vi.mock("../electronApi", () => ({
  electronApi: {
    health: (...args: unknown[]) => mocks.electronHealthMock(...args),
    download: (...args: unknown[]) => mocks.electronDownloadMock(...args),
    verifyToken: (...args: unknown[]) => mocks.electronVerifyTokenMock(...args),
  },
}));

describe("api runtime selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses webApi in non-electron runtime", async () => {
    mocks.isElectronRuntimeMock.mockReturnValue(false);
    const { api } = await import("../index");

    await api.download("template_zh-CN.csv");
    expect(mocks.webDownloadMock).toHaveBeenCalledWith("template_zh-CN.csv");
    expect(mocks.electronDownloadMock).not.toHaveBeenCalled();
  });

  it("uses electronApi in electron runtime", async () => {
    mocks.isElectronRuntimeMock.mockReturnValue(true);
    const { api } = await import("../index");

    await api.download("template_zh-CN.csv");
    expect(mocks.electronDownloadMock).toHaveBeenCalledWith("template_zh-CN.csv");
    expect(mocks.webDownloadMock).not.toHaveBeenCalled();
    await api.verifyToken("token");
    expect(mocks.electronVerifyTokenMock).toHaveBeenCalledWith("token");
  });
});
