import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Req,
  Param,
  Post,
  Patch,
  Query,
  ServiceUnavailableException
} from "@nestjs/common";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import {
  type ServerRecordCreateRequest,
  type ServerRecordDeleteRequest,
  type ServerRecordListRequest,
  type ServerRecordUpdateRequest,
  ServerRecordCreateRequestSchema,
  ServerRecordDeleteRequestSchema,
  ServerRecordListRequestSchema
  ,ServerRecordUpdateRequestSchema
  ,ServerEvaluationJobCancelRequestSchema,
  ServerEvaluationJobStatusRequestSchema,
  ServerBatchEnqueueEvaluationJobRequestSchema,
  type ServerBatchEnqueueEvaluationJobRequest
} from "../../contracts/request.schemas";
import {
  ServerDeleteSuccessEnvelopeSchema,
  type ServerRecord,
  ServerRecordSchema,
  ServerRecordQuerySchema,
  ServerEvaluationJobStatusResponseSchema,
  ServerBatchEnqueueEvaluationJobResponseSchema,
  ServerActiveEvaluationJobsResponseSchema
} from "../../contracts/response.schemas";

import { ok } from "../../common/envelope/response";
import { ZodValidationPipe } from "../../common/http/pipes/zod-validation.pipe";

import { RecordService } from "./record.service";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");
const toRecordResponse = <T extends { id?: number; checkerName?: string }>(record: T): ServerRecord | null => {
  const { id: _id, checkerName: _checkerName, ...rest } = record;
  const parsed = ServerRecordSchema.safeParse(rest);
  return parsed.success ? parsed.data : null;
};

type RecordListBody = ServerRecordListRequest;
type RecordCreateBody = ServerRecordCreateRequest;
type RecordDeleteBody = ServerRecordDeleteRequest;
type RecordUpdateBody = ServerRecordUpdateRequest;
type BatchEnqueueBody = ServerBatchEnqueueEvaluationJobRequest;

const ActiveJobsQuerySchema = z.object({
  instituteName: z.string().trim().min(1)
});

const CancelEvaluationJobPatchBodySchema = z.object({
  cancelRequested: z.boolean()
});

@Controller("/api/record")
export class RecordController {
  constructor(@Inject(RecordService) private readonly recordService: RecordService) {}

  @Post("/list")
  @HttpCode(200)
  async recordList(@Body(new ZodValidationPipe(ServerRecordListRequestSchema)) body: RecordListBody) {
    const listed = await this.recordService.listRecords({
      instituteName: body.instituteName,
      page: body.page ?? 1,
      pageSize: body.pageSize ?? 10,
      deletedOnly: Boolean(body.deletedOnly),
      searchKeyword: body.searchKeyword
    });
    const result = listed.result
      .map((item) => toRecordResponse(item))
      .filter((item): item is ServerRecord => item !== null);
    return ok(
      {
        total: listed.total,
        result
      },
      "",
      ServerRecordQuerySchema
    );
  }

  @Post("/create")
  @HttpCode(200)
  async recordCreate(
    @Req() req: any,
    @Body(new ZodValidationPipe(ServerRecordCreateRequestSchema)) input: RecordCreateBody
  ) {
    let record;
    try {
      const recordDraft = {
        hospitalName: input.hospitalName,
        doctorName: asString(input.doctorName),
        patientName: asString(input.patientName),
        patientAge: asString(input.patientAge),
        patientGender: asString(input.patientGender),
        sampleId: input.sampleId,
        sampleType: input.sampleType,
        samplingDate: input.samplingDate,
        receptionDate: input.receptionDate,
        testDate: input.testDate,
        RPS4Y1: input.RPS4Y1,
        PKHD1L1: input.PKHD1L1,
        CRABP1: input.CRABP1,
        GAPDH: input.GAPDH,
        testerName: input.testerName,
        otherInfo: asString(input.otherInfo),
        instituteName: input.instituteName
      };

      if (input.evaluationAsync) {
        // Async mode: enqueue job first; persist record only after evaluation succeeds.
        const jobUuid = input.evaluationJobUuid ?? randomUUID();
        const createdByUsername: string = req?.authUser?.username;
        if (!createdByUsername) {
          throw new ConflictException("missing auth user");
        }
        await this.recordService.createAndRunSingleEvaluationJob({
          jobUuid,
          instituteName: input.instituteName,
          createdByUsername,
          recordDraft
        });

        // Return an accepted placeholder payload for client compatibility.
        record = {
          id: undefined,
          uuid: jobUuid,
          checkerName: "",
          hospitalName: recordDraft.hospitalName,
          doctorName: recordDraft.doctorName,
          patientName: recordDraft.patientName,
          patientAge: recordDraft.patientAge,
          patientGender: recordDraft.patientGender,
          sampleId: recordDraft.sampleId,
          sampleType: recordDraft.sampleType,
          samplingDate: recordDraft.samplingDate,
          receptionDate: recordDraft.receptionDate,
          testDate: recordDraft.testDate,
          RPS4Y1: recordDraft.RPS4Y1,
          PKHD1L1: recordDraft.PKHD1L1,
          CRABP1: recordDraft.CRABP1,
          GAPDH: recordDraft.GAPDH,
          testerName: recordDraft.testerName,
          reviewerName: "",
          otherInfo: recordDraft.otherInfo,
          result: "",
          instituteName: recordDraft.instituteName,
          isDeleted: 0
        };
      } else {
        record = await this.recordService.createRecord(recordDraft);
      }
    } catch (error) {
      if (error instanceof Error && error.message === SharedClientErrorMessage.workerNotReady) {
        throw new ServiceUnavailableException(SharedClientErrorMessage.workerNotReady);
      }
      throw error;
    }
    const response = toRecordResponse(record);
    if (!response) {
      throw new InternalServerErrorException(SharedClientErrorMessage.invalidRecordShape);
    }
    return ok(response, "", ServerRecordSchema);
  }

  /**
   * Batch enqueue（批量入队）：
   * - 创建 N 条 record（result=""）
   * - 插入一个 evaluation_job + N 个 evaluation_job_item
   * - 若已有 active job，则返回 409 Conflict（需客户端先显式 PATCH cancel 并等待进入 cancelled）
   */
  @Post("/evaluation-jobs")
  @HttpCode(200)
  async batchEnqueueEvaluationJobs(
    @Req() req: any,
    @Body(new ZodValidationPipe(ServerBatchEnqueueEvaluationJobRequestSchema)) input: BatchEnqueueBody
  ) {
    const createdByUsername: string = req?.authUser?.username;
    if (!createdByUsername) {
      throw new ConflictException(SharedClientErrorMessage.missingAccessToken);
    }

    const instituteName = input.instituteName;

    const activeJobUuid = await this.recordService.findActiveEvaluationJobUuid({
      createdByUsername,
      instituteName
    });
    if (activeJobUuid) {
      throw new ConflictException("active evaluation job already exists, cancel it first");
    }

    const recordDrafts = input.records.map((r) => ({
      hospitalName: r.hospitalName,
      doctorName: asString(r.doctorName),
      patientName: asString(r.patientName),
      patientAge: asString(r.patientAge),
      patientGender: r.patientGender,
      sampleId: r.sampleId,
      sampleType: r.sampleType,
      samplingDate: r.samplingDate,
      receptionDate: r.receptionDate,
      testDate: r.testDate,
      RPS4Y1: r.RPS4Y1,
      PKHD1L1: r.PKHD1L1,
      CRABP1: r.CRABP1,
      GAPDH: r.GAPDH,
      testerName: r.testerName,
      otherInfo: asString(r.otherInfo),
      instituteName
    }));

    const jobUuid = await this.recordService.createAndRunBatchEvaluationJob({
      instituteName,
      createdByUsername,
      recordDrafts,
      evaluationJobStart: input.evaluationJobStart
    });

    return ok({ jobUuid }, "", ServerBatchEnqueueEvaluationJobResponseSchema);
  }

  @Get("/evaluation-jobs/active")
  @HttpCode(200)
  async activeEvaluationJobs(
    @Req() req: any,
    @Query("instituteName") instituteNameRaw: unknown
  ) {
    const parsed = ActiveJobsQuerySchema.safeParse({ instituteName: instituteNameRaw });
    if (!parsed.success) {
      throw new ConflictException(parsed.error.issues[0]?.message ?? "invalid payload");
    }

    const createdByUsername: string = req?.authUser?.username;
    if (!createdByUsername) {
      throw new ConflictException(SharedClientErrorMessage.missingAccessToken);
    }

    const result = await this.recordService.getActiveEvaluationJobs({
      createdByUsername,
      instituteName: parsed.data.instituteName
    });

    return ok(result, "", ServerActiveEvaluationJobsResponseSchema);
  }

  /**
   * Evaluation job polling（单条 MVP）：
   * - 前端使用轮询调用本接口拿进度与最终态
   */
  @Get("/evaluation-jobs/:jobUuid")
  @HttpCode(200)
  async evaluationJobStatus(
    @Param("jobUuid") jobUuid: string,
    @Query("instituteName") instituteName: string
  ) {
    const parsed = ServerEvaluationJobStatusRequestSchema.safeParse({
      jobUuid,
      instituteName
    });
    if (!parsed.success) {
      throw new ConflictException(parsed.error.issues[0]?.message ?? "invalid payload");
    }
    const jobStatus = await this.recordService.getEvaluationJobStatus(parsed.data);
    if (!jobStatus) {
      throw new ConflictException("evaluation job not found");
    }
    return ok(jobStatus, "", ServerEvaluationJobStatusResponseSchema);
  }

  /**
   * Cancel evaluation job（MVP）：
   * - 仅设置 cancel_requested=1
   * - runner 在评估结束前后检查，尽量不再写入结果并把最终态标为 cancelled
   */
  @Post("/evaluation-jobs/:jobUuid")
  @HttpCode(200)
  async evaluationJobCancel(
    @Req() req: any,
    @Param("jobUuid") jobUuid: string,
    @Body(new ZodValidationPipe(ServerEvaluationJobCancelRequestSchema)) input: any
  ) {
    const parsed = ServerEvaluationJobCancelRequestSchema.safeParse({
      ...input,
      jobUuid
    });
    if (!parsed.success) {
      throw new ConflictException(parsed.error.issues[0]?.message ?? "invalid payload");
    }

    const createdByUsername: string = req?.authUser?.username;
    if (!createdByUsername) {
      throw new ConflictException("missing auth user");
    }

    await this.recordService.cancelEvaluationJob({
      jobUuid: parsed.data.jobUuid,
      createdByUsername
    });
    const jobStatus = await this.recordService.getEvaluationJobStatus(parsed.data);
    if (!jobStatus) {
      throw new ConflictException("evaluation job not found");
    }
    return ok(jobStatus, "", ServerEvaluationJobStatusResponseSchema);
  }

  /**
   * Cancel evaluation job（v3 RESTful）：
   * - PATCH：body: { cancelRequested: true }
   * - 支持 Footer cancel-only 直接取消当前 active job
   */
  @Patch("/evaluation-jobs/:jobUuid")
  @HttpCode(200)
  async evaluationJobCancelPatch(
    @Req() req: any,
    @Param("jobUuid") jobUuid: string,
    @Body(new ZodValidationPipe(CancelEvaluationJobPatchBodySchema)) body: { cancelRequested: boolean }
  ) {
    if (!body.cancelRequested) {
      return ok(
        await this.recordService.getEvaluationJobStatus({
          jobUuid,
          instituteName: req?.authUser?.instituteName
        }),
        "",
        ServerEvaluationJobStatusResponseSchema
      );
    }

    const createdByUsername: string = req?.authUser?.username;
    const instituteName: string = req?.authUser?.instituteName;
    if (!createdByUsername || !instituteName) {
      throw new ConflictException("missing auth context");
    }

    await this.recordService.cancelEvaluationJob({ jobUuid, createdByUsername });

    const jobStatus = await this.recordService.getEvaluationJobStatus({ jobUuid, instituteName });
    if (!jobStatus) {
      throw new ConflictException("evaluation job not found");
    }
    return ok(jobStatus, "", ServerEvaluationJobStatusResponseSchema);
  }

  @Post("/delete")
  @HttpCode(200)
  async recordDelete(@Body(new ZodValidationPipe(ServerRecordDeleteRequestSchema)) body: RecordDeleteBody) {
    const uuids = body.map((item) => item.uuid);
    const deleted = await this.recordService.deleteRecords(uuids);
    if (!deleted) {
      throw new ConflictException(SharedClientErrorMessage.deleteFailed);
    }
    return ok(true, "", ServerDeleteSuccessEnvelopeSchema.shape.payload.element);
  }

  @Post("/update")
  @HttpCode(200)
  async recordUpdate(@Body(new ZodValidationPipe(ServerRecordUpdateRequestSchema)) body: RecordUpdateBody) {
    const updated = await this.recordService.updateRecord({
      uuid: body.uuid,
      hospitalName: body.hospitalName,
      doctorName: asString(body.doctorName),
      patientName: asString(body.patientName),
      patientAge: asString(body.patientAge),
      patientGender: body.patientGender,
      sampleId: body.sampleId,
      sampleType: body.sampleType,
      samplingDate: body.samplingDate,
      receptionDate: body.receptionDate,
      testDate: body.testDate,
      RPS4Y1: body.RPS4Y1,
      PKHD1L1: body.PKHD1L1,
      CRABP1: body.CRABP1,
      GAPDH: body.GAPDH,
      testerName: body.testerName,
      reviewerName: body.reviewerName,
      otherInfo: asString(body.otherInfo),
      result: body.result,
      instituteName: body.instituteName,
      isDeleted: body.isDeleted
    });
    if (!updated) {
      throw new ConflictException(SharedClientErrorMessage.requestFailed);
    }
    return ok(true, "", ServerDeleteSuccessEnvelopeSchema.shape.payload.element);
  }
}

