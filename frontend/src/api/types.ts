import type {
  BaseResponse,
  InstituteCreateRequestPayload,
  InstituteCreateResponsePayload,
  InstituteQueryRequestPayload,
  InstituteCredentialRequestPayload,
  InstituteRegisterRequestPayload,
  InstituteQueryResponsePayload,
  InstituteVerifyRequestPayload,
  LoginRequestPayload,
  LoginResponsePaylod,
  QueryResponseData,
  RegisterRequestPayload,
  UserQueryRequestPayload,
  RegisterResponsePayload,
  SampleRecordRequestPayload,
  SampleRecordUpdatePayload,
  SampleRecordResponsePayload,
  SampleRecordDeleteRequestPayload,
  EvaluationJobStatusResponsePayload,
  BatchEnqueueEvaluationJobResponsePayload,
  ActiveEvaluationJobsResponsePayload,
  ModelConfigPayload,
  RuntimeProfilePayload,
} from "../types";
export type UploadState = { uploadId: string; chunkSize: number; totalChunks: number; uploadedChunks: number[] };

export type ApiType = {
  health(): Promise<{ ok: boolean }>;
  userList(params: UserQueryRequestPayload): Promise<BaseResponse<QueryResponseData>>;
  instituteList(params: InstituteQueryRequestPayload): Promise<BaseResponse<InstituteQueryResponsePayload>>;
  instituteCreate(payload: InstituteCreateRequestPayload): Promise<BaseResponse<InstituteCreateResponsePayload>>;
  verifyToken(token: InstituteVerifyRequestPayload["token"]): Promise<BaseResponse<InstituteQueryResponsePayload>>;
  userLogin(
    payload: LoginRequestPayload
  ): Promise<BaseResponse<LoginResponsePaylod>>;
  userLogout(): Promise<boolean>;
  userCreate(
    payload: RegisterRequestPayload
  ): Promise<BaseResponse<RegisterResponsePayload>>;
  instituteRegister(
    payload: InstituteRegisterRequestPayload
  ): Promise<BaseResponse<RegisterResponsePayload>>;
  userDelete(records: Array<{ uuid: string }>): Promise<BaseResponse<boolean>>;
  isBootstrapRequired(): Promise<boolean>;
  fetchSampleRecords(params: {
    instituteName: string;
    page: number;
    pageSize: number;
    deletedOnly?: boolean;
    searchKeyword?: string;
  }): Promise<BaseResponse<QueryResponseData>>;
  createSampleRecords(
    recordList: SampleRecordRequestPayload
  ): Promise<SampleRecordResponsePayload>;
  evaluationJobStatus(params: { jobUuid: string; instituteName: string }): Promise<EvaluationJobStatusResponsePayload>;
  batchEnqueueEvaluationJobs(payload: {
    instituteName: string;
    records: SampleRecordRequestPayload[];
    evaluationJobStart?: boolean;
  }): Promise<BatchEnqueueEvaluationJobResponsePayload>;
  activeEvaluationJobs(params: { instituteName: string }): Promise<ActiveEvaluationJobsResponsePayload>;
  cancelEvaluationJob(params: { jobUuid: string }): Promise<EvaluationJobStatusResponsePayload>;
  updateSampleRecords(
    record: SampleRecordUpdatePayload
  ): Promise<boolean>;
  deleteSampleRecords(
    selected: SampleRecordDeleteRequestPayload
  ): Promise<BaseResponse<SampleRecordResponsePayload>>;
  download(filename: string): Promise<{ canceled: boolean }>;
  exportCsv(payload: {
    filename: string;
    content: string;
  }): Promise<{ canceled: boolean }>;
  fetchInstituteCredential(params: InstituteCredentialRequestPayload): Promise<BaseResponse<QueryResponseData>>;
  getModelConfig(): Promise<ModelConfigPayload>;
  getRuntimeProfile(): Promise<RuntimeProfilePayload>;
  // Upload (SVS file chunked upload)
  uploadInit(fileName: string, fileSize: number): Promise<UploadState>;
  uploadStatus(uploadId: string): Promise<UploadState | null>;
  uploadChunk(uploadId: string, index: number, chunk: Blob): Promise<void>;
  uploadComplete(uploadId: string): Promise<void>;
  heatmapSource(uploadId: string): Promise<string | null>;
  slidePreviewSource(uploadId: string): Promise<string | null>;
};
