import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import type { LogLevel, LoggerService } from "@nestjs/common";
import pino, { destination, type Logger as PinoLogger } from "pino";
import { sanitizeLogMessage, sanitizeLogValue } from "@villanelle/ret-shared/contracts/log-redaction";

const DEFAULT_NEST_LEVELS: LogLevel[] = ["log", "warn", "error"];
const DEFAULT_LOG_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_LOG_MAX_FILES = 5;
const DEFAULT_ROTATION_CHECK_INTERVAL_MS = 30_000;

const toText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  return String(value);
};

export class PinoLoggerService implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info(
      { context: sanitizeLogValue(optionalParams[0]) },
      sanitizeLogMessage(toText(message))
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn(
      { context: sanitizeLogValue(optionalParams[0]) },
      sanitizeLogMessage(toText(message))
    );
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(
      { context: sanitizeLogValue(optionalParams[0]) },
      sanitizeLogMessage(toText(message))
    );
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.trace(
      { context: sanitizeLogValue(optionalParams[0]) },
      sanitizeLogMessage(toText(message))
    );
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const trace = typeof optionalParams[0] === "string" ? optionalParams[0] : undefined;
    const context = optionalParams[1];
    this.logger.error(
      {
        trace: sanitizeLogValue(trace),
        context: sanitizeLogValue(context)
      },
      sanitizeLogMessage(toText(message))
    );
  }
}

type CreateServerLoggerOptions = {
  nodeEnv?: string;
  cwd?: string;
  logDir?: string;
  logFile?: string;
  logLevel?: string;
  logMaxSizeBytes?: number;
  logMaxFiles?: number;
  rotationCheckIntervalMs?: number;
};

const normalizePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : fallback;
};

const pruneArchivedLogs = (logPath: string, maxFiles: number): void => {
  const absoluteLogDir = path.dirname(logPath);
  const logFileName = path.basename(logPath);
  const prefix = `${logFileName}.`;
  const archivedLogs = readdirSync(absoluteLogDir)
    .filter((entry) => entry.startsWith(prefix))
    .map((entry) => path.join(absoluteLogDir, entry))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  const staleLogs = archivedLogs.slice(maxFiles);
  for (const staleLogPath of staleLogs) {
    rmSync(staleLogPath, { force: true });
  }
};

const rotateLogFileIfNeeded = (logPath: string, maxSizeBytes: number, maxFiles: number): void => {
  try {
    if (!existsSync(logPath)) return;
    if (statSync(logPath).size < maxSizeBytes) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archivePath = `${logPath}.${timestamp}`;
    renameSync(logPath, archivePath);
    pruneArchivedLogs(logPath, maxFiles);
  } catch {
    // Logging failures should not crash service startup.
  }
};

export const createServerLogger = (
  options?: CreateServerLoggerOptions
): LoggerService | LogLevel[] => {
  const nodeEnv = (options?.nodeEnv ?? process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv !== "production") return DEFAULT_NEST_LEVELS;

  const cwd = options?.cwd ?? process.cwd();
  const logDirName = (options?.logDir ?? process.env.LOG_DIR ?? "logs").trim() || "logs";
  const logFileName = (options?.logFile ?? process.env.LOG_FILE ?? "server.log").trim() || "server.log";
  const logLevel = (options?.logLevel ?? process.env.LOG_LEVEL ?? "info").trim() || "info";
  const logMaxSizeBytes = normalizePositiveInt(
    options?.logMaxSizeBytes ?? process.env.LOG_MAX_SIZE_BYTES,
    DEFAULT_LOG_MAX_SIZE_BYTES
  );
  const logMaxFiles = normalizePositiveInt(
    options?.logMaxFiles ?? process.env.LOG_MAX_FILES,
    DEFAULT_LOG_MAX_FILES
  );
  const rotationCheckIntervalMs = normalizePositiveInt(
    options?.rotationCheckIntervalMs ?? process.env.LOG_ROTATION_CHECK_INTERVAL_MS,
    DEFAULT_ROTATION_CHECK_INTERVAL_MS
  );
  const absoluteLogDir = path.resolve(cwd, logDirName);
  const logPath = path.join(absoluteLogDir, logFileName);

  mkdirSync(absoluteLogDir, { recursive: true });
  rotateLogFileIfNeeded(logPath, logMaxSizeBytes, logMaxFiles);
  const stream = destination(logPath);
  const rotationTimer = setInterval(() => {
    rotateLogFileIfNeeded(logPath, logMaxSizeBytes, logMaxFiles);
  }, rotationCheckIntervalMs);
  rotationTimer.unref?.();
  const logger = pino(
    {
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime
    },
    stream
  );
  return new PinoLoggerService(logger);
};
