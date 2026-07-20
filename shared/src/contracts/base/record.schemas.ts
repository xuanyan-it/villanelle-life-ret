import { z } from "zod";

import { GenderSchema, SampleTypeSchema } from "../../domain";
import { NonEmptyStringSchema } from "../primitives.schemas";

export const BaseRecordListRequestSchema = z.object({
  instituteName: NonEmptyStringSchema,
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  deletedOnly: z.boolean().optional(),
  searchKeyword: z.string().trim().optional()
});

export const BaseRecordCreateRequestSchema = z.object({
  hospitalName: NonEmptyStringSchema,
  doctorName: z.string().optional(),
  patientName: z.string().optional(),
  patientAge: z.string().optional(),
  patientGender: z.enum(GenderSchema.options),
  sampleId: NonEmptyStringSchema,
  sampleType: z.enum(SampleTypeSchema.options),
  samplingDate: NonEmptyStringSchema,
  receptionDate: NonEmptyStringSchema,
  testDate: NonEmptyStringSchema,
  RPS4Y1: NonEmptyStringSchema,
  PKHD1L1: NonEmptyStringSchema,
  CRABP1: NonEmptyStringSchema,
  GAPDH: NonEmptyStringSchema,
  testerName: NonEmptyStringSchema,
  otherInfo: z.string().optional(),
  instituteName: NonEmptyStringSchema,
  // evaluation_job（异步评估）可选扩展字段：仅 Web 单条 MVP 使用。
  evaluationAsync: z.boolean().optional(),
  evaluationJobUuid: z.string().uuid().optional()
});

export const BaseRecordResponseSchema = BaseRecordCreateRequestSchema.extend({
  id: z.number().int().optional(),
  uuid: z.string(),
  checkerName: z.string().optional(),
  reviewerName: z.string(),
  result: z.string(),
  isDeleted: z.number().int()
});

export const BaseRecordDeleteByUuidSchema = z.object({
  uuid: NonEmptyStringSchema
});
export const BaseRecordDeleteRequestSchema = z.array(BaseRecordDeleteByUuidSchema);

export const BaseRecordUpdateRequestSchema = BaseRecordCreateRequestSchema.extend({
  uuid: NonEmptyStringSchema,
  result: z.string(),
  reviewerName: NonEmptyStringSchema,
  isDeleted: z.number().int().optional()
});

// evaluation_job: 用于“评估执行/取消/进度轮询”的后端可追踪状态机
export const EvaluationJobStatusSchema = z.enum([
  "pending",
  "evaluating",
  "succeeded",
  "failed",
  "cancelled"
]);
export type EvaluationJobStatus = z.infer<typeof EvaluationJobStatusSchema>;

export const BaseEvaluationJobStatusRequestSchema = z.object({
  jobUuid: z.string().uuid(),
  instituteName: NonEmptyStringSchema
});

export const BaseEvaluationJobCancelRequestSchema = BaseEvaluationJobStatusRequestSchema;

export const BaseEvaluationJobItemStatusSchema = z.object({
  itemSeqNo: z.number().int().nonnegative(),
  itemStatus: EvaluationJobStatusSchema,
  recordUuid: z.string(),
  errorMessage: z.string()
});

export const BaseEvaluationJobStatusResponseSchema = z.object({
  jobUuid: z.string().uuid(),
  instituteName: NonEmptyStringSchema,
  status: EvaluationJobStatusSchema,
  progressPercent: z.number().int().min(0).max(100),
  recordUuid: z.string(),
  errorMessage: z.string(),
  items: z.array(BaseEvaluationJobItemStatusSchema)
});

// batch enqueue: 用一次请求创建 N 条 record + 同一个 evaluation_job 下 N 个 item
export const BatchEnqueueEvaluationJobRequestSchema = z.object({
  instituteName: NonEmptyStringSchema,
  records: z.array(BaseRecordCreateRequestSchema).min(1),
  evaluationJobStart: z.boolean().optional()
});

export const BatchEnqueueEvaluationJobResponseSchema = z.object({
  jobUuid: z.string().uuid()
});

// active jobs list：用于刷新/重新进入时恢复正在执行的 job
export const ActiveEvaluationJobsResponseSchema = z.object({
  jobs: z.array(BaseEvaluationJobStatusResponseSchema)
});

export type BaseRecordListRequest = z.infer<typeof BaseRecordListRequestSchema>;
export type BaseRecordCreateRequest = z.infer<typeof BaseRecordCreateRequestSchema>;
export type BaseRecordResponse = z.infer<typeof BaseRecordResponseSchema>;
export type BaseRecordDeleteByUuidRequest = z.infer<typeof BaseRecordDeleteByUuidSchema>;
export type BaseRecordDeleteRequest = z.infer<typeof BaseRecordDeleteRequestSchema>;
export type BaseRecordUpdateRequest = z.infer<typeof BaseRecordUpdateRequestSchema>;

export type BaseEvaluationJobStatusRequest = z.infer<typeof BaseEvaluationJobStatusRequestSchema>;
export type BaseEvaluationJobCancelRequest = z.infer<typeof BaseEvaluationJobCancelRequestSchema>;
export type BaseEvaluationJobItemStatus = z.infer<typeof BaseEvaluationJobItemStatusSchema>;
export type BaseEvaluationJobStatusResponse = z.infer<typeof BaseEvaluationJobStatusResponseSchema>;
export type BatchEnqueueEvaluationJobRequest = z.infer<typeof BatchEnqueueEvaluationJobRequestSchema>;
export type BatchEnqueueEvaluationJobResponse = z.infer<typeof BatchEnqueueEvaluationJobResponseSchema>;
export type ActiveEvaluationJobsResponse = z.infer<typeof ActiveEvaluationJobsResponseSchema>;
