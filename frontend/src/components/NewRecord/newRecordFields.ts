import type { TFunction } from "i18next";
import { Gender } from "../../types";
import type { SampleRecordFormItems } from "./newRecordTypes";
export const buildSampleRecordFormItems = (
  t: TFunction
): SampleRecordFormItems => ({
  /* sample source required*/
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
  samplingDate: {
    name: "samplingDate",
    label: t("newRecord_sampleSource_samplingDate"),
  },
  receptionDate: {
    name: "receptionDate",
    label: t("newRecord_sampleSource_receptionDate"),
  },
  /* analysis options */
  modelType: {
    name: "modelType",
    label: t("newRecord_modelType"),
  },
  generateHeatmap: {
    name: "generateHeatmap",
    label: t("newRecord_generateHeatmap"),
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
