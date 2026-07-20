import { z } from "zod";
import type { QueryResult } from "./common.types";

export const GenderSchema = z.enum(["n/a", "f", "m"]);
export type Gender = z.infer<typeof GenderSchema>;
export const Gender = {
  None: "n/a",
  Female: "f",
  Male: "m"
} as const satisfies Record<string, Gender>;

export const SampleTypeSchema = z.enum(["q", "r"]);
export type SampleType = z.infer<typeof SampleTypeSchema>;
export const SampleType = {
  QualityContral: "q",
  Regular: "r"
} as const satisfies Record<string, SampleType>;

export const EvaluationResultEnumSchema = z.enum(["0", "1", "2", ""]);
export type EvaluationResultEnum = z.infer<typeof EvaluationResultEnumSchema>;
export const EvaluationResultEnum = {
  Non_Metastasis: "0",
  Central: "1",
  Cervical: "2",
  Empty: ""
} as const satisfies Record<string, EvaluationResultEnum>;

export const RecordDraftSchema = z.object({
  hospitalName: z.string(),
  doctorName: z.string(),
  patientName: z.string(),
  patientAge: z.string(),
  patientGender: z.string(),
  sampleId: z.string(),
  sampleType: z.string(),
  samplingDate: z.string(),
  receptionDate: z.string(),
  testDate: z.string(),
  RPS4Y1: z.string(),
  PKHD1L1: z.string(),
  CRABP1: z.string(),
  GAPDH: z.string(),
  testerName: z.string(),
  otherInfo: z.string(),
  instituteName: z.string()
});
export type RecordDraft = z.infer<typeof RecordDraftSchema>;

export const SampleRecordSchema = RecordDraftSchema.extend({
  id: z.number().int(),
  uuid: z.string(),
  checkerName: z.string(),
  reviewerName: z.string(),
  result: z.string(),
  isDeleted: z.number().int()
});
export type SampleRecord = z.infer<typeof SampleRecordSchema>;
export type RecordUpdate = Omit<SampleRecord, "id" | "checkerName">;

export interface RecordRepositoryPort {
  list(params: {
    instituteName: string;
    page: number;
    pageSize: number;
    deletedOnly?: boolean;
    searchKeyword?: string;
  }): Promise<QueryResult<SampleRecord>>;
  create(payload: RecordDraft, result: string): Promise<SampleRecord>;
  update(payload: RecordUpdate): Promise<boolean>;
  deleteByUuids(uuids: string[]): Promise<boolean>;
}
