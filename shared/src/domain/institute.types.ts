import { z } from "zod";
import type { QueryResult } from "./common.types";

export const InstituteSchema = z.object({
  id: z.number().int(),
  uuid: z.string(),
  instituteName: z.string(),
  createdAt: z.string(),
  isDeleted: z.number().int()
});
export type Institute = z.infer<typeof InstituteSchema>;

export interface InstituteRepositoryPort {
  list(filters: {
    uuid?: string;
    instituteName?: string;
  }): Promise<QueryResult<Institute>>;
  create(instituteName: string): Promise<Institute>;
  verifyToken(token: string): Promise<QueryResult<Institute>>;
}
