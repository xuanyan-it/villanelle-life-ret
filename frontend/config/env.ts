import { z } from "zod";

import { parseEnv } from "@villanelle/ret-shared/config";

export const frontendEnvSchema = z.object({
  SERVICE_BASE_URL: z.string().url().default("http://localhost:7001"),
});

export const parseFrontendEnv = (raw: Record<string, unknown>) => parseEnv(frontendEnvSchema, raw, "frontend");

