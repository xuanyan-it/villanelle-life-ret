import Papa from "papaparse";
import type { SampleRecordRequestPayload} from "../types";
import { triggerBlobDownload } from "../platform/download";
import { getResultPositiveThreshold } from "../runtime/modelConfig";
import { Gender, SampleType } from "../types";
const trimText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const TRAIL_SAMPLE_ID_MARKER_REGEX = /\s{3,}$/;
const normalizeSampleType = (value: unknown, sampleId: string): SampleType | "" => {
  const normalized = trimText(value).toLowerCase();
  if (
    normalized === SampleType.Regular ||
    normalized === "regular" ||
    normalized === "tt"
  ) {
    return SampleType.Regular;
  }
  if (
    normalized === SampleType.QualityContral ||
    normalized === "quality" ||
    normalized === "qualitycontrol" ||
    normalized === "quality_control" ||
    normalized === "qc" ||
    normalized === "pq" ||
    normalized === "nq"
  ) {
    return SampleType.QualityContral;
  }
  const upperSampleId = sampleId.toUpperCase();
  if (upperSampleId.startsWith("PQ-") || upperSampleId.startsWith("NQ-")) {
    return SampleType.QualityContral;
  }
  if (upperSampleId.startsWith("TT-")) {
    return SampleType.Regular;
  }
  return "";
};
const normalizeGender = (
  value: unknown,
  sampleType: SampleType | "",
): Gender | "" => {
  if (sampleType === SampleType.QualityContral) {
    return Gender.None;
  }
  const normalized = trimText(value).toLowerCase();
  if (normalized === Gender.Male || normalized === "male" || normalized === "男") {
    return Gender.Male;
  }
  if (
    normalized === Gender.Female ||
    normalized === "female" ||
    normalized === "女"
  ) {
    return Gender.Female;
  }
  if (
    normalized === Gender.None ||
    normalized === "na" ||
    normalized === "n/a" ||
    normalized === "-"
  ) {
    return Gender.None;
  }
  return "";
};
const normalizeDate = (value: unknown, sampleType: SampleType | "") => {
  if (sampleType === SampleType.QualityContral) {
    return "n/a";
  }
  const normalized = trimText(value);
  if (!normalized || normalized.toLowerCase() === "n/a") {
    return "";
  }
  return normalized.replace(/\//g, "-");
};
const normalizeSampleId = (sampleId: string, sampleType: SampleType | "") => {
  const plainId = sampleId.replace(/^(TT-|PQ-|NQ-)+/i, "");
  if (!plainId) {
    return "";
  }
  if (sampleType === SampleType.QualityContral) {
    return /^NQ-/i.test(sampleId) ? `NQ-${plainId}` : `PQ-${plainId}`;
  }
  return `TT-${plainId}`;
};
const normalizeRow = (
  row: SampleRecordRequestPayload,
): SampleRecordRequestPayload => {
  const rawSampleId = typeof row.sampleId === "string" ? row.sampleId : "";
  const hasTrailMarker = TRAIL_SAMPLE_ID_MARKER_REGEX.test(rawSampleId);
  const baseSampleId = trimText(rawSampleId);
  const sampleType = normalizeSampleType(row.sampleType, baseSampleId);
  const normalizedSampleId = normalizeSampleId(baseSampleId, sampleType);
  return {
    ...row,
    sampleId: hasTrailMarker
      ? `${normalizedSampleId}   `
      : normalizedSampleId,
    sampleType: sampleType as SampleRecordRequestPayload["sampleType"],
    patientGender: normalizeGender(row.patientGender, sampleType) as Gender,
    samplingDate: normalizeDate(row.samplingDate, sampleType),
    receptionDate: normalizeDate(row.receptionDate, sampleType),
    RPS4Y1: trimText(row.RPS4Y1),
    PKHD1L1: trimText(row.PKHD1L1),
    CRABP1: trimText(row.CRABP1),
    GAPDH: trimText(row.GAPDH),
    doctorName: trimText(row.doctorName),
    patientName: trimText(row.patientName),
    patientAge: trimText(row.patientAge),
    otherInfo: trimText(row.otherInfo),
  };
};
/* design a type for import field values */
const validateRow = (row: SampleRecordRequestPayload) => {
  if (!row.sampleId) {
    console.log(`error at row.sampleId`, row.sampleId);
    return false;
  }
  if (
    !row.sampleType ||
    (row.sampleType !== SampleType.Regular &&
      row.sampleType !== SampleType.QualityContral)
  ) {
    console.log(`error at row.sampleType`, row.sampleType);
    return false;
  }
  if (row.sampleType === SampleType.Regular) {
    if (!row.samplingDate || !row.receptionDate) {
      console.log(`error at row.sampleDate`, row.samplingDate, row.receptionDate);
      return false;
    }
    if (
      row.patientGender !== Gender.Male &&
      row.patientGender !== Gender.Female
    ) {
      console.log(`error at row.patientGender`, row.patientGender);
      return false;
    }
  }
  if (!row.RPS4Y1.length) {
    console.log(`error at row.RPS4Y1`, row.RPS4Y1);
    return false;
  }
  if (!row.PKHD1L1.length) {
    console.log(`error at row.PKHD1L1`, row.PKHD1L1);
    return false;
  }
  if (!row.CRABP1.length) {
    console.log(`error at row.CRABP1`, row.CRABP1);
    return false;
  }
  if (!row.GAPDH.length) {
    console.log(`error at row.GAPDH`, row.GAPDH);
    return false;
  }
  if (row.otherInfo && row.otherInfo.length > 30) {
    console.log(`error at row.otherInfo`, row.otherInfo);
    return false;
  }
  return true;
};
const csv2ObjectArr = (file: any): Promise<SampleRecordRequestPayload[]> => {
  return new Promise<
    Omit<SampleRecordRequestPayload[], "testDate" | "testerName">
  >((resolve, reject) => {
    Papa.parse<SampleRecordRequestPayload>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const sampleRecordRequestPayloadArr: SampleRecordRequestPayload[] = [];
        for (const row of result.data) {
          const sampleId = row.sampleId?.trim();
          if (!sampleId) {
            continue;
          }
          if (sampleId === "***************") {
            break;
          }
          const normalizedRow = normalizeRow(row);
          if (!validateRow(normalizedRow)) {
            console.log(
              `Validation failed for row: ${JSON.stringify(normalizedRow)}`,
            );
            reject(`Validation failed for row: ${JSON.stringify(normalizedRow)}`);
            break;
          }
          sampleRecordRequestPayloadArr.push(normalizedRow);
        }
        resolve(sampleRecordRequestPayloadArr.reverse());
      },
      error: (error) => reject(error),
    });
  });
};
const buildCsvContent = (arr: any[]): string => {
  const columns = [
    "id",
    "sampleId",
    "patientGender",
    "sampleType",
    "samplingDate",
    "receptionDate",
    "RPS4Y1",
    "PKHD1L1",
    "CRABP1",
    "GAPDH",
    "doctorName",
    "patientName",
    "patientAge",
    "otherInfo",
    "result",
    "",
  ];
  const formatDate = (value?: string) => {
    if (!value || value.toLowerCase?.() === "n/a") {
      return "";
    }
    return value.substring(0, 10).replace(/-/g, "/");
  };
  const formatNumber = (value?: string) => {
    if (value === undefined || value === null || value === "") {
      return "";
    }
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  };
  const data = arr.map((item, index) => ({
    id: (index + 1).toString(),
    sampleId: item.sampleId ?? "",
    patientGender: item.patientGender ?? "",
    sampleType: item.sampleType ?? "",
    samplingDate: formatDate(item.samplingDate),
    receptionDate: formatDate(item.receptionDate),
    RPS4Y1: formatNumber(item.RPS4Y1),
    PKHD1L1: formatNumber(item.PKHD1L1),
    CRABP1: formatNumber(item.CRABP1),
    GAPDH: formatNumber(item.GAPDH),
    doctorName: item.doctorName ?? "",
    patientName: item.patientName ?? "",
    patientAge: item.patientAge ?? "",
    otherInfo: item.otherInfo ?? "",
    result: parseFloat(item.result) <= getResultPositiveThreshold() ? "0" : "1",
    "": "",
  }));
  const csv = Papa.unparse(data, { columns });
  const guideBlock = [
    "***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************",
    "id,row number,start with 1,,,,,,,,,,",
    "sampleId,sample id,regular -> TT-xxx; quality control -> PQ-xxx or NQ-xxx,,,,,,,,,,",
    "patientGender,patient gender,regular uses m/f; quality control can be n/a,,,,,,,,,,",
    "sampleType,sample type,accept r/q (case-insensitive); r=regular q=quality control,,,,,,,,,,",
    "sampleId trailing spaces,trail marker,if sampleType=r and sampleId ends with 3 spaces then worker uses f,,,,,,,,,,",
    "samplingDate,sampling date,YYYY/MM/DD; quality control can be n/a,,,,,,,,,,",
    "receptionDate,reception date,YYYY/MM/DD; quality control can be n/a,,,,,,,,,,",
    "RPS4Y1,RPS4Y1 CT,value required,,,,,,,,,,",
    "PKHD1L1,PKHD1L1 CT,value required,,,,,,,,,,",
    "CRABP1,CRABP1 CT,value required,,,,,,,,,,",
    "GAPDH,GAPDH CT,value required,,,,,,,,,,",
    "doctorName,doctor name,optional,,,,,,,,,,",
    "patientName,patient name,optional,,,,,,,,,,",
    "patientAge,patient age,optional,,,,,,,,,,",
    "otherInfo,other info,max 30 chars,,,,,,,,,,",
    "result,evaluation result,0 or 1,,,,,,,,,,",
    "***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************,***************",
    "save as UTF-8 csv,,,,,,,,,,,,,",
  ].join("\r\n");
  const bom = "\uFEFF";
  return bom + csv + "\r\n" + guideBlock;
};
const objectArr2csv = (arr: any[]): any => {
  const content = buildCsvContent(arr);
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;",
  });
  const now = new Date();
  const pad2 = (value: number) => value.toString().padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
    now.getDate(),
  )}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  triggerBlobDownload(blob, `export_${stamp}.csv`);
};
export { buildCsvContent,csv2ObjectArr, objectArr2csv };
