import type { FormInstance } from "antd";
import type { FormProps } from "antd";
import { Button, Divider, Flex, Form, Input } from "antd";
import type { TFunction } from "i18next";
import React from "react";
import { isValid2DecimalFloat } from "../../../utils/formatHelper";
import type { SampleRecordFormItems } from "../newRecordTypes";
type Props = {
  form: FormInstance;
  formItemLayout: {
    labelCol: FormProps["labelCol"];
    wrapperCol: FormProps["wrapperCol"];
  };
  items: SampleRecordFormItems;
  username: string;
  onReset: () => void;
  onPrevious: () => void;
  onNext: () => void;
  t: TFunction;
};
const GeneInfoForm: React.FC<Props> = ({
  form,
  formItemLayout,
  items,
  username,
  onReset,
  onPrevious,
  onNext,
  t,
}) => {
  return (
    <Form
      name="geneInfo"
      form={form}
      autoComplete="off"
      style={{ marginTop: 20 }}
      {...formItemLayout}
      colon={false}
      initialValues={{
        testerName: username,
      }}
    >
      <Form.Item
        name={items.RPS4Y1.name}
        label={items.RPS4Y1.label}
        labelAlign="left"
        rules={[
          {
            required: true,
            message: t("newRecord_geneInfo_RPS4Y1_warning_empty"),
          },
          ({ getFieldValue }) => ({
            validator(_, value: string) {
              if (
                !value ||
                isValid2DecimalFloat(getFieldValue(items.RPS4Y1.name))
              ) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(t("newRecord_geneInfo_RPS4Y1_warning_wrongFormat"))
              );
            },
          }),
        ]}
      >
        <Input allowClear autoComplete="off" />
      </Form.Item>
      <Form.Item
        name={items.PKHD1L1.name}
        label={items.PKHD1L1.label}
        labelAlign="left"
        rules={[
          {
            required: true,
            message: t("newRecord_geneInfo_PKHD1L1_warning_empty"),
          },
          () => ({
            validator(_, value: string) {
              if (!value || isValid2DecimalFloat(value)) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(t("newRecord_geneInfo_PKHD1L1_warning_wrongFormat"))
              );
            },
          }),
        ]}
      >
        <Input allowClear autoComplete="off" />
      </Form.Item>
      <Form.Item
        name={items.CRABP1.name}
        label={items.CRABP1.label}
        labelAlign="left"
        rules={[
          {
            required: true,
            message: t("newRecord_geneInfo_CRABP1_warning_empty"),
          },
          ({ getFieldValue }) => ({
            validator(_, value: string) {
              if (!value || isValid2DecimalFloat(getFieldValue(items.CRABP1.name))) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(t("newRecord_geneInfo_CRABP1_warning_wrongFormat"))
              );
            },
          }),
        ]}
      >
        <Input allowClear autoComplete="off" />
      </Form.Item>
      <Form.Item
        name={items.GAPDH.name}
        label={items.GAPDH.label}
        labelAlign="left"
        rules={[
          {
            required: true,
            message: t("newRecord_geneInfo_GAPDH_warning_empty"),
          },
          ({ getFieldValue }) => ({
            validator(_, value: string) {
              if (!value || isValid2DecimalFloat(getFieldValue(items.GAPDH.name))) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(t("newRecord_geneInfo_GAPDH_warning_wrongFormat"))
              );
            },
          }),
        ]}
      >
        <Input allowClear autoComplete="off" />
      </Form.Item>
      <Form.Item name={items.testerName.name} hidden>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item>
        <Flex justify="space-between">
          <Button danger onClick={onReset}>
            {t("newRecord_reset")}
          </Button>
          <Flex justify="flex-end">
            <Button type="default" onClick={onPrevious}>
              {t("newRecord_previous")}
            </Button>
            <Divider type="vertical" style={{ alignSelf: "center" }} />
            <Button type="primary" onClick={onNext}>
              {t("newRecord_next")}
            </Button>
          </Flex>
        </Flex>
      </Form.Item>
    </Form>
  );
};
export default GeneInfoForm;
