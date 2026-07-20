import { afterEach, describe, expect, it, vi } from "vitest";

import { DownloadStrictService } from "../download-strict.service";

const existsSyncMock = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args)
}));

describe("DownloadStrictService", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("skips validation outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const configService = {
      get: vi.fn(() => undefined)
    } as any;
    const service = new DownloadStrictService(configService);

    expect(() => service.onModuleInit()).not.toThrow();
    expect(configService.get).not.toHaveBeenCalled();
  });

  it("fails startup when production template file is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    existsSyncMock.mockReturnValue(false);
    const configService = {
      get: vi.fn((key: string) => {
        if (key === "TEMPLATE_FILENAME") return "template_zh-CN.csv";
        if (key === "TEMPLATE_DIR") return "assets/templates";
        return undefined;
      })
    } as any;
    const service = new DownloadStrictService(configService);

    expect(() => service.onModuleInit()).toThrow(/template file not found/i);
  });

  it("passes when production template file exists", () => {
    vi.stubEnv("NODE_ENV", "production");
    existsSyncMock.mockReturnValue(true);
    const configService = {
      get: vi.fn((key: string) => {
        if (key === "TEMPLATE_FILENAME") return "template_zh-CN.csv";
        if (key === "TEMPLATE_DIR") return "assets/templates";
        return undefined;
      })
    } as any;
    const service = new DownloadStrictService(configService);

    expect(() => service.onModuleInit()).not.toThrow();
  });
});
