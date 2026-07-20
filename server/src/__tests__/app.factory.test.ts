import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nestCreateMock = vi.fn();
const cookieParserMock = vi.fn();
const createServerLoggerMock = vi.fn();

vi.mock("@nestjs/core", () => ({
  NestFactory: {
    create: (...args: unknown[]) => nestCreateMock(...args),
  },
}));

vi.mock("cookie-parser", () => ({
  default: (...args: unknown[]) => cookieParserMock(...args),
}));

vi.mock("../app.module", () => ({
  AppModule: class AppModule {},
}));

vi.mock("../common/logging/logger.factory", () => ({
  createServerLogger: (...args: unknown[]) => createServerLoggerMock(...args),
}));

describe("createApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates app and registers core middleware", async () => {
    const cookieMiddleware = vi.fn();
    const expressApp = { set: vi.fn() };
    const app = {
      enableShutdownHooks: vi.fn(),
      enableCors: vi.fn(),
      use: vi.fn(),
      getHttpAdapter: vi.fn(() => ({ getInstance: () => expressApp })),
      init: vi.fn().mockResolvedValue(undefined),
    };

    cookieParserMock.mockReturnValue(cookieMiddleware);
    nestCreateMock.mockResolvedValue(app);
    createServerLoggerMock.mockReturnValue(["log", "warn", "error"]);

    const { createApp } = await import("../app.factory");
    const created = await createApp();

    expect(nestCreateMock).toHaveBeenCalledOnce();
    expect(app.enableShutdownHooks).toHaveBeenCalledOnce();
    expect(app.enableCors).toHaveBeenCalledWith({ origin: true, credentials: true });
    expect(cookieParserMock).toHaveBeenCalledOnce();
    expect(app.use).toHaveBeenCalledWith(cookieMiddleware);
    expect(expressApp.set).not.toHaveBeenCalled();
    expect(app.init).toHaveBeenCalledOnce();
    expect(created).toBe(app);
  });

  it("uses explicit CORS allowlist in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ORIGINS", "https://app.Ret.com,https://admin.Ret.com");
    const expressApp = { set: vi.fn() };
    const app = {
      enableShutdownHooks: vi.fn(),
      enableCors: vi.fn(),
      use: vi.fn(),
      getHttpAdapter: vi.fn(() => ({ getInstance: () => expressApp })),
      init: vi.fn().mockResolvedValue(undefined),
    };
    nestCreateMock.mockResolvedValue(app);
    cookieParserMock.mockReturnValue(vi.fn());
    createServerLoggerMock.mockReturnValue(["log", "warn", "error"]);

    const { createApp } = await import("../app.factory");
    await createApp();

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ["https://app.Ret.com", "https://admin.Ret.com"],
      credentials: true,
    });
    expect(expressApp.set).toHaveBeenCalledWith("trust proxy", 1);
  });

  it("throws in production when CORS_ORIGINS is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ORIGINS", "");
    const expressApp = { set: vi.fn() };
    const app = {
      enableShutdownHooks: vi.fn(),
      enableCors: vi.fn(),
      use: vi.fn(),
      getHttpAdapter: vi.fn(() => ({ getInstance: () => expressApp })),
      init: vi.fn().mockResolvedValue(undefined),
    };
    nestCreateMock.mockResolvedValue(app);
    cookieParserMock.mockReturnValue(vi.fn());
    createServerLoggerMock.mockReturnValue(["log", "warn", "error"]);

    const { createApp } = await import("../app.factory");
    await expect(createApp()).rejects.toThrow(/CORS_ORIGINS/i);
  });

  it("uses logger returned by logger factory", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ORIGINS", "https://app.Ret.com");
    const expressApp = { set: vi.fn() };
    const app = {
      enableShutdownHooks: vi.fn(),
      enableCors: vi.fn(),
      use: vi.fn(),
      getHttpAdapter: vi.fn(() => ({ getInstance: () => expressApp })),
      init: vi.fn().mockResolvedValue(undefined),
    };
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    nestCreateMock.mockResolvedValue(app);
    cookieParserMock.mockReturnValue(vi.fn());
    createServerLoggerMock.mockReturnValue(logger);

    const { createApp } = await import("../app.factory");
    await createApp();

    expect(createServerLoggerMock).toHaveBeenCalledOnce();
    expect(nestCreateMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ logger }),
    );
  });

  it("registers production HTTPS enforcement middleware", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ORIGINS", "https://app.Ret.com");
    const expressApp = { set: vi.fn() };
    const app = {
      enableShutdownHooks: vi.fn(),
      enableCors: vi.fn(),
      use: vi.fn(),
      getHttpAdapter: vi.fn(() => ({ getInstance: () => expressApp })),
      init: vi.fn().mockResolvedValue(undefined),
    };
    nestCreateMock.mockResolvedValue(app);
    cookieParserMock.mockReturnValue(vi.fn());
    createServerLoggerMock.mockReturnValue(["log", "warn", "error"]);

    const { createApp } = await import("../app.factory");
    await createApp();

    const firstUse = app.use.mock.calls[0]?.[0];
    expect(typeof firstUse).toBe("function");
    expect(expressApp.set).toHaveBeenCalledWith("trust proxy", 1);
  });
});
