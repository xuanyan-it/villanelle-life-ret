import { z } from "zod";
import type { QueryResult } from "./common.types";

export const DomainUserRoleSchema = z.enum(["administrator", "operator"]);
export type UserRole = z.infer<typeof DomainUserRoleSchema>;
export const UserRole = {
  Administrator: "administrator",
  Operator: "operator"
} as const satisfies Record<string, UserRole>;

export const UserIdentitySchema = z.object({
  uuid: z.string(),
  instituteName: z.string(),
  userRole: DomainUserRoleSchema,
  email: z.string(),
  username: z.string()
});
export type UserIdentity = z.infer<typeof UserIdentitySchema>;

export const UserSchema = UserIdentitySchema.extend({
  id: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string(),
  isActivated: z.boolean()
});
export type User = z.infer<typeof UserSchema>;

export interface AuthTokenPort {
  issueToken(input: {
    username: string;
    instituteName: string;
    email: string;
    userRole: UserRole;
  }): string;
}

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | undefined>;
  findByUsername(username: string): Promise<User | undefined>;
  login(email: string, password: string): Promise<User | undefined>;
  create(input: {
    instituteName: string;
    email: string;
    username: string;
    password: string;
    userRole: UserRole;
  }): Promise<User>;
  list(filters: {
    uuid?: string;
    email?: string;
    username?: string;
    instituteName?: string;
    userRole?: UserRole;
  }): Promise<QueryResult<User>>;
  deleteByUuids(uuids: string[]): Promise<boolean>;
}
