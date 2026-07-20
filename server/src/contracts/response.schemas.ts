import { z } from "zod";

import {
  type QueryResponseData,
  createErrorEnvelopeSchema,
  createQueryResultSchema,
  createSuccessEnvelopeSchema
} from "@villanelle/ret-shared/contracts";
import {
  type BaseAuthResult,
  type BaseInstitute,
  type BaseInstituteCredential,
  type BaseRecordResponse,
  type BaseEvaluationJobStatusResponse,
  type BatchEnqueueEvaluationJobResponse,
  type ActiveEvaluationJobsResponse,
  type BaseUser,
  BaseAuthResultSchema,
  BaseInstituteCredentialSchema,
  BaseInstituteSchema,
  BaseRecordResponseSchema,
  BaseUserSummarySchema,
  BaseEvaluationJobStatusResponseSchema,
  BatchEnqueueEvaluationJobResponseSchema,
  ActiveEvaluationJobsResponseSchema,
  BaseUserSchema
} from "@villanelle/ret-shared/contracts/base";
import { GenderSchema, SampleTypeSchema } from "@villanelle/ret-shared/domain";

export const ServerUserSchema = BaseUserSchema;
export const ServerUserSummarySchema = BaseUserSummarySchema;
export const ServerInstituteSchema = BaseInstituteSchema;
export const ServerInstituteCredentialSchema = BaseInstituteCredentialSchema;
export const ServerRecordSchema = BaseRecordResponseSchema.omit({
  id: true,
  checkerName: true
}).extend({
  patientGender: z.enum(GenderSchema.options),
  sampleType: z.enum(SampleTypeSchema.options)
});
export const ServerAuthResultSchema = BaseAuthResultSchema;

export const ServerUserQuerySchema = createQueryResultSchema(ServerUserSchema);
export const ServerInstituteQuerySchema = createQueryResultSchema(ServerInstituteSchema);
export const ServerInstituteCredentialQuerySchema = createQueryResultSchema(ServerInstituteCredentialSchema);
export const ServerRecordQuerySchema = createQueryResultSchema(ServerRecordSchema);

export const ServerAuthSuccessEnvelopeSchema = createSuccessEnvelopeSchema(ServerAuthResultSchema);
export const ServerUserQuerySuccessEnvelopeSchema = createSuccessEnvelopeSchema(ServerUserQuerySchema);
export const ServerInstituteQuerySuccessEnvelopeSchema = createSuccessEnvelopeSchema(ServerInstituteQuerySchema);
export const ServerInstituteCredentialQuerySuccessEnvelopeSchema = createSuccessEnvelopeSchema(
  ServerInstituteCredentialQuerySchema
);
export const ServerRecordQuerySuccessEnvelopeSchema = createSuccessEnvelopeSchema(ServerRecordQuerySchema);
export const ServerRecordCreateSuccessEnvelopeSchema = createSuccessEnvelopeSchema(ServerRecordSchema);
export const ServerInstituteCreateSuccessEnvelopeSchema = createSuccessEnvelopeSchema(ServerInstituteSchema);
export const ServerDeleteSuccessEnvelopeSchema = createSuccessEnvelopeSchema(z.boolean());
export const ServerDeleteErrorEnvelopeSchema = createErrorEnvelopeSchema(z.boolean());

export const ServerEvaluationJobStatusResponseSchema = BaseEvaluationJobStatusResponseSchema;
export const ServerEvaluationJobStatusSuccessEnvelopeSchema = createSuccessEnvelopeSchema(
  ServerEvaluationJobStatusResponseSchema
);

export const ServerBatchEnqueueEvaluationJobResponseSchema = BatchEnqueueEvaluationJobResponseSchema;
export const ServerBatchEnqueueEvaluationJobSuccessEnvelopeSchema = createSuccessEnvelopeSchema(
  ServerBatchEnqueueEvaluationJobResponseSchema
);

export const ServerActiveEvaluationJobsResponseSchema = ActiveEvaluationJobsResponseSchema;
export const ServerActiveEvaluationJobsSuccessEnvelopeSchema = createSuccessEnvelopeSchema(
  ServerActiveEvaluationJobsResponseSchema
);

export type ServerAuthResult = BaseAuthResult;
export type ServerUser = BaseUser;
export type ServerInstitute = BaseInstitute;
export type ServerInstituteCredential = BaseInstituteCredential;
export type ServerRecord = Omit<BaseRecordResponse, "id" | "checkerName">;
export type ServerUserQuery = QueryResponseData<ServerUser>;
export type ServerInstituteQuery = QueryResponseData<ServerInstitute>;
export type ServerInstituteCredentialQuery = QueryResponseData<ServerInstituteCredential>;
export type ServerRecordQuery = QueryResponseData<ServerRecord>;

export type ServerEvaluationJobStatusResponse = BaseEvaluationJobStatusResponse;

export type ServerBatchEnqueueEvaluationJobResponse = BatchEnqueueEvaluationJobResponse;
export type ServerActiveEvaluationJobsResponse = ActiveEvaluationJobsResponse;
