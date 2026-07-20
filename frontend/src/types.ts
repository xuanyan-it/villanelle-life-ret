/* API */
import type { Key } from "react";
import type {
  BaseResponse as SharedBaseResponse,
  QueryResponseData as SharedQueryResponseData
} from "@villanelle/ret-shared/contracts";
import type {
  BaseInstituteCreateRequest,
  BaseInstituteCredentialRequest,
  BaseModelConfig,
  BaseInstituteListRequest,
  BaseInstituteRegisterRequest,
  BaseRuntimeProfile,
  BaseRecordCreateRequest,
  BaseRecordDeleteRequest,
  BaseRecordDeleteByUuidRequest,
  BaseRecordUpdateRequest,
  BaseRecordResponse,
  BaseEvaluationJobStatusResponse,
  BatchEnqueueEvaluationJobResponse,
  ActiveEvaluationJobsResponse,
  BaseInstituteVerifyRequest,
  BaseUserCreateRequest,
  BaseUserListRequest,
  BaseUserLoginRequest,
  BaseUserSummary
} from "@villanelle/ret-shared/contracts/base";
import type {
  EvaluationResultEnum as DomainEvaluationResult,
  Gender as DomainGenderValue,
  SampleType as DomainSampleTypeValue,
  UserRole as SharedUserRole
} from "@villanelle/ret-shared/domain";
import {
  EvaluationResultEnum as DomainEvaluationResultEnum,
  Gender as DomainGender,
  SampleType as DomainSampleType
} from "@villanelle/ret-shared/domain";
export interface ElectronRuntime {
  isElectronRuntime: boolean;
}
export type ElectronCall = <T = unknown, P = unknown>(
  route: string,
  payload?: P,
) => Promise<T>;
export interface ElectronAPI {
  call: ElectronCall;
  download: (filename: string) => Promise<{ canceled: boolean }>;
  exportCsv: (payload: {
    filename: string;
    content: string;
  }) => Promise<{ canceled: boolean }>;
  evaluationResponse: (callback: (record: SampleRecord) => void) => () => void;
  shellOutput: (callback: (data: string) => void) => () => void;
  workerReady: (callback: (payload: {
    type: string;
    ok: boolean;
    error?: string;
    pending?: boolean;
  }) => void) => () => void;
  fetchSampleRecords: (params: {
    instituteName: string;
    page?: number;
    pageSize?: number;
    deletedOnly?: boolean;
    searchKeyword?: string;
  }) => Promise<BaseResponse<QueryResponseData>>;
  createSampleRecords: (
    record: SampleRecordRequestPayload,
  ) => Promise<SampleRecordResponsePayload>;
  updateSampleRecords: (
    record: SampleRecordUpdatePayload,
  ) => Promise<boolean>;
  deleteSampleRecords: (
    record: SampleRecordDeletePayload[],
  ) => Promise<BaseResponse<SampleRecordResponsePayload>>;
  quitApp?: () => void;
}
declare global {
  interface Window {
    electron?: ElectronRuntime;
    electronAPI: ElectronAPI;
  }
}
export type BaseResponse<T = any, D = any> = SharedBaseResponse<T, D>;
export type QueryResponseData<T = any> = SharedQueryResponseData<T>;
export const enum RequestStatus {
  None = "none",
  Success = "success",
  Error = "error",
  Pending = "pending",
}
/* User */
export interface UserState {
  uuid: string;
  instituteName: string;
  username: string;
  email: string;
  userRole: UserRole | null;
  status: RequestStatus;
}
export type UserQueryRequestPayload = BaseUserListRequest;
export type UserQueryResponsePayload = Omit<UserState, "status">;
export interface AdminState {
  total: number;
  token: string;
  userList: Array<Pick<BaseUserSummary, "username" | "email" | "userRole" | "uuid">>;
  status: RequestStatus;
}
export const UserRole = {
  Administrator: "administrator",
  Operator: "operator"
} as const satisfies Record<string, SharedUserRole>;
export type UserRole = SharedUserRole;
/* login */
export type LoginRequestPayload = BaseUserLoginRequest;
export type LoginResponsePaylod = Omit<UserState, "status">;
/* register */
export type RegisterRequestPayload = BaseUserCreateRequest;
export type RegisterResponsePayload = UserState;
/* Record */
export const Gender = DomainGender;
export type Gender = DomainGenderValue;
export const SampleType = DomainSampleType;
export type SampleType = DomainSampleTypeValue;
export enum NewMissionType {
  AddOne = "addOne",
  ImportMany = "importMany",
}
export type SampleRecord = BaseRecordResponse;
export type SampleRecordRequestPayload = BaseRecordCreateRequest;
export type SampleRecordUpdatePayload = BaseRecordUpdateRequest;
export type SampleRecordDeletePayload = BaseRecordDeleteByUuidRequest;
export type SampleRecordDeleteRequestPayload = BaseRecordDeleteRequest;
export type SampleRecordResponsePayload = SampleRecord;
export type EvaluationJobStatusResponsePayload = BaseEvaluationJobStatusResponse;
export type BatchEnqueueEvaluationJobResponsePayload = BatchEnqueueEvaluationJobResponse;
export type ActiveEvaluationJobsResponsePayload = ActiveEvaluationJobsResponse;
/* Evaluation */
export const EvaluationResultEnum = DomainEvaluationResultEnum;
export type EvaluationResultEnum = DomainEvaluationResult;
export enum LocaleEnum {
  English = "en-US",
  Chinese = "zh-CN",
}
export interface SelectedRowsByPage {
  page: number;
  rows: SampleRecord[];
  rowKeys: Key[];
}
export interface RecordState {
  status: RequestStatus;
  total: number;
  currentPage: number;
  pageSize: number;
  deletedOnly: boolean;
  searchKeyword: string;
  activeFetchRequestId?: string;
  recordList: SampleRecordResponsePayload[];
  selectedRowsByPage: SelectedRowsByPage[];
  testQueueLength: number;
  testQueue: SampleRecordRequestPayload[];
}
/* institute */
export interface InstituteState {
  uuid: string;
  instituteName: string;
  token: string;
}
export type InstituteQueryRequestPayload = BaseInstituteListRequest;
export type InstituteCredentialRequestPayload = BaseInstituteCredentialRequest;
export type InstituteVerifyRequestPayload = BaseInstituteVerifyRequest;
export type InstituteRegisterRequestPayload = BaseInstituteRegisterRequest;
export type InstituteQueryResponsePayload = QueryResponseData<
  Pick<
    InstituteState,
    "uuid" | "instituteName" | "token"
  >
>;
export type InstituteCreateRequestPayload = BaseInstituteCreateRequest;
export type InstituteCreateResponsePayload = Pick<
  InstituteState,
  "instituteName"
>;
export type InstituteDeleteRequestPayload = Pick<
  InstituteState,
  "instituteName" | "uuid"
>;
export type InstituteDeleteResponsePayload = boolean;
export type ModelConfigPayload = BaseModelConfig;
export type RuntimeProfilePayload = BaseRuntimeProfile;

export interface NotificationState {
  type: "success" | "info" | "warning" | "error";
  // managed by i18n, must match
  message: string;
  // managed by i18n, must match
  description: string;
}
