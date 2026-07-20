import { randomUUID } from "node:crypto";

import { emitIpcAuditEvent } from "../infrastructure/audit";
import { getElectronLogger } from "../infrastructure/logger";

type IpcRequestContext = {
  requestId: string;
  meta: { requestId: string };
  logSuccess(): void;
  logError(error: unknown): void;
};

export const beginIpcRequest = (channel: string): IpcRequestContext => {
  const requestId = randomUUID();
  const logger = getElectronLogger();
  logger.info("[ipc] request start", { channel, requestId });
  emitIpcAuditEvent({ logger, channel, requestId, status: "Started" });

  return {
    requestId,
    meta: { requestId },
    logSuccess: () => {
      logger.info("[ipc] request success", { channel, requestId });
      emitIpcAuditEvent({ logger, channel, requestId, status: "Success" });
    },
    logError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[ipc] request error", { channel, requestId, error: message });
      emitIpcAuditEvent({ logger, channel, requestId, status: "Failure", errorMessage: message });
    }
  };
};
