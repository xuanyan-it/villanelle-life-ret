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

export type EvaluationResultKind = "negative" | "positive" | "borderline";

const CLAM_LABEL_KIND: Record<string, EvaluationResultKind> = {
  N: "negative",
  P: "positive",
  R: "positive",
  B: "borderline",
};

const RESULT_LABEL_KEY: Record<EvaluationResultKind, string> = {
  negative: "recordTable_geneInfo_evaluationResult_non_metastasis",
  positive: "recordTable_geneInfo_evaluationResult_metastasis",
  borderline: "recordTable_geneInfo_evaluationResult_borderline",
};

const parseWorkerClass = (result: string): number | null => {
  const match = result.trim().match(/^class\s*=\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

/** Converts persisted worker output into a presentation-level result. */
export const getResultKind = (
  result: string,
): EvaluationResultKind | null => {
  if (!result) return null;
  const workerClass = parseWorkerClass(result);
  if (workerClass === 0) return "negative";
  if (workerClass === 1) return "positive";
  if (workerClass === 2) return "borderline";

  const clamLabel = result.trim().toUpperCase();
  if (CLAM_LABEL_KIND[clamLabel]) return CLAM_LABEL_KIND[clamLabel];

  const parsed = Number(result);
  if (!Number.isFinite(parsed)) return null;
  return parsed <= getResultPositiveThreshold() ? "negative" : "positive";
};

/** Returns the i18n key for the result label, or null if unrecognized. */
export const getResultLabelKey = (result: string): string | null => {
  const kind = getResultKind(result);
  return kind ? RESULT_LABEL_KEY[kind] : null;
};

/** Returns the Ant Design Tag color for the given result. */
export const getResultTagColor = (result: string): string => {
  const kind = getResultKind(result);
  if (kind === "negative") return "success";
  if (kind === "positive") return "volcano";
  if (kind === "borderline") return "warning";
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

export const isEvaluationResultAvailable = (result: string | undefined) => {
  return Boolean(result && getResultKind(result));
};
