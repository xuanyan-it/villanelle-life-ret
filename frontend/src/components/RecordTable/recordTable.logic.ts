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

/** CLAM multi-class label keys */
const CLAM_LABEL_MAP: Record<string, string> = {
  N: "recordTable_geneInfo_evaluationResult_normal",
  R: "recordTable_geneInfo_evaluationResult_retfusion",
  B: "recordTable_geneInfo_evaluationResult_borderline",
};

const CLAM_TAG_COLOR: Record<string, string> = {
  N: "success",
  R: "volcano",
  B: "warning",
};

/** Returns the i18n key for the result label, or null if unrecognized. */
export const getResultLabelKey = (result: string): string | null => {
  if (!result) return null;
  // CLAM class label
  if (CLAM_LABEL_MAP[result]) return CLAM_LABEL_MAP[result];
  // Legacy numeric result
  const parsed = parseFloat(result);
  if (!Number.isFinite(parsed)) return null;
  return parsed <= getResultPositiveThreshold()
    ? "recordTable_geneInfo_evaluationResult_non_metastasis"
    : "recordTable_geneInfo_evaluationResult_metastasis";
};

/** Returns the Ant Design Tag color for the given result. */
export const getResultTagColor = (result: string): string => {
  if (CLAM_TAG_COLOR[result]) return CLAM_TAG_COLOR[result];
  const parsed = parseFloat(result);
  if (!Number.isFinite(parsed)) return "default";
  return parsed <= getResultPositiveThreshold() ? "success" : "volcano";
};

export const isNonMetastasisResult = (
  result: string,
  threshold: number = getResultPositiveThreshold()
) => {
  // CLAM: "N" is negative (normal)
  if (result === "N") return true;
  if (result === "R" || result === "B") return false;
  // Legacy numeric
  return parseFloat(result) <= threshold;
};

export const isEvaluationResultAvailable = (result: string | undefined) => {
  if (!result) return false;
  // CLAM class label
  if (CLAM_LABEL_MAP[result]) return true;
  // Legacy numeric
  const parsed = parseFloat(result);
  return Number.isFinite(parsed);
};
