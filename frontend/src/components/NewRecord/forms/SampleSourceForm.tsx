import { InboxOutlined } from "@ant-design/icons";
import type { FormInstance, FormProps, UploadProps } from "antd";
import { Button, DatePicker, Flex, Form, Input, Radio, Upload } from "antd";
import dayjs from "dayjs";
import type { TFunction } from "i18next";
import React from "react";
import { Gender } from "../../../types";
import type { SampleRecordFormItems } from "../newRecordTypes";

type Props = {
  form: FormInstance;
  formItemLayout: { labelCol: FormProps["labelCol"]; wrapperCol: FormProps["wrapperCol"] };
  items: SampleRecordFormItems;
  onReset: () => void;
  onSubmit: () => void;
  t: TFunction;
};

const normalizeUpload: UploadProps["onChange"] extends (info: infer T) => void ? (event: T) => unknown : never =
  (event: any) => event?.fileList?.slice(-1) ?? [];

const SampleSourceForm: React.FC<Props> = ({ form, formItemLayout, items, onReset, onSubmit, t }) => (
  <Form
    name="newRetRecord"
    form={form}
    autoComplete="off"
    colon={false}
    requiredMark
    {...formItemLayout}
    style={{
      marginTop: 12,
      maxHeight: "calc(100vh - 210px)",
      overflowY: "auto",
      overflowX: "hidden",
      paddingRight: 12,
    }}
  >
    <Form.Item
      name="slideFile"
      label={t("newRecord_slideFile")}
      labelAlign="left"
      valuePropName="fileList"
      getValueFromEvent={normalizeUpload}
      rules={[{ required: true, message: t("newRecord_slideFile_required") }]}
    >
      <Upload.Dragger
        accept=".svs"
        maxCount={1}
        multiple={false}
        beforeUpload={(file) => file.name.toLowerCase().endsWith(".svs") ? false : Upload.LIST_IGNORE}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p>{t("newRecord_slideFile_drag")}</p>
        <p className="ant-upload-hint">{t("newRecord_slideFile_hint")}</p>
      </Upload.Dragger>
    </Form.Item>
    <Form.Item name={items.patientGender.name} label={items.patientGender.label} labelAlign="left">
      <Radio.Group optionType="button" buttonStyle="solid" block>
        <Radio value={Gender.Male}>{t("newRecord_sampleSource_patientGender_male")}</Radio>
        <Radio value={Gender.Female}>{t("newRecord_sampleSource_patientGender_female")}</Radio>
      </Radio.Group>
    </Form.Item>
    <Form.Item
      name={items.samplingDate.name}
      label={items.samplingDate.label}
      labelAlign="left"
      dependencies={[items.receptionDate.name]}
      rules={[({ getFieldValue }) => ({
        validator(_, value) {
          if (!value) return Promise.resolve();
          if (dayjs(value).isAfter(getFieldValue(items.receptionDate.name))) return Promise.reject(new Error(t("newRecord_sampleSource_samplingDate_warning_laterThanReceptionDate")));
          if (dayjs(value).isAfter()) return Promise.reject(new Error(t("newRecord_sampleSource_samplingDate_warning_laterThanToday")));
          return Promise.resolve();
        },
      })]}
    ><DatePicker allowClear format="YYYY/MM/DD" style={{ width: "100%" }} /></Form.Item>
    <Form.Item
      name={items.receptionDate.name}
      label={items.receptionDate.label}
      labelAlign="left"
      dependencies={[items.samplingDate.name]}
      rules={[({ getFieldValue }) => ({
        validator(_, value) {
          if (!value) return Promise.resolve();
          if (dayjs(value).isBefore(getFieldValue(items.samplingDate.name))) return Promise.reject(new Error(t("newRecord_sampleSource_receptionDate_warning_earlierThanSamplingDate")));
          if (dayjs(value).isAfter()) return Promise.reject(new Error(t("newRecord_sampleSource_receptionDate_warning_laterThanToday")));
          return Promise.resolve();
        },
      })]}
    ><DatePicker allowClear format="YYYY/MM/DD" style={{ width: "100%" }} /></Form.Item>
    <Form.Item name={items.doctorName.name} label={items.doctorName.label} labelAlign="left">
      <Input allowClear placeholder={t("newRecord_placeholder_optional")} maxLength={30} />
    </Form.Item>
    <Form.Item name={items.patientName.name} label={items.patientName.label} labelAlign="left">
      <Input allowClear placeholder={t("newRecord_placeholder_optional")} maxLength={30} />
    </Form.Item>
    <Form.Item name={items.patientAge.name} label={items.patientAge.label} labelAlign="left" rules={[{
      validator: (_, value: string) => !value || /^\d{1,3}$/.test(value)
        ? Promise.resolve()
        : Promise.reject(new Error(t("newRecord_sampleSource_patientAge_warning_format"))),
    }]}>
      <Input allowClear placeholder={t("newRecord_placeholder_optional")} maxLength={3} />
    </Form.Item>
    <Form.Item name={items.modelType.name} label={items.modelType.label} labelAlign="left" rules={[{ required: true }]}>
      <Radio.Group optionType="button" buttonStyle="solid">
        <Radio.Button value="2class">{t("newRecord_modelType_2class")}</Radio.Button>
        <Radio.Button value="3class">{t("newRecord_modelType_3class")}</Radio.Button>
        <Radio.Button value="5class">{t("newRecord_modelType_5class")}</Radio.Button>
      </Radio.Group>
    </Form.Item>
    <Form.Item name={items.generateHeatmap.name} label={items.generateHeatmap.label} labelAlign="left" valuePropName="checked">
      <Radio.Group optionType="button" buttonStyle="solid">
        <Radio.Button value={false}>{t("newRecord_generateHeatmap_no")}</Radio.Button>
        <Radio.Button value={true}>{t("newRecord_generateHeatmap_yes")}</Radio.Button>
      </Radio.Group>
    </Form.Item>
    <Form.Item name={items.otherInfo.name} label={items.otherInfo.label} labelAlign="left">
      <Input.TextArea maxLength={200} showCount placeholder={t("newRecord_placeholder_optional")} />
    </Form.Item>
    <Form.Item>
      <Flex justify="space-between">
        <Button danger onClick={onReset}>{t("newRecord_reset")}</Button>
        <Button type="primary" onClick={onSubmit}>{t("newRecord_next")}</Button>
      </Flex>
    </Form.Item>
  </Form>
);

export default SampleSourceForm;
