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
export const isNonMetastasisResult = (
  result: string,
  threshold: number = getResultPositiveThreshold()
) => parseFloat(result) <= threshold;

export const isEvaluationResultAvailable = (result: string | undefined) => {
  if (!result) return false;
  const parsed = parseFloat(result);
  return Number.isFinite(parsed);
};
