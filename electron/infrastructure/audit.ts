import { randomUUID } from "node:crypto";

import type { AuditEvent } from "@villanelle/ret-shared/contracts";
import { buildAuditEvent } from "@villanelle/ret-shared/contracts";

import type { ElectronLogger } from "./logger";

type AuditStatus = "Started" | "Success" | "Failure" | "Throttled";

type EmitIpcAuditParams = {
  logger: ElectronLogger;
  channel: string;
  requestId: string;
  status: AuditStatus;
  errorMessage?: string;
};

export const emitIpcAuditEvent = (params: EmitIpcAuditParams): void => {
  const event: AuditEvent = buildAuditEvent({
    eventID: randomUUID(),
    eventTime: new Date().toISOString(),
    eventName: "ipc.request",
    eventType: "Management",
    eventSource: "Ret.electron.ipc",
    eventVersion: "1.0",
    requestID: params.requestId,
    status: params.status,
    sourceIPAddress: "127.0.0.1",
    userAgent: `electron/${process.versions.electron ?? "unknown"}`,
    requestParameters: {
      channel: params.channel
    },
    resources: [
      {
        type: "ipc.channel",
        id: params.channel
      }
    ],
    errorCode: params.errorMessage ? "IPC_ERROR" : undefined,
    errorMessage: params.errorMessage
  });

  params.logger.info("[audit] event", { audit: event });
};
