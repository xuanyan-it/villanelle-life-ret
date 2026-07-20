import type { SampleRecordRequestPayload } from "../../types";
export type QualityControlType = "positive" | "negative";
export interface SampleRecordInputFieldType {
  name: string;
  label: string;
  valuePresentation?: Record<string, string>;
}
export type SampleRecordFormItems = Record<string, SampleRecordInputFieldType>;
export type FormFieldType = Omit<
  SampleRecordRequestPayload,
  | "instituteName"
  | "hospitalName"
  | "testDate"
  | "sampleType"
  // Async evaluation MVP fields are not part of the NewRecord form UI.
  | "evaluationAsync"
  | "evaluationJobUuid"
> & { sampleType: SampleRecordRequestPayload["sampleType"] | "" };
