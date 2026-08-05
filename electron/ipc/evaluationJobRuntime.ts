import { randomUUID } from "node:crypto";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type {
  ActiveEvaluationJobsResponse,
  BaseEvaluationJobStatusResponse,
  BaseRecordCreateRequest,
  BatchEnqueueEvaluationJobRequest,
  BatchEnqueueEvaluationJobResponse,
  EvaluationJobStatus
} from "@villanelle/ret-shared/contracts/base";
import type { BrowserWindow } from "electron";
import type { WorkerManager } from "../services/workerManager";
import type { LocalUploadStore } from "../services/localUploadStore";
import type { SampleRecord, SampleRecordRequestPayload, SampleRecordResponsePayload } from "../types";
import type { AuthSessionPrincipal } from "./authSession";
import type {
  EvaluationJobItemRow,
  EvaluationJobRow
} from "../database";

const stripEvaluationMeta = (
  draft: SampleRecordRequestPayload
): Omit<BaseRecordCreateRequest, "evaluationAsync" | "evaluationJobUuid"> => {
  const { evaluationAsync: _a, evaluationJobUuid: _j, ...rest } = draft as any;
  return rest;
};

const buildPlaceholder = (
  draft: SampleRecordRequestPayload,
  jobUuid: string
): SampleRecordResponsePayload => ({
  ...(stripEvaluationMeta(draft) as any),
  id: undefined,
  uuid: jobUuid,
  result: "",
  isDeleted: 0,
  reviewerName: ""
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type EvaluationJobRuntimeDeps = {
  authSession: {
    requireAuthenticated(): void;
    getPrincipal(): AuthSessionPrincipal | null;
  };
  workerManager: WorkerManager;
  localUploadStore: LocalUploadStore;
  workerCommand: string;
  workerArgs: string[];
  tileWorkerCommand: string;
  tileWorkerArgs: string[];
  mainWindow: BrowserWindow;
  emitShellOutput: (payload: unknown) => void;
  createSampleRecords: (record: Omit<SampleRecord, "uuid">) => Promise<SampleRecord>;
  deleteSampleRecordsByUuids: (uuids: string[]) => Promise<boolean>;
  createEvaluationJob: (params: {
    jobUuid: string;
    instituteName: string;
    createdByUsername: string;
    status: EvaluationJobStatus;
  }) => Promise<EvaluationJobRow | undefined>;
  createEvaluationJobItems: (params: {
    jobUuid: string;
    totalCount: number;
  }) => Promise<EvaluationJobItemRow[]>;
  getEvaluationJobByUuid: (jobUuid: string) => Promise<EvaluationJobRow | undefined>;
  listEvaluationJobItems: (jobUuid: string) => Promise<EvaluationJobItemRow[]>;
  findActiveEvaluationJob: (params: {
    instituteName: string;
    createdByUsername: string;
  }) => Promise<EvaluationJobRow | undefined>;
  updateEvaluationJob: (params: {
    jobUuid: string;
    status?: EvaluationJobStatus;
    cancelRequested?: number;
    progressPercent?: number;
    recordUuid?: string;
    errorMessage?: string;
  }) => Promise<EvaluationJobRow | undefined>;
  updateEvaluationJobItem: (params: {
    jobUuid: string;
    itemSeqNo: number;
    itemStatus?: EvaluationJobStatus;
    recordUuid?: string;
    errorMessage?: string;
  }) => Promise<void>;
  listPendingOrEvaluatingItems: (jobUuid: string) => Promise<EvaluationJobItemRow[]>;
  cancelPendingOrEvaluatingItems: (jobUuid: string) => Promise<void>;
};

export const createEvaluationJobRuntime = (deps: EvaluationJobRuntimeDeps) => {
  const requirePrincipalMatchingInstitute = (instituteName: string) => {
    deps.authSession.requireAuthenticated();
    const principal = deps.authSession.getPrincipal();
    if (!principal) {
      throw new Error(SharedClientErrorMessage.forbidden);
    }
    if (principal.instituteName !== instituteName) {
      throw new Error(SharedClientErrorMessage.forbidden);
    }
    return principal;
  };

  const toResponse = async (
    jobRow: EvaluationJobRow
  ): Promise<BaseEvaluationJobStatusResponse> => {
    const items = await deps.listEvaluationJobItems(jobRow.jobUuid);
    return {
      jobUuid: jobRow.jobUuid,
      instituteName: jobRow.instituteName,
      status: jobRow.status,
      progressPercent: Number(jobRow.progressPercent ?? 0),
      recordUuid: jobRow.recordUuid ?? "",
      errorMessage: jobRow.errorMessage ?? "",
      items: items.map((it) => ({
        itemSeqNo: Number(it.itemSeqNo),
        itemStatus: it.itemStatus,
        recordUuid: it.recordUuid ?? "",
        errorMessage: it.errorMessage ?? ""
      }))
    };
  };

  const evaluateDraft = async (
    parsedRecord: Omit<BaseRecordCreateRequest, "evaluationAsync" | "evaluationJobUuid">,
    onProgress?: (pct: number) => void,
  ) => {
    const principal = requirePrincipalMatchingInstitute(
      parsedRecord.instituteName,
    );
    const slidePath = await deps.localUploadStore.slidePath(
      principal.username,
      parsedRecord.uploadId,
      parsedRecord.slideFileName,
    );
    await deps.workerManager.start(
      deps.workerCommand,
      deps.workerArgs,
      undefined,
      deps.tileWorkerCommand,
      deps.tileWorkerArgs,
    );
    return deps.workerManager.request(
      {
        slidePath,
        modelType: parsedRecord.modelType,
        generateHeatmap: parsedRecord.generateHeatmap,
        uploadId: parsedRecord.uploadId,
      },
      ({ pct }) => onProgress?.(Math.max(0, Math.min(99, Math.round(pct)))),
    );
  };

  const cancelAndMarkRemaining = async (jobUuid: string) => {
    const pendingItems = await deps.listPendingOrEvaluatingItems(jobUuid);
    const recordUuids = pendingItems
      .map((it) => String(it.recordUuid ?? ""))
      .filter((uuid) => uuid.length > 0);
    if (recordUuids.length > 0) {
      await deps.deleteSampleRecordsByUuids(recordUuids);
    }
    await deps.cancelPendingOrEvaluatingItems(jobUuid);
    await deps.updateEvaluationJob({
      jobUuid,
      status: "cancelled",
      progressPercent: 100,
      errorMessage: ""
    });
  };

  const runSingleJob = async (
    jobUuid: string,
    recordDraft: Omit<BaseRecordCreateRequest, "evaluationAsync" | "evaluationJobUuid">
  ) => {
    try {
      await deps.updateEvaluationJob({
        jobUuid,
        status: "evaluating",
        progressPercent: 1,
        errorMessage: ""
      });
      await deps.updateEvaluationJobItem({
        jobUuid,
        itemSeqNo: 0,
        itemStatus: "evaluating",
        recordUuid: "",
        errorMessage: ""
      });

      const jobNow = await deps.getEvaluationJobByUuid(jobUuid);
      if (!jobNow) return;
      if (Number(jobNow.cancelRequested ?? 0) === 1) {
        await cancelAndMarkRemaining(jobUuid);
        return;
      }

      await sleep(2000);
      const jobBeforeEval = await deps.getEvaluationJobByUuid(jobUuid);
      if (!jobBeforeEval) return;
      if (Number(jobBeforeEval.cancelRequested ?? 0) === 1) {
        await cancelAndMarkRemaining(jobUuid);
        return;
      }

      const probabilityStr = await evaluateDraft(recordDraft, (pct) => {
        void deps.updateEvaluationJob({ jobUuid, progressPercent: pct });
      });

      const jobAfterEval = await deps.getEvaluationJobByUuid(jobUuid);
      if (!jobAfterEval) return;
      if (Number(jobAfterEval.cancelRequested ?? 0) === 1) {
        await cancelAndMarkRemaining(jobUuid);
        return;
      }

      const inserted = await deps.createSampleRecords({
        ...(recordDraft as any),
        result: probabilityStr,
        isDeleted: 0,
        reviewerName: ""
      });

      await deps.updateEvaluationJobItem({
        jobUuid,
        itemSeqNo: 0,
        itemStatus: "succeeded",
        recordUuid: inserted.uuid,
        errorMessage: ""
      });
      await deps.updateEvaluationJob({
        jobUuid,
        status: "succeeded",
        progressPercent: 100,
        recordUuid: inserted.uuid,
        errorMessage: ""
      });
      deps.mainWindow.webContents.send("evaluationResponse", inserted);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await deps.updateEvaluationJobItem({
        jobUuid,
        itemSeqNo: 0,
        itemStatus: "failed",
        recordUuid: "",
        errorMessage: reason
      });
      await deps.updateEvaluationJob({
        jobUuid,
        status: "failed",
        progressPercent: 100,
        recordUuid: "",
        errorMessage: reason
      });
    }
  };

  const runBatchJob = async (
    jobUuid: string,
    recordDrafts: Array<Omit<BaseRecordCreateRequest, "evaluationAsync" | "evaluationJobUuid">>
  ) => {
    try {
      await deps.updateEvaluationJob({
        jobUuid,
        status: "evaluating",
        progressPercent: 0,
        errorMessage: ""
      });

      let failedCount = 0;
      const total = recordDrafts.length;

      for (let i = 0; i < total; i++) {
        const jobNow = await deps.getEvaluationJobByUuid(jobUuid);
        if (!jobNow) return;
        if (Number(jobNow.cancelRequested ?? 0) === 1) {
          await cancelAndMarkRemaining(jobUuid);
          return;
        }

        if (i > 0) {
          await sleep(1000);
          const jobAfterGap = await deps.getEvaluationJobByUuid(jobUuid);
          if (!jobAfterGap) return;
          if (Number(jobAfterGap.cancelRequested ?? 0) === 1) {
            await cancelAndMarkRemaining(jobUuid);
            return;
          }
        }

        await deps.updateEvaluationJobItem({
          jobUuid,
          itemSeqNo: i,
          itemStatus: "evaluating",
          recordUuid: "",
          errorMessage: ""
        });

        try {
          const probabilityStr = await evaluateDraft(recordDrafts[i]!, (pct) => {
            const overall = Math.min(
              99,
              Math.round(((i + pct / 100) / total) * 100),
            );
            void deps.updateEvaluationJob({
              jobUuid,
              progressPercent: overall,
            });
          });
          const jobAfterEval = await deps.getEvaluationJobByUuid(jobUuid);
          if (!jobAfterEval) return;
          if (Number(jobAfterEval.cancelRequested ?? 0) === 1) {
            await cancelAndMarkRemaining(jobUuid);
            return;
          }

          const inserted = await deps.createSampleRecords({
            ...(recordDrafts[i]! as any),
            result: probabilityStr,
            isDeleted: 0,
            reviewerName: ""
          });
          await deps.updateEvaluationJobItem({
            jobUuid,
            itemSeqNo: i,
            itemStatus: "succeeded",
            recordUuid: inserted.uuid,
            errorMessage: ""
          });
          deps.mainWindow.webContents.send("evaluationResponse", inserted);
        } catch (error) {
          failedCount++;
          const reason = error instanceof Error ? error.message : String(error);
          await deps.updateEvaluationJobItem({
            jobUuid,
            itemSeqNo: i,
            itemStatus: "failed",
            recordUuid: "",
            errorMessage: reason
          });
        }

        const progress = Math.round(((i + 1) / total) * 100);
        await deps.updateEvaluationJob({
          jobUuid,
          progressPercent: progress
        });
      }

      await deps.updateEvaluationJob({
        jobUuid,
        status: failedCount > 0 ? "failed" : "succeeded",
        progressPercent: 100,
        errorMessage: failedCount > 0 ? "one or more items failed" : ""
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await deps.updateEvaluationJob({
        jobUuid,
        status: "failed",
        progressPercent: 100,
        errorMessage: reason
      });
    }
  };

  return {
    async startSingleAsync(
      parsedRecord: SampleRecordRequestPayload
    ): Promise<SampleRecordResponsePayload> {
      const principal = requirePrincipalMatchingInstitute(parsedRecord.instituteName);
      const active = await deps.findActiveEvaluationJob({
        instituteName: principal.instituteName,
        createdByUsername: principal.username
      });
      if (active) {
        throw new Error(SharedClientErrorMessage.conflict);
      }

      const jobUuid = randomUUID();
      const recordDraft = stripEvaluationMeta(parsedRecord);
      await deps.createEvaluationJob({
        jobUuid,
        instituteName: recordDraft.instituteName,
        createdByUsername: principal.username,
        status: "pending"
      });
      await deps.createEvaluationJobItems({ jobUuid, totalCount: 1 });
      setImmediate(() => {
        void runSingleJob(jobUuid, recordDraft);
      });
      return buildPlaceholder(parsedRecord, jobUuid);
    },

    async enqueueBatch(
      body: BatchEnqueueEvaluationJobRequest
    ): Promise<BatchEnqueueEvaluationJobResponse> {
      const principal = requirePrincipalMatchingInstitute(body.instituteName);
      const active = await deps.findActiveEvaluationJob({
        instituteName: principal.instituteName,
        createdByUsername: principal.username
      });
      if (active) {
        throw new Error(SharedClientErrorMessage.conflict);
      }

      const jobUuid = randomUUID();
      const drafts = body.records.map((it) => stripEvaluationMeta(it as any));
      await deps.createEvaluationJob({
        jobUuid,
        instituteName: body.instituteName,
        createdByUsername: principal.username,
        status: "pending"
      });
      await deps.createEvaluationJobItems({ jobUuid, totalCount: drafts.length });

      const shouldStart = body.evaluationJobStart !== false;
      if (shouldStart) {
        setImmediate(() => {
          void runBatchJob(jobUuid, drafts);
        });
      }
      return { jobUuid };
    },

    async getStatus(
      params: { jobUuid: string; instituteName: string }
    ): Promise<BaseEvaluationJobStatusResponse> {
      const principal = requirePrincipalMatchingInstitute(params.instituteName);
      const job = await deps.getEvaluationJobByUuid(params.jobUuid);
      if (!job || job.instituteName !== params.instituteName) {
        throw new Error(SharedClientErrorMessage.notFound);
      }
      if (job.createdByUsername !== principal.username) {
        throw new Error(SharedClientErrorMessage.forbidden);
      }
      return toResponse(job);
    },

    async getActive(
      params: { instituteName: string }
    ): Promise<ActiveEvaluationJobsResponse> {
      const principal = requirePrincipalMatchingInstitute(params.instituteName);
      const active = await deps.findActiveEvaluationJob({
        instituteName: principal.instituteName,
        createdByUsername: principal.username
      });
      if (!active) {
        return { jobs: [] };
      }
      return { jobs: [await toResponse(active)] };
    },

    async cancelJob(params: { jobUuid: string }): Promise<BaseEvaluationJobStatusResponse> {
      deps.authSession.requireAuthenticated();
      const principal = deps.authSession.getPrincipal();
      if (!principal) {
        throw new Error(SharedClientErrorMessage.forbidden);
      }
      const job = await deps.getEvaluationJobByUuid(params.jobUuid);
      if (!job) {
        throw new Error(SharedClientErrorMessage.notFound);
      }
      if (job.createdByUsername !== principal.username) {
        throw new Error(SharedClientErrorMessage.forbidden);
      }

      await deps.updateEvaluationJob({
        jobUuid: params.jobUuid,
        cancelRequested: 1,
        status: "cancelled",
        progressPercent: 100,
        errorMessage: ""
      });
      await cancelAndMarkRemaining(params.jobUuid);
      const updated = await deps.getEvaluationJobByUuid(params.jobUuid);
      if (!updated) {
        throw new Error(SharedClientErrorMessage.notFound);
      }
      return toResponse(updated);
    }
  };
};
