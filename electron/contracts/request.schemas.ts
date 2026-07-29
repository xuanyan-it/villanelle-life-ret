import { z } from "zod";

import {
  type ActiveEvaluationJobsResponse,
  type BaseInstituteCreateRequest,
  type BaseInstituteCredentialRequest,
  type BaseInstituteListRequest,
  type BaseInstituteRegisterRequest,
  type BaseInstituteVerifyRequest,
  type BaseEvaluationJobStatusRequest,
  type BaseEvaluationJobStatusResponse,
  type BatchEnqueueEvaluationJobRequest,
  type BatchEnqueueEvaluationJobResponse,
  type BaseRecordCreateRequest,
  type BaseRecordDeleteRequest,
  type BaseRecordListRequest,
  type BaseRecordUpdateRequest,
  type BaseUserCreateRequest,
  type BaseUserDeleteRequest,
  type BaseUserListRequest,
  type BaseUserLoginRequest,
  BaseInstituteCreateRequestSchema,
  BaseInstituteCredentialRequestSchema,
  BaseInstituteListRequestSchema,
  BaseInstituteRegisterRequestSchema,
  BaseInstituteVerifyRequestSchema,
  BaseEvaluationJobStatusRequestSchema,
  BaseEvaluationJobStatusResponseSchema,
  BatchEnqueueEvaluationJobRequestSchema,
  BatchEnqueueEvaluationJobResponseSchema,
  ActiveEvaluationJobsResponseSchema,
  BaseRecordCreateRequestSchema,
  BaseRecordDeleteRequestSchema,
  BaseRecordListRequestSchema,
  BaseRecordUpdateRequestSchema,
  BaseUserCreateRequestSchema,
  BaseUserDeleteRequestSchema,
  BaseUserListRequestSchema,
  BaseUserLoginRequestSchema
} from "@villanelle/ret-shared/contracts/base";
import { GenderSchema } from "@villanelle/ret-shared/domain";

export const PlatformIpcChannel = {
  userLogin: "userLogin",
  userCreate: "userCreate",
  userDelete: "userDelete",
  userList: "userList",
  userLogout: "userLogout",
  instituteList: "instituteList",
  instituteCreate: "instituteCreate",
  instituteRegister: "instituteRegister",
  instituteVerify: "verifyInstituteToken",
  instituteCredential: "getInstituteCredential",
  isBootstrapRequired: "isBootstrapRequired",
  recordList: "fetchSampleRecords",
  recordCreate: "createSampleRecords",
  recordEvaluationJobBatchEnqueue: "batchEnqueueEvaluationJobs",
  recordEvaluationJobStatus: "evaluationJobStatus",
  recordEvaluationJobActive: "activeEvaluationJobs",
  recordEvaluationJobCancel: "cancelEvaluationJob",
  recordUpdate: "updateSampleRecords",
  recordDelete: "deleteSampleRecords",
  modelConfig: "getModelConfig",
  download: "download",
  quitApp: "quitApp"
} as const;

export const ElectronGenderSchema = z.enum(GenderSchema.options);

// User
export const ElectronUserCreateRequestSchema = BaseUserCreateRequestSchema;
export const ElectronUserLoginRequestSchema = BaseUserLoginRequestSchema;
export const ElectronUserDeleteRequestSchema = BaseUserDeleteRequestSchema;
export const ElectronUserListRequestSchema = BaseUserListRequestSchema;

// Institute
export const ElectronInstituteListRequestSchema = BaseInstituteListRequestSchema;
export const ElectronInstituteCreateRequestSchema = BaseInstituteCreateRequestSchema;
export const ElectronInstituteRegisterRequestSchema = BaseInstituteRegisterRequestSchema;
export const ElectronInstituteCredentialRequestSchema = BaseInstituteCredentialRequestSchema;
export const ElectronInstituteVerifyRequestSchema = BaseInstituteVerifyRequestSchema;

// Record
export const ElectronFetchSampleRecordsRequestSchema = BaseRecordListRequestSchema;
export const ElectronCreateSampleRecordsRequestSchema = BaseRecordCreateRequestSchema.extend({
  patientGender: ElectronGenderSchema,
}).required({ modelType: true });

export const ElectronUpdateSampleRecordsRequestSchema = BaseRecordUpdateRequestSchema
  .extend({
    patientGender: ElectronGenderSchema,
  })
  .required({
    isDeleted: true,
    modelType: true,
  });

export const ElectronDeleteSampleRecordsRequestSchema = BaseRecordDeleteRequestSchema;
export const ElectronBatchEnqueueEvaluationJobRequestSchema = BatchEnqueueEvaluationJobRequestSchema;
export const ElectronEvaluationJobStatusRequestSchema = BaseEvaluationJobStatusRequestSchema;
export const ElectronEvaluationJobCancelRequestSchema = z.object({
  jobUuid: z.string().uuid()
});
export const ElectronActiveEvaluationJobsRequestSchema = z.object({
  instituteName: z.string().min(1)
});
export const ElectronBatchEnqueueEvaluationJobResponseSchema = BatchEnqueueEvaluationJobResponseSchema;
export const ElectronEvaluationJobStatusResponseSchema = BaseEvaluationJobStatusResponseSchema;
export const ElectronActiveEvaluationJobsResponseSchema = ActiveEvaluationJobsResponseSchema;

export type ElectronUserCreateRequest = BaseUserCreateRequest;
export type ElectronUserLoginRequest = BaseUserLoginRequest;
export type ElectronUserDeleteRequest = BaseUserDeleteRequest;
export type ElectronUserListRequest = BaseUserListRequest;

export type ElectronInstituteListRequest = BaseInstituteListRequest;
export type ElectronInstituteCreateRequest = BaseInstituteCreateRequest;
export type ElectronInstituteRegisterRequest = BaseInstituteRegisterRequest;
export type ElectronInstituteCredentialRequest = BaseInstituteCredentialRequest;
export type ElectronInstituteVerifyRequest = BaseInstituteVerifyRequest;

export type ElectronCreateSampleRecordsRequest = BaseRecordCreateRequest;
export type ElectronFetchSampleRecordsRequest = BaseRecordListRequest;
export type ElectronUpdateSampleRecordsRequest = BaseRecordUpdateRequest & { isDeleted: number };
export type ElectronDeleteSampleRecordsRequest = BaseRecordDeleteRequest;
export type ElectronBatchEnqueueEvaluationJobRequest = BatchEnqueueEvaluationJobRequest;
export type ElectronEvaluationJobStatusRequest = BaseEvaluationJobStatusRequest;
export type ElectronEvaluationJobCancelRequest = { jobUuid: string };
export type ElectronActiveEvaluationJobsRequest = { instituteName: string };
export type ElectronBatchEnqueueEvaluationJobResponse = BatchEnqueueEvaluationJobResponse;
export type ElectronEvaluationJobStatusResponse = BaseEvaluationJobStatusResponse;
export type ElectronActiveEvaluationJobsResponse = ActiveEvaluationJobsResponse;
