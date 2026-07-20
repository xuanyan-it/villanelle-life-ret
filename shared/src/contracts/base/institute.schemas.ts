import { z } from "zod";

import { NonEmptyStringSchema } from "../primitives.schemas";
import { PasswordPolicySchema } from "../security-policy";

export const BaseInstituteSchema = z.object({
  id: z.number().int(),
  uuid: z.string(),
  instituteName: z.string(),
  token: z.string(),
  createdAt: z.string(),
  isDeleted: z.number().int()
});

export const BaseInstituteCredentialSchema = BaseInstituteSchema.pick({
  uuid: true,
  instituteName: true,
  token: true
});

export const BaseInstituteListRequestSchema = z.object({
  uuid: z.string().optional(),
  instituteName: z.string().optional(),
  token: z.string().optional()
});

export const BaseInstituteCreateRequestSchema = z.object({
  instituteName: NonEmptyStringSchema
});

export const BaseInstituteCredentialRequestSchema = z.object({
  instituteName: NonEmptyStringSchema
});

export const BaseInstituteVerifyRequestSchema = z.object({
  token: NonEmptyStringSchema
});

export const BaseInstituteRegisterRequestSchema = z.object({
  instituteName: NonEmptyStringSchema,
  email: NonEmptyStringSchema,
  username: NonEmptyStringSchema,
  password: PasswordPolicySchema
});

export type BaseInstituteListRequest = z.infer<typeof BaseInstituteListRequestSchema>;
export type BaseInstitute = z.infer<typeof BaseInstituteSchema>;
export type BaseInstituteCredential = z.infer<typeof BaseInstituteCredentialSchema>;
export type BaseInstituteCreateRequest = z.infer<typeof BaseInstituteCreateRequestSchema>;
export type BaseInstituteCredentialRequest = z.infer<typeof BaseInstituteCredentialRequestSchema>;
export type BaseInstituteVerifyRequest = z.infer<typeof BaseInstituteVerifyRequestSchema>;
export type BaseInstituteRegisterRequest = z.infer<typeof BaseInstituteRegisterRequestSchema>;
