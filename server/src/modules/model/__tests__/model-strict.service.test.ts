import { describe, expect, it, vi } from "vitest";

const loadServerModelConfigMock = vi.fn();

vi.mock("../model-config", () => ({
  loadServerModelConfig: (...args: unknown[]) => loadServerModelConfigMock(...args),
}));

import { ModelStrictService } from "../model-strict.service";

describe("ModelStrictService", () => {
  it("does nothing in non-production environment", () => {
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const configService = {
      get: vi.fn((key: string, fallback?: unknown) => {
        if (key === "MODEL_ROOT") return "C:\\models";
        return fallback;
      }),
    } as any;

    const service = new ModelStrictService(configService);
    service.onModuleInit();
    expect(loadServerModelConfigMock).not.toHaveBeenCalled();
    process.env.NODE_ENV = oldNodeEnv;
  });

  it("validates model config at startup in production", () => {
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const configService = {
      get: vi.fn((key: string, fallback?: unknown) => {
        if (key === "MODEL_ROOT") return "C:\\models";
        return fallback;
      }),
    } as any;
    loadServerModelConfigMock.mockReturnValue({
      modelVersion: "LNM-1.0",
      resultPositiveThreshold: 0.3108,
    });

    const service = new ModelStrictService(configService);
    service.onModuleInit();
    expect(loadServerModelConfigMock).toHaveBeenCalledWith("C:\\models");
    process.env.NODE_ENV = oldNodeEnv;
  });

  it("throws when production startup validation fails", () => {
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const configService = {
      get: vi.fn((key: string, fallback?: unknown) => {
        if (key === "MODEL_ROOT") return "C:\\missing";
        return fallback;
      }),
    } as any;
    loadServerModelConfigMock.mockImplementation(() => {
      throw new Error("model config not found");
    });

    const service = new ModelStrictService(configService);
    expect(() => service.onModuleInit()).toThrow(/model config not found/);
    process.env.NODE_ENV = oldNodeEnv;
  });
});
