import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor
} from "@nestjs/common";
import {
  Injectable
} from "@nestjs/common";
import type { Observable} from "rxjs";
import { tap } from "rxjs";
import { createSanitizedLogger } from "../../logging/sanitized-logger";

import {
  emitHttpAuditEvent,
  resolveSourceIp,
  resolveUserAgent,
  resolveUserIdentity
} from "../../audit/http-audit";

const interceptorLogger = createSanitizedLogger("HttpInterceptor");

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method?: string;
      originalUrl?: string;
      requestId?: string;
      headers: Record<string, unknown>;
      ip?: string;
      authUser?: {
        username: string;
        instituteName: string;
        userRole: string;
      };
    }>();
    const response = http.getResponse<{
      setHeader: (name: string, value: string) => void;
      statusCode?: number;
      headersSent?: boolean;
    }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - startedAt;
          if (!response.headersSent) {
            response.setHeader("x-response-time", `${elapsed}ms`);
          }
          interceptorLogger.debug?.(
            `${request.method ?? "UNKNOWN"} ${request.originalUrl ?? ""} status=${response.statusCode ?? 0} ${elapsed}ms requestId=${request.requestId ?? "-"}`
          );
          emitHttpAuditEvent({
            eventName: "http.request",
            eventType: "Management",
            eventSource: "Ret.server.http",
            eventVersion: "1.0",
            requestID: request.requestId,
            status: "Success",
            sourceIPAddress: resolveSourceIp(request as any),
            userAgent: resolveUserAgent(request as any),
            userIdentity: resolveUserIdentity(request as any),
            requestParameters: {
              method: request.method ?? "UNKNOWN",
              path: request.originalUrl ?? ""
            },
            resources: [
              {
                type: "http.route",
                id: request.originalUrl ?? ""
              }
            ],
            responseElements: {
              statusCode: response.statusCode ?? 0,
              responseTimeMs: elapsed
            }
          });
        }
      })
    );
  }
}
