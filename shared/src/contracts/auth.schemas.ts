import { z } from "zod";
import { DomainUserRoleSchema } from "../domain";

export const UserRoleSchema = z.enum(DomainUserRoleSchema.options);
