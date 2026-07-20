import { z } from "zod";

export const createQueryResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    total: z.number().int().nonnegative(),
    result: z.array(itemSchema)
  });
