import type {
  ArgumentsHost,
  ExceptionFilter} from "@nestjs/common";
import {
  Catch,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  SHARED_SAFE_CLIENT_MESSAGES,
  SharedClientErrorMessage
} from "@villanelle/ret-shared/contracts";
import { sanitizeLogMessage } from "@villanelle/ret-shared/contracts/log-redaction";
import type { Response } from "express";

import { fail } from "../../envelope/response";
import {
  emitHttpAuditEvent,
  resolveSourceIp,
  resolveUserAgent,
  resolveUserIdentity
} from "../../audit/http-audit";
import { createSanitizedLogger } from "../../logging/sanitized-logger";

const exceptionLogger = createSanitizedLogger("ExceptionFilter");
const SERVER_SAFE_CLIENT_MESSAGES = new Set<string>([...SHARED_SAFE_CLIENT_MESSAGES]);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{
      requestId?: string;
      method?: string;
      url?: string;
      originalUrl?: string;
      headers: Record<string, unknown>;
      ip?: string;
      authUser?: {
        username: string;
        instituteName: string;
        userRole: string;
      };
    }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception);
    const clientMessage = this.resolveClientMessage(status, message);
    exceptionLogger.error(
      sanitizeLogMessage(
        `${request.method ?? "UNKNOWN"} ${request.url ?? ""} status=${status} requestId=${request.requestId ?? "-"} ${message}`
      ),
      exception instanceof Error ? exception.stack : undefined
    );
    emitHttpAuditEvent({
      eventName: "http.request",
      eventType: "Management",
      eventSource: "Ret.server.http",
      eventVersion: "1.0",
      requestID: request.requestId,
      status: "Failure",
      sourceIPAddress: resolveSourceIp(request as any),
      userAgent: resolveUserAgent(request as any),
      userIdentity: resolveUserIdentity(request as any),
      requestParameters: {
        method: request.method ?? "UNKNOWN",
        path: request.originalUrl ?? request.url ?? ""
      },
      resources: [
        {
          type: "http.route",
          id: request.originalUrl ?? request.url ?? ""
        }
      ],
      errorCode: `HTTP_${status}`,
      errorMessage: clientMessage
    });

    if (response.headersSent) {
      return;
    }

    response.status(status).json(fail(clientMessage));
  }

  private resolveMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === "string") return payload;
      if (typeof payload === "object" && payload !== null && "message" in payload) {
        const message = (payload as { message?: unknown }).message;
        if (typeof message === "string") return message;
        if (Array.isArray(message) && typeof message[0] === "string") return message[0];
      }
      return exception.message || "request failed";
    }
    if (exception instanceof Error) {
      return exception.message || SharedClientErrorMessage.internalServerError;
    }
    return SharedClientErrorMessage.internalServerError;
  }

  private resolveClientMessage(status: number, rawMessage: string): string {
    const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
    if (nodeEnv !== "production") {
      return rawMessage;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return SharedClientErrorMessage.internalServerError;
    }

    if (SERVER_SAFE_CLIENT_MESSAGES.has(rawMessage)) {
      return rawMessage;
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return SharedClientErrorMessage.invalidRequest;
      case HttpStatus.UNAUTHORIZED:
        return SharedClientErrorMessage.unauthorized;
      case HttpStatus.FORBIDDEN:
        return SharedClientErrorMessage.forbidden;
      case HttpStatus.NOT_FOUND:
        return SharedClientErrorMessage.notFound;
      case HttpStatus.CONFLICT:
        return SharedClientErrorMessage.conflict;
      default:
        return SharedClientErrorMessage.requestFailed;
    }
  }
}

