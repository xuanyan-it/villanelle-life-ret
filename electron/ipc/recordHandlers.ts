import { computeDetForWorker, mapGenderForWorker, mapSampleTypeForWorker } from "@villanelle/ret-shared/application";
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
    workerCommand,
    workerArgs,
    mainWindow,
  } = context;
  const { registerEnvelope, registerRaw } = createIpcHandlerFactory(context);
  const evaluationJobRuntime = createEvaluationJobRuntime({
    authSession: context.authSession,
    workerManager,
    workerCommand,
    workerArgs,
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
      schema: ElectronCreateSampleRecordsRequestSchema,
      requireAuth: true
    },
    async (parsedRecord: SampleRecordRequestPayload): Promise<SampleRecordResponsePayload> => {
      if (parsedRecord.evaluationAsync) {
        return evaluationJobRuntime.startSingleAsync(parsedRecord);
      }
      const { RPS4Y1, PKHD1L1, CRABP1, GAPDH, patientGender, sampleType } =
        parsedRecord;
      const DETs = computeDetForWorker(PKHD1L1, RPS4Y1, CRABP1, GAPDH);
      const genderValue = mapGenderForWorker(patientGender);

      let result = "";
      try {
        await workerManager.start(workerCommand, workerArgs);
        const workerSampleType = mapSampleTypeForWorker(sampleType, parsedRecord.sampleId);
        const probability = await workerManager.request({
          DET_PKHD1L1: DETs.DET_PKHD1L1,
          DET_RPS4Y1: DETs.DET_RPS4Y1,
          DET_CRABP1: DETs.DET_CRABP1,
          Gender: genderValue,
          sampleType: workerSampleType,
        });
        result = Number.isFinite(probability) ? `${probability}` : "";
        emitShellOutput(
          `[evaluation] source=worker sampleType=${workerSampleType} result=${result}`,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const msg = `[evaluation] blocked: worker not ready (${reason})`;
        console.warn(msg);
        emitShellOutput(msg);
        throw new Error(SharedClientErrorMessage.workerNotReady);
      }

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
      schema: ElectronBatchEnqueueEvaluationJobRequestSchema,
      requireAuth: true
    },
    async (payload) => evaluationJobRuntime.enqueueBatch(payload)
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
      schema: ElectronUpdateSampleRecordsRequestSchema,
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
