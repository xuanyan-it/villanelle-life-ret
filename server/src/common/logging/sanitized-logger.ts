import { Logger, type LoggerService } from "@nestjs/common";
import { sanitizeLogMessage, sanitizeLogValue } from "@villanelle/ret-shared/contracts/log-redaction";

const toLogText = (value: unknown): string => {
  const sanitized = sanitizeLogValue(value);
  if (typeof sanitized === "string") {
    return sanitizeLogMessage(sanitized);
  }
  try {
    return sanitizeLogMessage(JSON.stringify(sanitized));
  } catch {
    return sanitizeLogMessage(String(sanitized));
  }
};

const toOptionalContext = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  return toLogText(value);
};

class SanitizedNestLogger implements LoggerService {
  private readonly base: Logger;

  constructor(context: string) {
    this.base = new Logger(context);
  }

  private callWithOptionalContext(
    fn: (message: string, context?: string) => void,
    message: unknown,
    contextLike: unknown
  ): void {
    const rendered = toOptionalContext(contextLike);
    if (rendered === undefined) {
      fn.call(this.base, toLogText(message));
      return;
    }
    fn.call(this.base, toLogText(message), rendered);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.callWithOptionalContext(this.base.log, message, optionalParams[0]);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.callWithOptionalContext(this.base.warn, message, optionalParams[0]);
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.callWithOptionalContext(this.base.debug, message, optionalParams[0]);
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.callWithOptionalContext(this.base.verbose, message, optionalParams[0]);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const trace =
      typeof optionalParams[0] === "string"
        ? sanitizeLogMessage(optionalParams[0])
        : toOptionalContext(optionalParams[0]);
    const context = toOptionalContext(optionalParams[1]);
    this.base.error(toLogText(message), trace, context);
  }
}

export const createSanitizedLogger = (context: string): LoggerService =>
  new SanitizedNestLogger(context);
