import { toErrorEnvelope, toSuccessEnvelope } from "@villanelle/ret-shared/contracts/envelope.helpers";

type ItemParser<T> = { parse: (input: unknown) => T };
type ResponseCode = 0 | 1;
type ResponseStatus = "success" | "error";

export interface BaseResponse<T = unknown> {
  code: ResponseCode;
  status: ResponseStatus;
  payload: T[];
  meta: Record<string, unknown>;
  message: string;
}

const parseArrayIfNeeded = <T>(items: T[], itemSchema?: ItemParser<T>): T[] =>
  itemSchema ? items.map((item) => itemSchema.parse(item)) : items;

export const ok = <T>(payload: T, message = "", itemSchema?: ItemParser<T>): BaseResponse<T> => {
  return toSuccessEnvelope(parseArrayIfNeeded([payload], itemSchema), {}, message) as BaseResponse<T>;
};

export const fail = <T>(message = "", payload: T[] = [], itemSchema?: ItemParser<T>): BaseResponse<T> => {
  return toErrorEnvelope(message, parseArrayIfNeeded(payload, itemSchema), {}) as BaseResponse<T>;
};
