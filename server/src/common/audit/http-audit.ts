import { randomUUID } from "node:crypto";

import type { AuditEvent } from "@villanelle/ret-shared/contracts";
import { buildAuditEvent } from "@villanelle/ret-shared/contracts";
import { sanitizeLogValue } from "@villanelle/ret-shared/contracts/log-redaction";
import type { Request } from "express";
import { createSanitizedLogger } from "../logging/sanitized-logger";

const auditLogger = createSanitizedLogger("AuditTrail");

type RequestWithAuth = Request & {
  authUser?: {
    username: string;
    instituteName: string;
    userRole: string;
  };
};

export const resolveSourceIp = (request: Request): string | undefined => {
  const headers = request.headers ?? {};
  const forwarded = headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim();
  }
  return request.ip;
};

export const resolveUserAgent = (request: Request): string | undefined => {
  const headers = request.headers ?? {};
  const userAgent = headers["user-agent"];
  return typeof userAgent === "string" && userAgent.trim().length > 0 ? userAgent : undefined;
};

export const resolveUserIdentity = (request: RequestWithAuth): AuditEvent["userIdentity"] => {
  if (!request.authUser) {
    return {
      type: "Anonymous"
    };
  }
  return {
    type: "AuthenticatedUser",
    principalId: request.authUser.username,
    accountId: request.authUser.instituteName,
    userName: request.authUser.username,
    invokedBy: request.authUser.userRole
  };
};

export const emitHttpAuditEvent = (event: Omit<AuditEvent, "eventID" | "eventTime">): void => {
  const payload = buildAuditEvent({
    eventID: randomUUID(),
    eventTime: new Date().toISOString(),
    ...event
  });
  auditLogger.debug?.(JSON.stringify(sanitizeLogValue(payload)));
};
