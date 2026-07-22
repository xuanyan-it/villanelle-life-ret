import Papa from "papaparse";
import { triggerBlobDownload } from "../platform/download";
import type { SampleRecordRequestPayload } from "../types";

export const csv2ObjectArr = async (_file?: unknown): Promise<SampleRecordRequestPayload[]> => {
  throw new Error("CSV batch import is not supported for SVS analysis");
};

export const buildCsvContent = (records: any[]): string => {
  const data = records.map((record, index) => ({
    id: index + 1,
    slideFileName: record.slideFileName ?? "",
    slideId: record.slideId ?? "",
    modelType: record.modelType ?? "",
    generateHeatmap: Boolean(record.generateHeatmap),
    patientName: record.patientName ?? "",
    patientAge: record.patientAge ?? "",
    patientGender: record.patientGender ?? "",
    doctorName: record.doctorName ?? "",
    result: record.result ?? "",
    testDate: record.testDate ?? "",
  }));
  return `\uFEFF${Papa.unparse(data)}`;
};

export const objectArr2csv = (records: any[]): void => {
  const blob = new Blob([buildCsvContent(records)], { type: "text/csv;charset=utf-8" });
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  triggerBlobDownload(blob, `ret_fusion_${stamp}.csv`);
};
