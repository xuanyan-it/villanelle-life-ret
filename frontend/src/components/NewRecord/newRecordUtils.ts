import { SampleType } from "../../types";
import type { QualityControlType } from "./newRecordTypes";
export const getSampleIdPrefix = (
  sampleType: SampleType | "",
  qualityControlType: QualityControlType
) =>
  sampleType === SampleType.QualityContral
    ? qualityControlType === "negative"
      ? "NQ-"
      : "PQ-"
    : "TT-";
export const mergeSampleId = (
  sampleId: string,
  sampleType: SampleType | "",
  qualityControlType: QualityControlType
) => {
  if (!sampleId) {
    return "";
  }
  const trailingParse = sampleId.match(/\s+$/)?.[0] ?? "";
  const baseSampleId = sampleId.slice(0, sampleId.length - trailingParse.length);
  const prefix = getSampleIdPrefix(sampleType, qualityControlType);
  const normalized = `${prefix}${baseSampleId}`.replace(/^(TT-|PQ-|NQ-)+/i, prefix);
  return `${normalized}${trailingParse}`;
};
export const isNotAvailableValue = (value: unknown) =>
  typeof value === "string" && value.toLowerCase() === "n/a";
