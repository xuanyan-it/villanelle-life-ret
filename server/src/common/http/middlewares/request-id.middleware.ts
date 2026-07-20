import { randomUUID } from "node:crypto";

import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { emitHttpAuditEvent, resolveSourceIp, resolveUserAgent } from "../../audit/http-audit";
import { createSanitizedLogger } from "../../logging/sanitized-logger";

const requestLogger = createSanitizedLogger("RequestMiddleware");

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers["x-request-id"];
    const requestId = typeof incoming === "string" && incoming.trim() ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    requestLogger.log(`${req.method} ${req.originalUrl} requestId=${requestId}`);
    emitHttpAuditEvent({
      eventName: "http.request",
      eventType: "Management",
      eventSource: "Ret.server.http",
      eventVersion: "1.0",
      requestID: requestId,
      status: "Started",
      sourceIPAddress: resolveSourceIp(req),
      userAgent: resolveUserAgent(req),
      requestParameters: {
        method: req.method,
        path: req.originalUrl
      },
      resources: [
        {
          type: "http.route",
          id: req.originalUrl
        }
      ]
    });
    next();
  }
}
