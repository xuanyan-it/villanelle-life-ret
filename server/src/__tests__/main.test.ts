import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const createAppMock = vi.fn();
const loggerErrorMock = vi.fn();
const processExitSpy = vi
  .spyOn(process, "exit")
  .mockImplementation(((code?: string | number | null | undefined) => undefined as never) as never);

vi.mock("../app.factory", () => ({
  createApp: (...args: unknown[]) => createAppMock(...args),
}));

vi.mock("@nestjs/common", () => ({
  Logger: class Logger {
    error(...args: unknown[]): void {
      loggerErrorMock(...args);
    }
  },
}));

vi.mock("@nestjs/config", () => ({
  ConfigService: class ConfigService {},
}));

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("main bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterAll(() => {
    processExitSpy.mockRestore();
  });

  it("starts listening with configured host and port", async () => {
    const listenMock = vi.fn().mockResolvedValue(undefined);
    const configGetMock = vi.fn((key: string, fallback?: unknown) => {
      if (key === "PORT") return 7100;
      if (key === "HOST") return "127.0.0.1";
      return fallback;
    });

    createAppMock.mockResolvedValue({
      get: vi.fn(() => ({ get: configGetMock })),
      listen: listenMock,
    });

    await import("../main");
    await flush();

    expect(listenMock).toHaveBeenCalledWith(7100, "127.0.0.1");
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("logs and exits when bootstrap fails", async () => {
    createAppMock.mockRejectedValue(new Error("boom"));

    await import("../main");
    await flush();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Application bootstrap failed",
      expect.stringContaining("Error: boom"),
      undefined,
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
