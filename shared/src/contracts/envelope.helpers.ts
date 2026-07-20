import { EnvelopeSchema } from "./envelope.schemas";

type EnvelopeStatus = "success" | "error";
type EnvelopeCode = 0 | 1;

type EnvelopeInput<T> = {
  code: EnvelopeCode;
  status: EnvelopeStatus;
  payload: T[];
  meta?: Record<string, unknown>;
  message?: string;
};

const toEnvelope = <T>(input: EnvelopeInput<T>) => {
  const envelope = {
    code: input.code,
    status: input.status,
    payload: input.payload,
    meta: input.meta ?? {},
    message: input.message ?? ""
  };
  EnvelopeSchema.parse(envelope);
  return envelope;
};

export const toSuccessEnvelope = <T>(
  payload: T[],
  meta?: Record<string, unknown>,
  message?: string
) => toEnvelope({ code: 0, status: "success", payload, meta, message });

export const toErrorEnvelope = <T>(
  message: string,
  payload: T[] = [],
  meta?: Record<string, unknown>
) => toEnvelope({ code: 1, status: "error", payload, meta, message });
