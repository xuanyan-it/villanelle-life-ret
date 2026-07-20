import { ipcMain } from "electron";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type { ZodType } from "zod";

import type { IpcContext } from "./context";
import { beginIpcRequest } from "./requestContext";
import { errorResponse, okResponse, toClientErrorMessage } from "./responses";
import { parseIpcPayload } from "./validation";

type ProtectedMessage = typeof SharedClientErrorMessage.unauthorized | typeof SharedClientErrorMessage.forbidden;

const toProtectedErrorMessage = (error: unknown, fallback: string): string => {
  if (
    error instanceof Error &&
    (error.message === SharedClientErrorMessage.unauthorized ||
      error.message === SharedClientErrorMessage.forbidden)
  ) {
    return error.message;
  }
  return toClientErrorMessage(error, fallback);
};

type RegisterEnvelopeOptions<TPayload> = {
  schema?: ZodType<TPayload>;
  requireAuth?: boolean;
  fallbackMessage: string;
  preserveProtectedErrors?: boolean;
};

type RegisterRawOptions<TPayload> = {
  schema?: ZodType<TPayload>;
  requireAuth?: boolean;
};

export const createIpcHandlerFactory = (context: Pick<IpcContext, "authSession">) => ({
  registerEnvelope<TPayload, TResult>(
    channel: string,
    options: RegisterEnvelopeOptions<TPayload>,
    handler: (payload: TPayload, request: ReturnType<typeof beginIpcRequest>) => Promise<TResult[]>
  ) {
    ipcMain.handle(channel, async (_event, payload) => {
      const request = beginIpcRequest(channel);
      try {
        if (options.requireAuth) {
          context.authSession.requireAuthenticated();
        }
        const parsed = options.schema ? parseIpcPayload(options.schema, payload) : (payload as TPayload);
        const result = await handler(parsed, request);
        request.logSuccess();
        return okResponse(result, request.meta);
      } catch (error) {
        request.logError(error);
        const message = options.preserveProtectedErrors === false
          ? toClientErrorMessage(error, options.fallbackMessage)
          : toProtectedErrorMessage(error, options.fallbackMessage);
        return errorResponse(message, request.meta);
      }
    });
  },

  registerRaw<TPayload, TResult>(
    channel: string,
    options: RegisterRawOptions<TPayload>,
    handler: (payload: TPayload, request: ReturnType<typeof beginIpcRequest>) => Promise<TResult>
  ) {
    ipcMain.handle(channel, async (_event, payload) => {
      const request = beginIpcRequest(channel);
      try {
        if (options.requireAuth) {
          context.authSession.requireAuthenticated();
        }
        const parsed = options.schema ? parseIpcPayload(options.schema, payload) : (payload as TPayload);
        const result = await handler(parsed, request);
        request.logSuccess();
        return result;
      } catch (error) {
        request.logError(error);
        throw error;
      }
    });
  },

  toProtectedErrorMessage
});
