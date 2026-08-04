import type { ElectronCall } from "../types";
import type { ApiType } from "./types";
const call: ElectronCall = (route, payload) =>
  window.electronAPI.call(route, payload);
type ApiReturn<K extends keyof ApiType> = Awaited<ReturnType<ApiType[K]>>;
type ApiParams<K extends keyof ApiType> = Parameters<ApiType[K]>[0];
export const electronApi: ApiType = {
  health: async () => ({ ok: true }),
  userList: (params) =>
    call<ApiReturn<"userList">, ApiParams<"userList">>(
      "userList",
      params
    ),
  userLogin: (payload) =>
    call<ApiReturn<"userLogin">, ApiParams<"userLogin">>(
      "userLogin",
      payload
    ),
  userLogout: () => call<ApiReturn<"userLogout">>("userLogout"),
  userCreate: (payload) =>
    call<ApiReturn<"userCreate">, ApiParams<"userCreate">>(
      "userCreate",
      payload
    ),
  instituteList: (params) =>
    call<ApiReturn<"instituteList">, ApiParams<"instituteList">>(
      "instituteList",
      params
    ),
  instituteCreate: (payload) =>
    call<ApiReturn<"instituteCreate">, ApiParams<"instituteCreate">>(
      "instituteCreate",
      payload
    ),
  instituteRegister: (payload) =>
    call<ApiReturn<"instituteRegister">, ApiParams<"instituteRegister">>(
      "instituteRegister",
      payload
    ),
  verifyToken: (token) =>
    call<ApiReturn<"verifyToken">, { token: ApiParams<"verifyToken"> }>(
      "verifyInstituteToken",
      { token }
    ),
  userDelete: (records) =>
    call<ApiReturn<"userDelete">, ApiParams<"userDelete">>(
      "userDelete",
      records
    ),
  isBootstrapRequired: () =>
    call<ApiReturn<"isBootstrapRequired">>("isBootstrapRequired"),
  fetchSampleRecords: (params) =>
    call<ApiReturn<"fetchSampleRecords">, ApiParams<"fetchSampleRecords">>(
      "fetchSampleRecords",
      params
    ),
  createSampleRecords: (records) =>
    call<ApiReturn<"createSampleRecords">, ApiParams<"createSampleRecords">>(
      "createSampleRecords",
      records
    ),
  evaluationJobStatus: (params) =>
    call<ApiReturn<"evaluationJobStatus">, ApiParams<"evaluationJobStatus">>(
      "evaluationJobStatus",
      params
    ),
  batchEnqueueEvaluationJobs: (payload) =>
    call<
      ApiReturn<"batchEnqueueEvaluationJobs">,
      ApiParams<"batchEnqueueEvaluationJobs">
    >("batchEnqueueEvaluationJobs", payload),
  activeEvaluationJobs: (params) =>
    call<ApiReturn<"activeEvaluationJobs">, ApiParams<"activeEvaluationJobs">>(
      "activeEvaluationJobs",
      params
    ),
  cancelEvaluationJob: (params) =>
    call<ApiReturn<"cancelEvaluationJob">, ApiParams<"cancelEvaluationJob">>(
      "cancelEvaluationJob",
      params
    ),
  updateSampleRecords: (record) =>
    call<ApiReturn<"updateSampleRecords">, ApiParams<"updateSampleRecords">>(
      "updateSampleRecords",
      record
    ),
  deleteSampleRecords: (records) =>
    call<ApiReturn<"deleteSampleRecords">, ApiParams<"deleteSampleRecords">>(
      "deleteSampleRecords",
      records
    ),
  download: (filename) =>
    call<ApiReturn<"download">, ApiParams<"download">>("download", filename),
  exportCsv: (payload) =>
    call<ApiReturn<"exportCsv">, ApiParams<"exportCsv">>("exportCsv", payload),
  fetchInstituteCredential: (params) =>
    call<
      ApiReturn<"fetchInstituteCredential">,
      ApiParams<"fetchInstituteCredential">
    >("getInstituteCredential", params),
  getModelConfig: () => call<ApiReturn<"getModelConfig">>("getModelConfig"),
  getRuntimeProfile: () => call<ApiReturn<"getRuntimeProfile">>("getRuntimeProfile"),
  uploadInit: (fileName, fileSize) =>
    call<ApiReturn<"uploadInit">, { fileName: string; fileSize: number }>(
      "uploadInit",
      { fileName, fileSize },
    ),
  uploadStatus: (uploadId) =>
    call<ApiReturn<"uploadStatus">, { uploadId: string }>("uploadStatus", {
      uploadId,
    }),
  async uploadChunk(uploadId, index, chunk) {
    const bytes = new Uint8Array(await chunk.arrayBuffer());
    await call<void, { uploadId: string; index: number; bytes: Uint8Array }>(
      "uploadChunk",
      { uploadId, index, bytes },
    );
  },
  uploadComplete: (uploadId) =>
    call<void, { uploadId: string }>("uploadComplete", { uploadId }),
  heatmapSource: (uploadId) =>
    call<string | null, { uploadId: string }>("uploadHeatmap", { uploadId }),
  slidePreviewSource: (uploadId) =>
    call<string | null, { uploadId: string }>("uploadSlidePreview", { uploadId }),
};
