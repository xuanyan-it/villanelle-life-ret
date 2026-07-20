import type {
  BaseResponse as SharedBaseResponse,
  QueryResponseData as SharedQueryResponseData
} from "@villanelle/ret-shared/contracts";
import type {
  BaseRecordCreateRequest,
  BaseRecordResponse
} from "@villanelle/ret-shared/contracts/base";
import {
  Gender as DomainGender,
  SampleType as DomainSampleType
} from "@villanelle/ret-shared/domain";
import type {
  Gender as DomainGenderValue,
  SampleType as DomainSampleTypeValue
} from "@villanelle/ret-shared/domain";

export type BaseResponse<T = any, D = any> = SharedBaseResponse<T, D>;
export type QueryResponseData<T = any> = SharedQueryResponseData<T>;

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
export type SampleRecordResponsePayload = SampleRecord;
