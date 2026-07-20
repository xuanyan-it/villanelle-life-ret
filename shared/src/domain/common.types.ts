import { z } from "zod";

export const DomainErrorSchema = z.object({
  code: z.string(),
  message: z.string()
});
export type DomainError = z.infer<typeof DomainErrorSchema>;

export interface QueryResult<T> {
  total: number;
  result: T[];
}
