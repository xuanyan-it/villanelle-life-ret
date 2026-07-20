import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

const mkdirSyncMock = vi.fn();
const existsSyncMock = vi.fn(() => false);
const readdirSyncMock = vi.fn(() => []);
const renameSyncMock = vi.fn();
const rmSyncMock = vi.fn();
const statSyncMock = vi.fn(() => ({ size: 0, mtimeMs: 0 }));
const destinationMock = vi.fn();
const pinoInstance = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
const pinoMock = vi.fn(() => pinoInstance);

vi.mock("node:fs", () => ({
  mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  readdirSync: (...args: unknown[]) => readdirSyncMock(...args),
  renameSync: (...args: unknown[]) => renameSyncMock(...args),
  rmSync: (...args: unknown[]) => rmSyncMock(...args),
  statSync: (...args: unknown[]) => statSyncMock(...args),
}));

vi.mock("pino", () => {
  const pinoDefault = Object.assign(
    (...args: unknown[]) => pinoMock(...args),
    {
      stdTimeFunctions: {
        isoTime: () => "mock-time",
      },
    },
  );
  return {
    default: pinoDefault,
    destination: (...args: unknown[]) => destinationMock(...args),
  };
});

describe("createServerLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses nest console logger in non-production", async () => {
    const { createServerLogger } = await import("../logger.factory");
    const logger = createServerLogger({ nodeEnv: "development" });

    expect(logger).toEqual(["log", "warn", "error"]);
    expect(mkdirSyncMock).not.toHaveBeenCalled();
    expect(destinationMock).not.toHaveBeenCalled();
    expect(pinoMock).not.toHaveBeenCalled();
  });

  it("uses pino file logger in production", async () => {
    const { createServerLogger, PinoLoggerService } = await import("../logger.factory");
    const cwd = "C:/demo/server";
    const logDir = "tmp-logs";
    const logFile = "server.log";
    const expectedLogDir = path.resolve(cwd, logDir);
    const expectedLogPath = path.join(expectedLogDir, logFile);
    const logger = createServerLogger({
      nodeEnv: "production",
      logDir,
      logFile,
      cwd,
    });

    expect(mkdirSyncMock).toHaveBeenCalledWith(expectedLogDir, { recursive: true });
    expect(destinationMock).toHaveBeenCalledWith(expectedLogPath);
    expect(pinoMock).toHaveBeenCalled();
    expect(logger).toBeInstanceOf(PinoLoggerService);
  });

  it("rotates oversized log file and prunes stale archives", async () => {
    existsSyncMock.mockReturnValue(true);
    statSyncMock.mockReturnValue({ size: 11 * 1024 * 1024, mtimeMs: 0 });
    readdirSyncMock.mockReturnValue(["server.log.2026-03-15", "server.log.2026-03-14", "server.log.2026-03-13"]);

    const { createServerLogger } = await import("../logger.factory");
    createServerLogger({
      nodeEnv: "production",
      logDir: "tmp-logs",
      logFile: "server.log",
      cwd: "C:/demo/server",
      logMaxSizeBytes: 10 * 1024 * 1024,
      logMaxFiles: 2,
      rotationCheckIntervalMs: 1_000_000
    });

    expect(renameSyncMock).toHaveBeenCalledTimes(1);
    expect(rmSyncMock).toHaveBeenCalledTimes(1);
  });

  it("redacts sensitive values in pino logger service", async () => {
    const { PinoLoggerService } = await import("../logger.factory");
    const logger = new PinoLoggerService(pinoInstance as any);

    logger.log("Authorization: Bearer abc.def.ghi", {
      password: "Abcd1234",
      email: "admin@ret.local",
      nested: { token: "token-value" }
    });

    expect(pinoInstance.info).toHaveBeenCalledWith(
      {
        context: {
          password: "[REDACTED]",
          email: "a***@ret.local",
          nested: { token: "[REDACTED]" }
        }
      },
      "Authorization: Bearer [REDACTED]"
    );
  });
});
