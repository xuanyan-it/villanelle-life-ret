import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import {
  ElectronActiveEvaluationJobsRequestSchema,
  ElectronBatchEnqueueEvaluationJobRequestSchema,
  ElectronEvaluationJobCancelRequestSchema,
  ElectronEvaluationJobStatusRequestSchema,
  ElectronCreateSampleRecordsRequestSchema,
  ElectronDeleteSampleRecordsRequestSchema,
  ElectronFetchSampleRecordsRequestSchema,
  ElectronUpdateSampleRecordsRequestSchema
} from "../contracts/request.schemas";

import {
  cancelPendingOrEvaluatingItems,
  createEvaluationJob,
  createEvaluationJobItems,
  createSampleRecords,
  deleteSampleRecordsByUuids,
  deleteSampleRecords,
  findActiveEvaluationJob,
  fetchSampleRecords,
  getEvaluationJobByUuid,
  listEvaluationJobItems,
  listPendingOrEvaluatingItems,
  updateEvaluationJob,
  updateEvaluationJobItem,
  updateSampleRecords,
} from "../database";
import type {
  BaseResponse,
  QueryResponseData,
  SampleRecord} from "../types";
import {
  type SampleRecordRequestPayload,
  type SampleRecordResponsePayload,
} from "../types";

import type { IpcContext } from "./context";
import { createIpcHandlerFactory } from "./handlerFactory";
import { createEvaluationJobRuntime } from "./evaluationJobRuntime";

export const registerRecordHandlers = (context: IpcContext) => {
  const {
    emitShellOutput,
    workerManager,
    localUploadStore,
    workerCommand,
    workerArgs,
    tileWorkerCommand,
    tileWorkerArgs,
    mainWindow,
  } = context;
  const { registerEnvelope, registerRaw } = createIpcHandlerFactory(context);
  const evaluationJobRuntime = createEvaluationJobRuntime({
    authSession: context.authSession,
    workerManager,
    localUploadStore,
    workerCommand,
    workerArgs,
    tileWorkerCommand,
    tileWorkerArgs,
    mainWindow,
    emitShellOutput,
    createSampleRecords,
    deleteSampleRecordsByUuids,
    createEvaluationJob,
    createEvaluationJobItems,
    getEvaluationJobByUuid,
    listEvaluationJobItems,
    findActiveEvaluationJob,
    updateEvaluationJob,
    updateEvaluationJobItem,
    listPendingOrEvaluatingItems,
    cancelPendingOrEvaluatingItems
  });

  registerEnvelope(
    "fetchSampleRecords",
    {
      schema: ElectronFetchSampleRecordsRequestSchema,
      requireAuth: true,
      fallbackMessage: SharedClientErrorMessage.fetchSampleRecordsFailed
    },
    async (params): Promise<QueryResponseData<SampleRecord>[]> => {
      const { total, rows } = await fetchSampleRecords(params);
      emitShellOutput(rows);
      return [
        {
          total,
          result: rows,
        },
      ];
    }
  );

  registerRaw(
    "createSampleRecords",
    {
      schema: ElectronCreateSampleRecordsRequestSchema as any,
      requireAuth: true
    },
    async (parsedRecord: SampleRecordRequestPayload): Promise<SampleRecordResponsePayload> => {
      if (parsedRecord.evaluationAsync) {
        return evaluationJobRuntime.startSingleAsync(parsedRecord);
      }
      // TODO: Electron sync evaluation — currently returns placeholder
      const result = "0";

      const recordWithResult: Omit<SampleRecord, "uuid"> = {
        ...parsedRecord,
        result,
        isDeleted: 0,
        reviewerName: "",
      };
      const inserted = await createSampleRecords(recordWithResult);
      mainWindow.webContents.send("evaluationResponse", inserted);
      return inserted;
    }
  );

  registerRaw(
    "batchEnqueueEvaluationJobs",
    {
      schema: ElectronBatchEnqueueEvaluationJobRequestSchema as any,
      requireAuth: true
    },
    async (payload: any) => evaluationJobRuntime.enqueueBatch(payload)
  );

  registerRaw(
    "evaluationJobStatus",
    {
      schema: ElectronEvaluationJobStatusRequestSchema,
      requireAuth: true
    },
    async ({ jobUuid, instituteName }) =>
      evaluationJobRuntime.getStatus({ jobUuid, instituteName })
  );

  registerRaw(
    "activeEvaluationJobs",
    {
      schema: ElectronActiveEvaluationJobsRequestSchema,
      requireAuth: true
    },
    async ({ instituteName }) => evaluationJobRuntime.getActive({ instituteName })
  );

  registerRaw(
    "cancelEvaluationJob",
    {
      schema: ElectronEvaluationJobCancelRequestSchema,
      requireAuth: true
    },
    async ({ jobUuid }) => evaluationJobRuntime.cancelJob({ jobUuid })
  );

  registerRaw(
    "updateSampleRecords",
    {
      schema: ElectronUpdateSampleRecordsRequestSchema as any,
      requireAuth: true
    },
    async (record: SampleRecord) => updateSampleRecords(record)
  );

  registerEnvelope(
    "deleteSampleRecords",
    {
      schema: ElectronDeleteSampleRecordsRequestSchema,
      requireAuth: true,
      fallbackMessage: SharedClientErrorMessage.deleteFailed
    },
    async (records): Promise<QueryResponseData<{ uuid: string }>[] > => {
      await Promise.all(records.map((record) => deleteSampleRecords(record as any)));
      return [
        {
          total: records.length,
          result: records,
        },
      ];
    }
  );
};
