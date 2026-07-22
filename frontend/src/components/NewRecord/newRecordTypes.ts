import type { SampleRecordRequestPayload } from "../../types";
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
  | "uploadId"
  | "slideFileName"
  | "slideId"
  // Async evaluation MVP fields are not part of the NewRecord form UI.
  | "evaluationAsync"
  | "evaluationJobUuid"
> & {
  slideFile?: File;
  modelType?: "2class" | "3class" | "5class";
  generateHeatmap?: boolean;
};
