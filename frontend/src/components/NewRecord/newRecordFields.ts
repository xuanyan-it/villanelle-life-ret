import type { TFunction } from "i18next";
import { Gender, SampleType } from "../../types";
import type { SampleRecordFormItems } from "./newRecordTypes";
export const buildSampleRecordFormItems = (
  t: TFunction
): SampleRecordFormItems => ({
  /* sample source required*/
  sampleId: {
    name: "sampleId",
    label: t("newRecord_sampleSource_sampleId"),
  },
  patientGender: {
    name: "patientGender",
    label: t("newRecord_sampleSource_patientGender"),
    valuePresentation: {
      [`${Gender.Male}`]: t("newRecord_sampleSource_patientGender_male"),
      [`${Gender.Female}`]: t("newRecord_sampleSource_patientGender_female"),
    },
  },
  doctorName: {
    name: "doctorName",
    label: t("newRecord_sampleSource_doctorName"),
  },
  patientName: {
    name: "patientName",
    label: t("newRecord_sampleSource_patientName"),
  },
  patientAge: {
    name: "patientAge",
    label: t("newRecord_sampleSource_patientAge"),
  },
  sampleType: {
    name: "sampleType",
    label: t("newRecord_sampleSource_sampleType"),
    valuePresentation: {
      [`${SampleType.Regular}`]: t("newRecord_sampleSource_sampleType_regular"),
    },
  },
  samplingDate: {
    name: "samplingDate",
    label: t("newRecord_sampleSource_samplingDate"),
  },
  receptionDate: {
    name: "receptionDate",
    label: t("newRecord_sampleSource_receptionDate"),
  },
  /* gene */
  RPS4Y1: {
    name: "RPS4Y1",
    label: t("newRecord_geneInfo_RPS4Y1"),
  },
  PKHD1L1: {
    name: "PKHD1L1",
    label: t("newRecord_geneInfo_PKHD1L1"),
  },
  CRABP1: {
    name: "CRABP1",
    label: t("newRecord_geneInfo_CRABP1"),
  },
  GAPDH: {
    name: "GAPDH",
    label: t("newRecord_geneInfo_GAPDH"),
  },
  /* review */
  testerName: {
    name: "testerName",
    label: t("newRecord_review_testerName"),
  },
  otherInfo: {
    name: "otherInfo",
    label: t("newRecord_review_otherInfo"),
  },
  checkConfirm: {
    name: "checkConfirm",
    label: t("newRecord_review_checkConfirm"),
  },
});
