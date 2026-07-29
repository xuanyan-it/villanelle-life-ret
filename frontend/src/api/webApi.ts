import axios from "axios";
import type {
  BaseResponse,
  InstituteCreateRequestPayload,
  InstituteCreateResponsePayload,
  InstituteQueryRequestPayload,
  InstituteQueryResponsePayload,
  LoginRequestPayload,
  LoginResponsePaylod,
  QueryResponseData,
  RegisterRequestPayload,
  RegisterResponsePayload,
  RuntimeProfilePayload,
  SampleRecordRequestPayload,
  SampleRecordUpdatePayload,
  SampleRecordDeleteRequestPayload,
  SampleRecordResponsePayload,
  EvaluationJobStatusResponsePayload,
  BatchEnqueueEvaluationJobResponsePayload,
  ActiveEvaluationJobsResponsePayload,
  ModelConfigPayload,
} from "../types";
import { triggerBlobDownload } from "../platform/download";
import type { ApiType } from "./types";
/**
 * Axios Response Schema
 * {
  // `data` is the response that was provided by the server
  data: {},
  // `status` is the HTTP status code from the server response
  status: 200,
  // `statusText` is the HTTP status message from the server response
  // As of HTTP/2 status text is blank or unsupported.
  // (HTTP/2 RFC: https://www.rfc-editor.org/rfc/rfc7540#section-8.1.2.4)
  statusText: 'OK',
  // `headers` the HTTP headers that the server responded with
  // All header names are lower cased and can be accessed using the bracket notation.
  // Example: `response.headers['content-type']`
  headers: {},
  // `config` is the config that was provided to `axios` for the request
  config: {},
  // `request` is the request that generated this response
  // It is the last ClientRequest instance in node.js (in redirects)
  // and an XMLHttpRequest instance in the browser
  request: {}
}
 */
const endPoints = {
  health: "/health",
  // record
  fetchSampleRecords: "/api/record/list",
  createSampleRecords: "/api/record/create",
  batchEnqueueEvaluationJobs: "/api/record/evaluation-jobs",
  activeEvaluationJobs: "/api/record/evaluation-jobs/active",
  evaluationJobStatus: "/api/record/evaluation-jobs",
  updateSampleRecords: "/api/record/update",
  deleteSampleRecords: "/api/record/delete",
  // user
  userLogin: "/api/user/login",
  userLogout: "/api/user/logout",
  userCreate: "/api/user/create",
  userDelete: "/api/user/delete",
  // admin
  userList: "/api/user/list",
  instituteList: "/api/institute/list",
  instituteCreate: "/api/institute/create",
  fetchInstituteCredential: "/api/institute/credential/get",
  // institute
  instituteRegister: "/api/institute/register",
  verifyToken: "/api/institute/verify",
  modelConfig: "/api/model/config",
  runtimeProfile: "/api/model/runtime-profile",
  // other
  quitApp: "",
  shellOutput: "/api",
  // download
  downloadTemplate: "/api/download",
};
const apiClient = axios.create({
  withCredentials: true
});
/**
 * Api return value should care only about the data sent from server
 */
export const webApi: ApiType = {
  health: async () => {
    const response = await apiClient.get<{ ok: boolean }>(endPoints.health);
    return response.data;
  },
  userList: async (params: { instituteName: string }) => {
    try {
      const response = await apiClient.post<BaseResponse<QueryResponseData>>(
        endPoints.userList,
        {
          instituteName: params.instituteName,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  instituteList: async (params: InstituteQueryRequestPayload) => {
    const response = await apiClient.post<BaseResponse<InstituteQueryResponsePayload>>(
      endPoints.instituteList,
      params
    );
    return response.data;
  },
  instituteCreate: async (payload: InstituteCreateRequestPayload) => {
    const response = await apiClient.post<BaseResponse<InstituteCreateResponsePayload>>(
      endPoints.instituteCreate,
      payload
    );
    return response.data;
  },
  verifyToken: async (token: string) => {
    try {
      const response = await apiClient.post<
        BaseResponse<InstituteQueryResponsePayload>
      >(endPoints.verifyToken, {
        token,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  userLogin: async ({ email, password }: LoginRequestPayload) => {
    try {
      const response = await apiClient.post<BaseResponse<LoginResponsePaylod>>(
        endPoints.userLogin,
        {
          email,
          password,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  userLogout: async () => {
    await apiClient.post(endPoints.userLogout, {});
    return true;
  },
  userCreate: async ({
    instituteName,
    username,
    email,
    password,
    userRole,
  }: RegisterRequestPayload) => {
    try {
      const response = await apiClient.post<BaseResponse<RegisterResponsePayload>>(
        endPoints.userCreate,
        {
          instituteName,
          username,
          email,
          password,
          userRole,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  instituteRegister: async ({ instituteName, username, email, password }) => {
    try {
      const response = await apiClient.post<BaseResponse<RegisterResponsePayload>>(
        endPoints.instituteRegister,
        {
          instituteName,
          username,
          email,
          password,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  userDelete: async (records: Array<{ uuid: string }>) => {
    try {
      const response = await apiClient.post<BaseResponse<boolean>>(
        endPoints.userDelete,
        records
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  isBootstrapRequired: async () => {
    throw new Error("isBootstrapRequired is not supported in web runtime");
  },
  fetchSampleRecords: async (params: {
    instituteName: string;
    page: number;
    pageSize: number;
    deletedOnly?: boolean;
    searchKeyword?: string;
  }) => {
    try {
      const response = await apiClient.post<BaseResponse<QueryResponseData>>(
        endPoints.fetchSampleRecords,
        params
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  createSampleRecords: async (
    recordList: SampleRecordRequestPayload
  ): Promise<SampleRecordResponsePayload> => {
    try {
      const response = await apiClient.post<
        BaseResponse<SampleRecordResponsePayload>
      >(endPoints.createSampleRecords, recordList);
      return response.data.payload[0];
    } catch (error) {
      throw error;
    }
  },
  evaluationJobStatus: async ({
    jobUuid,
    instituteName,
  }: {
    jobUuid: string;
    instituteName: string;
  }): Promise<EvaluationJobStatusResponsePayload> => {
    const response = await apiClient.get<
      BaseResponse<EvaluationJobStatusResponsePayload>
    >(`${endPoints.evaluationJobStatus}/${jobUuid}`, {
      params: { instituteName },
    });
    return response.data.payload[0];
  },
  cancelEvaluationJob: async ({ jobUuid }: { jobUuid: string }): Promise<EvaluationJobStatusResponsePayload> => {
    const response = await apiClient.patch<
      BaseResponse<EvaluationJobStatusResponsePayload>
    >(`${endPoints.evaluationJobStatus}/${jobUuid}`, {
      cancelRequested: true,
    });
    return response.data.payload[0];
  },
  batchEnqueueEvaluationJobs: async ({
    instituteName,
    records,
    evaluationJobStart,
  }: {
    instituteName: string;
    records: SampleRecordRequestPayload[];
    evaluationJobStart?: boolean;
  }): Promise<BatchEnqueueEvaluationJobResponsePayload> => {
    const response = await apiClient.post<
      BaseResponse<BatchEnqueueEvaluationJobResponsePayload>
    >(endPoints.batchEnqueueEvaluationJobs, {
      instituteName,
      records,
      evaluationJobStart,
    });
    return response.data.payload[0];
  },
  activeEvaluationJobs: async ({
    instituteName,
  }: {
    instituteName: string;
  }): Promise<ActiveEvaluationJobsResponsePayload> => {
    const response = await apiClient.get<
      BaseResponse<ActiveEvaluationJobsResponsePayload>
    >(endPoints.activeEvaluationJobs, {
      params: { instituteName },
    });
    return response.data.payload[0];
  },
  updateSampleRecords: async (record: SampleRecordUpdatePayload) => {
    const response = await apiClient.post<BaseResponse<boolean>>(
      endPoints.updateSampleRecords,
      record
    );
    return Boolean(response.data.payload[0]);
  },
  deleteSampleRecords: async (
    selectedRecords: SampleRecordDeleteRequestPayload
  ) => {
    try {
      const response = await apiClient.post<
        BaseResponse<SampleRecordResponsePayload>
      >(endPoints.deleteSampleRecords, selectedRecords);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  download: async (filename: string) => {
    try {
      const response = await apiClient.get(endPoints.downloadTemplate, {
        params: {
          file: filename,
        },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv" });
      triggerBlobDownload(blob, `${filename}`);
      return { canceled: false };
    } catch (error) {
      throw error;
    }
  },
  exportCsv: async (payload: { filename: string; content: string }) => {
    const blob = new Blob([payload.content], {
      type: "text/csv;charset=utf-8;",
    });
    triggerBlobDownload(blob, payload.filename);
    return { canceled: false };
  },
  fetchInstituteCredential: async (params: { instituteName: string }) => {
    try {
      const response = await apiClient.post<BaseResponse<QueryResponseData>>(
        endPoints.fetchInstituteCredential,
        params
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getModelConfig: async () => {
    try {
      const response = await apiClient.get<BaseResponse<ModelConfigPayload>>(
        endPoints.modelConfig
      );
      return response.data.payload[0];
    } catch (error) {
      throw error;
    }
  },
  getRuntimeProfile: async () => {
    const response = await apiClient.get<BaseResponse<RuntimeProfilePayload>>(
      endPoints.runtimeProfile
    );
    return response.data.payload[0];
  },
  // Upload helpers
  uploadInit: async (fileName: string, fileSize: number) => {
    const res = await apiClient.post("/api/uploads/init", { fileName, fileSize });
    return res.data;
  },
  uploadStatus: async (uploadId: string) => {
    try {
      const res = await apiClient.get(`/api/uploads/${uploadId}/status`);
      return res.data;
    } catch {
      return null;
    }
  },
  uploadChunk: async (uploadId: string, index: number, chunk: Blob) => {
    const res = await fetch(`/api/uploads/${uploadId}/chunks/${index}`, {
      method: "PUT", credentials: "include",
      headers: { "content-type": "application/octet-stream" },
      body: chunk,
    });
    if (!res.ok) throw new Error(`chunk ${index} upload failed`);
  },
  uploadComplete: async (uploadId: string) => {
    await apiClient.post(`/api/uploads/${uploadId}/complete`, {});
  },
  heatmapSource: async (uploadId: string) =>
    `/api/uploads/${encodeURIComponent(uploadId)}/heatmap`,
};
