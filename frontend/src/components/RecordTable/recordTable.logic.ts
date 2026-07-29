import type { SampleRecordResponsePayload } from "../../types";
import { getResultPositiveThreshold } from "../../runtime/modelConfig";

export const formatCt = (value?: string) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
};

export const filterVisibleRecords = (
  records: SampleRecordResponsePayload[],
  showDeletedOnly: boolean
) =>
  records.filter((record) =>
    showDeletedOnly ? Boolean(record.isDeleted) : !record.isDeleted
  );

export type EvaluationResultKind =
  | "nonRet"
  | "negative"
  | "ret"
  | "brafv600e"
  | "brafTert"
  | "ras";

const CLAM_LABEL_KIND: Record<string, EvaluationResultKind> = {
  N: "negative",
  P: "ret",
  R: "ret",
  RET: "ret",
  B: "brafv600e",
  BRAFV600E: "brafv600e",
  "BRAF+TERT": "brafTert",
  RAS: "ras",
};

const RESULT_LABEL_KEY: Record<EvaluationResultKind, string> = {
  nonRet: "recordTable_geneInfo_evaluationResult_nonRet",
  negative: "recordTable_geneInfo_evaluationResult_negative",
  ret: "recordTable_geneInfo_evaluationResult_ret",
  brafv600e: "recordTable_geneInfo_evaluationResult_brafv600e",
  brafTert: "recordTable_geneInfo_evaluationResult_brafTert",
  ras: "recordTable_geneInfo_evaluationResult_ras",
};

const parseWorkerClass = (result: string): number | null => {
  const match = result.trim().match(/^class\s*=\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

/** Converts persisted worker output into a presentation-level result. */
export const getResultKind = (
  result: string,
  modelType?: string,
): EvaluationResultKind | null => {
  if (!result) return null;
  const workerClass = parseWorkerClass(result);
  if (workerClass !== null) {
    const normalizedModelType = String(modelType ?? "").toLowerCase();
    const classKinds: Record<string, EvaluationResultKind[]> = {
      "2class": ["nonRet", "ret"],
      "3class": ["negative", "ret", "brafv600e"],
      "5class": ["negative", "ret", "brafv600e", "brafTert", "ras"],
    };
    const configuredKind = classKinds[normalizedModelType]?.[workerClass];
    if (configuredKind) return configuredKind;

    // Backward compatibility for records created before modelType was stored.
    return ["negative", "ret", "brafv600e", "brafTert", "ras"][workerClass] as
      | EvaluationResultKind
      | undefined ?? null;
  }

  const clamLabel = result.trim().toUpperCase();
  if (CLAM_LABEL_KIND[clamLabel]) return CLAM_LABEL_KIND[clamLabel];

  const parsed = Number(result);
  if (!Number.isFinite(parsed)) return null;
  return parsed <= getResultPositiveThreshold() ? "negative" : "ret";
};

/** Returns the i18n key for the result label, or null if unrecognized. */
export const getResultLabelKey = (
  result: string,
  modelType?: string,
): string | null => {
  const kind = getResultKind(result, modelType);
  return kind ? RESULT_LABEL_KEY[kind] : null;
};

/** Returns the Ant Design Tag color for the given result. */
export const getResultTagColor = (result: string, modelType?: string): string => {
  const kind = getResultKind(result, modelType);
  if (kind === "negative" || kind === "nonRet") return "success";
  if (kind === "ret") return "volcano";
  if (kind === "brafv600e") return "blue";
  if (kind === "brafTert") return "magenta";
  if (kind === "ras") return "gold";
  return "default";
};

export const isNonMetastasisResult = (
  result: string,
  threshold: number = getResultPositiveThreshold()
) => {
  const workerClass = parseWorkerClass(result);
  if (workerClass !== null) return workerClass === 0;
  const clamLabel = result.trim().toUpperCase();
  if (clamLabel === "N") return true;
  if (clamLabel === "P" || clamLabel === "R" || clamLabel === "B") return false;
  return Number(result) <= threshold;
};

export const isEvaluationResultAvailable = (
  result: string | undefined,
  modelType?: string,
) => {
  return Boolean(result && getResultKind(result, modelType));
};
