import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { sanitizeLogValue } from "@villanelle/ret-shared/contracts/log-redaction";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

export type ElectronLogger = {
  logPath?: string;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
};

type CreateElectronLoggerOptions = {
  nodeEnv?: string;
  baseDir?: string;
  logDir?: string;
  logFile?: string;
};

const toConsoleArgs = (message: string, fields?: LogFields) =>
  fields && Object.keys(fields).length > 0 ? [message, fields] : [message];

const resolveBaseDir = (nodeEnv?: string) => {
  const normalizedEnv = (nodeEnv ?? process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (normalizedEnv === "production") {
    if (process.env.PORTABLE_EXECUTABLE_DIR?.trim()) {
      return process.env.PORTABLE_EXECUTABLE_DIR.trim();
    }
    return path.dirname(process.execPath);
  }
  return path.resolve(process.cwd(), "electron");
};

export const createElectronLogger = (options?: CreateElectronLoggerOptions): ElectronLogger => {
  const nodeEnv = (options?.nodeEnv ?? process.env.NODE_ENV ?? "").trim().toLowerCase();
  const baseDir = options?.baseDir ?? resolveBaseDir(nodeEnv);
  const logDir = (options?.logDir ?? "logs").trim() || "logs";
  const logFile = (options?.logFile ?? "electron.log").trim() || "electron.log";
  const logPath = path.join(baseDir, logDir, logFile);
  const shouldPersist = nodeEnv === "production";

  if (shouldPersist) {
    mkdirSync(path.dirname(logPath), { recursive: true });
  }

  const write = (level: LogLevel, message: string, fields?: LogFields) => {
    const sanitizedFields = sanitizeLogValue(fields ?? {}) as LogFields;
    const payload = {
      time: new Date().toISOString(),
      level,
      msg: message,
      ...sanitizedFields
    };

    if (level === "error") {
      console.error(...toConsoleArgs(message, sanitizedFields));
    } else if (level === "warn") {
      console.warn(...toConsoleArgs(message, sanitizedFields));
    } else {
      console.log(...toConsoleArgs(message, sanitizedFields));
    }

    if (shouldPersist) {
      appendFileSync(logPath, `${JSON.stringify(payload)}\n`, "utf8");
    }
  };

  return {
    logPath: shouldPersist ? logPath : undefined,
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields)
  };
};

let activeLogger = createElectronLogger();

export const initializeElectronLogger = (options?: CreateElectronLoggerOptions) => {
  activeLogger = createElectronLogger(options);
  return activeLogger;
};

export const getElectronLogger = () => activeLogger;
