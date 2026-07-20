import {
  type BaseInstituteCreateRequest,
  type BaseInstituteCredentialRequest,
  type BaseInstituteListRequest,
  type BaseInstituteRegisterRequest,
  type BaseInstituteVerifyRequest,
  type BaseRecordCreateRequest,
  type BaseRecordDeleteRequest,
  type BaseRecordListRequest,
  type BaseRecordUpdateRequest,
  type BaseEvaluationJobStatusRequest,
  type BaseEvaluationJobCancelRequest,
  type BatchEnqueueEvaluationJobRequest,
  type BatchEnqueueEvaluationJobResponse,
  type BaseUserCreateRequest,
  type BaseUserDeleteRequest,
  type BaseUserListRequest,
  type BaseUserLoginRequest,
  BaseInstituteCreateRequestSchema,
  BaseInstituteCredentialRequestSchema,
  BaseInstituteListRequestSchema,
  BaseInstituteRegisterRequestSchema,
  BaseInstituteVerifyRequestSchema,
  BaseRecordCreateRequestSchema,
  BaseRecordDeleteRequestSchema,
  BaseRecordListRequestSchema,
  BaseRecordUpdateRequestSchema,
  BaseEvaluationJobStatusRequestSchema,
  BaseEvaluationJobCancelRequestSchema,
  BatchEnqueueEvaluationJobRequestSchema,
  BaseUserCreateRequestSchema,
  BaseUserDeleteRequestSchema,
  BaseUserListRequestSchema,
  BaseUserLoginRequestSchema
} from "@villanelle/ret-shared/contracts/base";

export const ServerApiPath = {
  userLogin: "/api/user/login",
  userCreate: "/api/user/create",
  userLogout: "/api/user/logout",
  userDelete: "/api/user/delete",
  userList: "/api/user/list",
  instituteList: "/api/institute/list",
  instituteCreate: "/api/institute/create",
  instituteRegister: "/api/institute/register",
  instituteCredential: "/api/institute/credential/get",
  instituteVerify: "/api/institute/verify",
  modelConfig: "/api/model/config",
  runtimeProfile: "/api/model/runtime-profile",
  recordList: "/api/record/list",
  recordCreate: "/api/record/create",
  recordDelete: "/api/record/delete",
  recordUpdate: "/api/record/update",
  recordEvaluationJob: "/api/record/evaluation-jobs"
} as const;

// User
export const ServerUserLoginRequestSchema = BaseUserLoginRequestSchema;
export const ServerUserCreateRequestSchema = BaseUserCreateRequestSchema;
export const ServerUserDeleteRequestSchema = BaseUserDeleteRequestSchema;
export const ServerUserListRequestSchema = BaseUserListRequestSchema;

// Institute
export const ServerInstituteCreateRequestSchema = BaseInstituteCreateRequestSchema;
export const ServerInstituteRegisterRequestSchema = BaseInstituteRegisterRequestSchema;
export const ServerInstituteCredentialRequestSchema = BaseInstituteCredentialRequestSchema;
export const ServerInstituteListRequestSchema = BaseInstituteListRequestSchema;
export const ServerInstituteVerifyRequestSchema = BaseInstituteVerifyRequestSchema;

// Record
export const ServerRecordListRequestSchema = BaseRecordListRequestSchema;
export const ServerRecordCreateRequestSchema = BaseRecordCreateRequestSchema;
export const ServerRecordDeleteRequestSchema = BaseRecordDeleteRequestSchema;
export const ServerRecordUpdateRequestSchema = BaseRecordUpdateRequestSchema.required({ isDeleted: true });

// evaluation job
export const ServerEvaluationJobStatusRequestSchema = BaseEvaluationJobStatusRequestSchema;
export const ServerEvaluationJobCancelRequestSchema = BaseEvaluationJobCancelRequestSchema;

export const ServerBatchEnqueueEvaluationJobRequestSchema = BatchEnqueueEvaluationJobRequestSchema;

export type ServerUserLoginRequest = BaseUserLoginRequest;
export type ServerUserCreateRequest = BaseUserCreateRequest;
export type ServerUserDeleteRequest = BaseUserDeleteRequest;
export type ServerUserListRequest = BaseUserListRequest;

export type ServerInstituteCreateRequest = BaseInstituteCreateRequest;
export type ServerInstituteRegisterRequest = BaseInstituteRegisterRequest;
export type ServerInstituteCredentialRequest = BaseInstituteCredentialRequest;
export type ServerInstituteListRequest = BaseInstituteListRequest;
export type ServerInstituteVerifyRequest = BaseInstituteVerifyRequest;

export type ServerRecordListRequest = BaseRecordListRequest;
export type ServerRecordCreateRequest = BaseRecordCreateRequest;
export type ServerRecordDeleteRequest = BaseRecordDeleteRequest;
export type ServerRecordUpdateRequest = BaseRecordUpdateRequest & { isDeleted: number };

export type ServerEvaluationJobStatusRequest = BaseEvaluationJobStatusRequest;
export type ServerEvaluationJobCancelRequest = BaseEvaluationJobCancelRequest;

export type ServerBatchEnqueueEvaluationJobRequest = BatchEnqueueEvaluationJobRequest;
