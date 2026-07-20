import { z } from "zod";

export const ResponseMetaSchema = z.record(z.unknown());

export const SuccessEnvelopeSchema = z.object({
  code: z.literal(0),
  status: z.literal("success"),
  payload: z.array(z.unknown()),
  meta: ResponseMetaSchema,
  message: z.string()
});

export const ErrorEnvelopeSchema = z.object({
  code: z.literal(1),
  status: z.literal("error"),
  payload: z.array(z.unknown()),
  meta: ResponseMetaSchema,
  message: z.string()
});

export const EnvelopeSchema = z.union([SuccessEnvelopeSchema, ErrorEnvelopeSchema]);

export const createSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    code: z.literal(0),
    status: z.literal("success"),
    payload: z.array(itemSchema),
    meta: ResponseMetaSchema,
    message: z.string()
  });

export function createErrorEnvelopeSchema(): z.ZodObject<{
  code: z.ZodLiteral<1>;
  status: z.ZodLiteral<"error">;
  payload: z.ZodArray<z.ZodUnknown>;
  meta: typeof ResponseMetaSchema;
  message: z.ZodString;
}>;
export function createErrorEnvelopeSchema<T extends z.ZodTypeAny>(itemSchema: T): z.ZodObject<{
  code: z.ZodLiteral<1>;
  status: z.ZodLiteral<"error">;
  payload: z.ZodArray<T>;
  meta: typeof ResponseMetaSchema;
  message: z.ZodString;
}>;
export function createErrorEnvelopeSchema<T extends z.ZodTypeAny>(itemSchema?: T) {
  const resolved = itemSchema ?? z.unknown();
  return z.object({
    code: z.literal(1),
    status: z.literal("error"),
    payload: z.array(resolved),
    meta: ResponseMetaSchema,
    message: z.string()
  });
}