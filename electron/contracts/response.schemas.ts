import { z } from "zod";

import {
  type BaseAuthResult,
  type BaseInstituteCredential,
  type BaseRecordResponse,
  type BaseUserSummary,
  BaseAuthResultSchema,
  BaseInstituteCredentialSchema,
  BaseRecordResponseSchema,
  BaseUserSummarySchema
} from "@villanelle/ret-shared/contracts/base";
import { type QueryResponseData, createQueryResultSchema, createSuccessEnvelopeSchema } from "@villanelle/ret-shared/contracts";

import { ElectronGenderSchema, ElectronSampleTypeSchema } from "./request.schemas";

export const ElectronInstituteCredentialResultSchema = BaseInstituteCredentialSchema;

export const ElectronInstituteCredentialQuerySchema = createQueryResultSchema(ElectronInstituteCredentialResultSchema);

export const ElectronAuthResultSchema = BaseAuthResultSchema.extend({
  status: z.literal("success")
});

export const ElectronDeleteByUuidResultSchema = z.object({
  uuid: z.string()
});

export const ElectronDeleteByUuidQuerySchema = createQueryResultSchema(ElectronDeleteByUuidResultSchema);

export const ElectronUserSchema = BaseUserSummarySchema;

export const ElectronUserQuerySchema = createQueryResultSchema(ElectronUserSchema);

export const ElectronSampleRecordSchema = BaseRecordResponseSchema.omit({
  checkerName: true,
  id: true
}).extend({
  patientGender: ElectronGenderSchema,
  sampleType: ElectronSampleTypeSchema
});

export const ElectronSampleRecordQuerySchema = createQueryResultSchema(ElectronSampleRecordSchema);

export const ElectronAuthSuccessEnvelopeSchema = createSuccessEnvelopeSchema(ElectronAuthResultSchema);
export const ElectronUserQuerySuccessEnvelopeSchema = createSuccessEnvelopeSchema(ElectronUserQuerySchema);
export const ElectronInstituteCredentialSuccessEnvelopeSchema = createSuccessEnvelopeSchema(
  ElectronInstituteCredentialQuerySchema
);
export const ElectronDeleteByUuidSuccessEnvelopeSchema = createSuccessEnvelopeSchema(ElectronDeleteByUuidQuerySchema);
export const ElectronSampleRecordQuerySuccessEnvelopeSchema = createSuccessEnvelopeSchema(ElectronSampleRecordQuerySchema);

export type ElectronAuthResult = BaseAuthResult & { status: "success" };
export type ElectronInstituteCredentialResult = BaseInstituteCredential;
export type ElectronDeleteByUuidResult = { uuid: string };
export type ElectronSampleRecord = Omit<BaseRecordResponse, "id" | "checkerName">;
export type ElectronSampleRecordQuery = QueryResponseData<ElectronSampleRecord>;
export type ElectronUser = BaseUserSummary;
