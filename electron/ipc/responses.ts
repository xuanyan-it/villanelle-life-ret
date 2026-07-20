import type { BaseResponse } from "../types";
import {
  SHARED_SAFE_CLIENT_MESSAGES
} from "@villanelle/ret-shared/contracts";
import { toErrorEnvelope as toErrorEnvelopeHelper, toSuccessEnvelope as toSuccessEnvelopeHelper } from "@villanelle/ret-shared/contracts/envelope.helpers";

export const okResponse = <T>(payload: T[], meta: Record<string, unknown> = {}) =>
  toSuccessEnvelopeHelper(payload, meta, "") as BaseResponse<T>;

export const errorResponse = (message: string, meta: Record<string, unknown> = {}) =>
  toErrorEnvelopeHelper(message, [], meta) as BaseResponse<never>;

export const toClientErrorMessage = (error: unknown, fallback: string): string => {
  const message = error instanceof Error ? error.message : "";
  return SHARED_SAFE_CLIENT_MESSAGES.has(message) ? message : fallback;
};
