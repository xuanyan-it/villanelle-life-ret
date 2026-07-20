import { z } from "zod";

import { UserRoleSchema } from "../auth.schemas";
import { NonEmptyStringSchema } from "../primitives.schemas";
import { PasswordPolicySchema } from "../security-policy";

export const BaseUserSchema = z.object({
  id: z.number().int(),
  uuid: z.string(),
  instituteName: z.string(),
  userRole: UserRoleSchema,
  email: z.string(),
  username: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string(),
  isActivated: z.boolean()
});

export const BaseUserSummarySchema = BaseUserSchema.pick({
  uuid: true,
  instituteName: true,
  userRole: true,
  email: true,
  username: true
});

export const BaseAuthResultSchema = z.object({
  uuid: z.string(),
  instituteName: z.string(),
  username: z.string(),
  email: z.string(),
  accessToken: z.string(),
  userRole: UserRoleSchema
});

export const BaseUserLoginRequestSchema = z.object({
  email: NonEmptyStringSchema,
  password: NonEmptyStringSchema
});

export const BaseUserCreateRequestSchema = z.object({
  instituteName: NonEmptyStringSchema,
  email: NonEmptyStringSchema,
  username: NonEmptyStringSchema,
  password: PasswordPolicySchema,
  userRole: UserRoleSchema
});

export const BaseUserDeleteByUuidSchema = z.object({
  uuid: NonEmptyStringSchema
});
export const BaseUserDeleteRequestSchema = z.array(BaseUserDeleteByUuidSchema);

export const BaseUserListRequestSchema = z.object({
  uuid: z.string().optional(),
  email: z.string().optional(),
  username: z.string().optional(),
  instituteName: z.string().optional(),
  userRole: UserRoleSchema.optional()
});

export type BaseUserSummary = z.infer<typeof BaseUserSummarySchema>;
export type BaseUser = z.infer<typeof BaseUserSchema>;
export type BaseAuthResult = z.infer<typeof BaseAuthResultSchema>;
export type BaseUserLoginRequest = z.infer<typeof BaseUserLoginRequestSchema>;
export type BaseUserCreateRequest = z.infer<typeof BaseUserCreateRequestSchema>;
export type BaseUserDeleteByUuidRequest = z.infer<typeof BaseUserDeleteByUuidSchema>;
export type BaseUserDeleteRequest = z.infer<typeof BaseUserDeleteRequestSchema>;
export type BaseUserListRequest = z.infer<typeof BaseUserListRequestSchema>;
