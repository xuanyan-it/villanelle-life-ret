import { z } from "zod";

import { parseEnv } from "@villanelle/ret-shared/config";

const parseJwtExpiresSeconds = (value: string): number | null => {
  const normalized = value.trim().toLowerCase();
  const match = /^(\d+)\s*([smhd])$/.exec(normalized);
  const amountRaw = match?.[1];
  const unit = match?.[2];
  if (!amountRaw || !unit) return null;
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  };
  const factor = unitSeconds[unit];
  if (factor === undefined) return null;
  return amount * factor;
};

export { parseJwtExpiresSeconds };

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(7001),
    DATABASE_URL: z
      .string()
      .url()
      .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
        message: "DATABASE_URL must start with postgres:// or postgresql://",
      })
      .optional(),
    MODEL_ROOT: z.string().optional(),
    TEMPLATE_DIR: z.string().optional(),
    TEMPLATE_FILENAME: z.string().default("template_zh-CN.csv"),
    SERVICE_EVAL_SCRIPT: z.string().optional(),
    SERVICE_PYTHON_CMD: z.string().optional(),
    JWT_SECRET: z.string().min(16).default("dev-change-me-please"),
    JWT_EXPIRES_IN: z.string().default("24h"),
    AUTH_COOKIE_NAME: z.string().default("ret_at"),
  })
  .superRefine((value, ctx) => {
    if (!value.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required",
      });
    }

    const nodeEnv = value.NODE_ENV.trim().toLowerCase();
    if (nodeEnv !== "production") return;

    if (value.JWT_SECRET === "dev-change-me-please") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be explicitly configured in production",
      });
    }
  })
  .superRefine((value, ctx) => {
    const expiresInSeconds = parseJwtExpiresSeconds(value.JWT_EXPIRES_IN);
    if (expiresInSeconds === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_EXPIRES_IN"],
        message: "JWT_EXPIRES_IN must use s/m/h/d format, for example: 24h",
      });
      return;
    }

    if (expiresInSeconds > 24 * 60 * 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_EXPIRES_IN"],
        message: "JWT_EXPIRES_IN must not exceed 24h",
      });
    }
  });

export const parseServerEnv = (raw: Record<string, unknown>) => parseEnv(serverEnvSchema, raw, "server");
