import { z } from "zod";

import { commonEnvSchema, parseEnv } from "@villanelle/ret-shared/config";

export const electronEnvSchema = commonEnvSchema.extend({
  PORTABLE_EXECUTABLE_DIR: z.string().optional(),
  MODEL_DIR: z.string().optional(),
});

export const parseElectronEnv = (raw: Record<string, unknown>) => parseEnv(electronEnvSchema, raw, "electron");

