import type { FormInstance } from "antd";
import type { FormProps } from "antd";
import { Button, DatePicker, Flex, Form, Input, Radio } from "antd";
import dayjs from "dayjs";
import type { TFunction } from "i18next";
import React from "react";
import { Gender, SampleType } from "../../../types";
import type {
  QualityControlType,
  SampleRecordFormItems,
} from "../newRecordTypes";
import { getSampleIdPrefix } from "../newRecordUtils";
type Props = {
  form: FormInstance;
  formItemLayout: {
    labelCol: FormProps["labelCol"];
    wrapperCol: FormProps["wrapperCol"];
  };
  items: SampleRecordFormItems;
  watchedSampleType: SampleType | "";
  qualityControlType: QualityControlType;
  setQualityControlType: React.Dispatch<React.SetStateAction<QualityControlType>>;
  onReset: () => void;
  onNext: () => void;
  t: TFunction;
};
const SampleSourceForm: React.FC<Props> = ({
  form,
  formItemLayout,
  items,
  watchedSampleType,
  qualityControlType,
  setQualityControlType,
  onReset,
  onNext,
  t,
}) => {
  const sampleIdPrefix = getSampleIdPrefix(watchedSampleType, qualityControlType);
  const isQualityControl = watchedSampleType === SampleType.QualityContral;
  return (
    <Form
      name="sampleSource"
      form={form}
      autoComplete="off"
      colon={false}
      requiredMark
      {...formItemLayout}
      style={{ marginTop: 20 }}
    >
      <Form.Item
        name={items.sampleType.name}
        label={items.sampleType.label}
        labelAlign="left"
        getValueProps={(value) => {
          if (value === SampleType.Regular) {
            return { value: "regular" };
          }
          if (value === SampleType.QualityContral) {
            return {
              value: qualityControlType === "negative" ? "qc_negative" : "qc_positive",
            };
          }
          return { value: undefined };
        }}
        getValueFromEvent={(event) => {
          const next = event.target.value as
            | "regular"
            | "qc_positive"
            | "qc_negative";
          if (next === "regular") {
            return SampleType.Regular;
          }
          return SampleType.QualityContral;
        }}
        rules={[
          {
            required: true,
            message: t("newRecord_sampleSource_sampleType_warning_empty"),
          },
        ]}
      >
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          block
          onChange={(event) => {
            const next = event.target.value as
              | "regular"
              | "qc_positive"
              | "qc_negative";
            if (next === "qc_negative") {
              setQualityControlType("negative");
            }
            if (next === "qc_positive") {
              setQualityControlType("positive");
            }
          }}
        >
          <Radio value="regular">
            {t("newRecord_sampleSource_sampleType_regular")}
          </Radio>
          <Radio value="qc_positive">
            {t("newRecord_sampleSource_sampleType_qualityControl_positive")}
          </Radio>
          <Radio value="qc_negative">
            {t("newRecord_sampleSource_sampleType_qualityControl_negative")}
          </Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item
        name={items.sampleId.name}
        label={items.sampleId.label}
        labelAlign="left"
        tooltip={t("newRecord_sampleSource_sampleId_toolTip")}
        normalize={(value) =>
          typeof value === "string" ? value.replace(/^(TT-|PQ-|NQ-)/i, "") : value
        }
        rules={[
          {
            required: true,
            message: t("newRecord_sampleSource_sampleId_warning"),
          },
          {
            max: 30,
            message: t("newRecord_sampleSource_sampleId_warning_max"),
          },
        ]}
      >
        <Input allowClear addonBefore={sampleIdPrefix} maxLength={30} autoComplete="off" />
      </Form.Item>
      <Form.Item
        name={items.patientGender.name}
        label={items.patientGender.label}
        labelAlign="left"
        rules={[
          {
            required: !isQualityControl,
            message: t("newRecord_sampleSource_patientGender_warning"),
          },
        ]}
      >
        <Radio.Group optionType="button" buttonStyle="solid" block disabled={isQualityControl}>
          <Radio value={Gender.Male}>
            {t("newRecord_sampleSource_patientGender_male")}
          </Radio>
          <Radio value={Gender.Female}>
            {t("newRecord_sampleSource_patientGender_female")}
          </Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item
        name={items.samplingDate.name}
        label={items.samplingDate.label}
        labelAlign="left"
        dependencies={[items.receptionDate.name]}
        rules={[
          {
            required: !isQualityControl,
            message: t("newRecord_sampleSource_samplingDate_warning_empty"),
          },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (isQualityControl || !value) {
                return Promise.resolve();
              }
              if (dayjs(value).isAfter(getFieldValue(items.receptionDate.name))) {
                return Promise.reject(
                  new Error(
                    t(
                      "newRecord_sampleSource_samplingDate_warning_laterThanReceptionDate"
                    )
                  )
                );
              }
              if (dayjs(value).isAfter()) {
                return Promise.reject(
                  new Error(
                    t("newRecord_sampleSource_samplingDate_warning_laterThanToday")
                  )
                );
              }
              return Promise.resolve();
            },
          }),
        ]}
      >
        <DatePicker allowClear format="YYYY/MM/DD" disabled={isQualityControl} />
      </Form.Item>
      <Form.Item
        name={items.receptionDate.name}
        label={items.receptionDate.label}
        labelAlign="left"
        dependencies={[items.samplingDate.name]}
        rules={[
          {
            required: !isQualityControl,
            message: t("newRecord_sampleSource_receptionDate_warning_empty"),
          },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (isQualityControl || !value) {
                return Promise.resolve();
              }
              if (dayjs(value).isBefore(getFieldValue(items.samplingDate.name))) {
                return Promise.reject(
                  new Error(
                    t(
                      "newRecord_sampleSource_receptionDate_warning_earlierThanSamplingDate"
                    )
                  )
                );
              }
              if (dayjs(value).isAfter()) {
                return Promise.reject(
                  new Error(
                    t("newRecord_sampleSource_receptionDate_warning_laterThanToday")
                  )
                );
              }
              return Promise.resolve();
            },
          }),
        ]}
      >
        <DatePicker allowClear format="YYYY/MM/DD" disabled={isQualityControl} />
      </Form.Item>
      <Form.Item
        name={items.doctorName.name}
        label={items.doctorName.label}
        labelAlign="left"
        rules={[
          {
            max: 8,
            message: t("newRecord_sampleSource_doctorName_warning_max"),
          },
        ]}
      >
        <Input allowClear placeholder={t("newRecord_placeholder_optional")} maxLength={8} autoComplete="off" />
      </Form.Item>
      <Form.Item
        name={items.patientName.name}
        label={items.patientName.label}
        labelAlign="left"
        rules={[
          {
            max: 8,
            message: t("newRecord_sampleSource_patientName_warning_max"),
          },
        ]}
      >
        <Input allowClear placeholder={t("newRecord_placeholder_optional")} maxLength={8} autoComplete="off" />
      </Form.Item>
      <Form.Item
        name={items.patientAge.name}
        label={items.patientAge.label}
        labelAlign="left"
        rules={[
          {
            validator: (_, value: string) => {
              if (!value) {
                return Promise.resolve();
              }
              if (/^\d{1,4}$/.test(value)) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(t("newRecord_sampleSource_patientAge_warning_format"))
              );
            },
          },
        ]}
      >
        <Input allowClear placeholder={t("newRecord_placeholder_optional")} maxLength={4} autoComplete="off" />
      </Form.Item>
      <Form.Item>
        <Flex justify="space-between">
          <Button danger onClick={onReset}>
            {t("newRecord_reset")}
          </Button>
          <Button type="primary" onClick={onNext}>
            {t("newRecord_next")}
          </Button>
        </Flex>
      </Form.Item>
    </Form>
  );
};
export default SampleSourceForm;
