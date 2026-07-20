import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type { ZodType } from "zod";

export const parseIpcPayload = <T>(schema: ZodType<T>, payload: unknown): T => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(SharedClientErrorMessage.invalidPayload);
  }
  return parsed.data;
};
