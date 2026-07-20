import { z } from "zod";

export const BaseModelConfigSchema = z.object({
  modelVersion: z.string().regex(/^LNM-\d+\.\d+$/).default("LNM-1.0"),
  resultPositiveThreshold: z.number()
});

export type BaseModelConfig = z.infer<typeof BaseModelConfigSchema>;
