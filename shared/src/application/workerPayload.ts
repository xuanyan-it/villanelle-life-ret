const TRAIL_SAMPLE_ID_MARKER_REGEX = /\s{3,}$/;

export const mapGenderForWorker = (patientGender: string): string =>
  patientGender === "f" ? "0" : "1";

export const mapSampleTypeForWorker = (sampleType: string, sampleId: string): string =>
  sampleType === "r" && TRAIL_SAMPLE_ID_MARKER_REGEX.test(sampleId) ? "f" : sampleType;

export const computeDetForWorker = (
  PKHD1L1: string,
  RPS4Y1: string,
  CRABP1: string,
  GAPDH: string
): { DET_PKHD1L1: string; DET_RPS4Y1: string; DET_CRABP1: string } => ({
  DET_PKHD1L1: `${Number.parseFloat(PKHD1L1) - Number.parseFloat(GAPDH)}`,
  DET_RPS4Y1: `${Number.parseFloat(RPS4Y1) - Number.parseFloat(GAPDH)}`,
  DET_CRABP1: `${Number.parseFloat(CRABP1) - Number.parseFloat(GAPDH)}`
});
