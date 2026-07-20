import type { FormInstance } from "antd";
import type { FormProps } from "antd";
import { Button, Checkbox, Divider, Flex, Form, List, Typography } from "antd";
import TextArea from "antd/es/input/TextArea";
import dayjs from "dayjs";
import type { TFunction } from "i18next";
import React from "react";
import { SampleType } from "../../../types";
import type {
  FormFieldType,
  QualityControlType,
  SampleRecordFormItems,
} from "../newRecordTypes";
import { isNotAvailableValue, mergeSampleId } from "../newRecordUtils";
type Props = {
  form: FormInstance;
  formItemLayout: {
    labelCol: FormProps["labelCol"];
    wrapperCol: FormProps["wrapperCol"];
  };
  items: SampleRecordFormItems;
  formData: FormFieldType;
  qualityControlType: QualityControlType;
  onPrevious: () => void;
  onSubmit: () => void;
  t: TFunction;
};
const ReviewForm: React.FC<Props> = ({
  form,
  formItemLayout,
  items,
  formData,
  qualityControlType,
  onPrevious,
  onSubmit,
  t,
}) => {
  return (
    <Form
      name="reviewForm"
      form={form}
      autoComplete="off"
      style={{ marginTop: 20 }}
      {...formItemLayout}
      colon={false}
      initialValues={{ otherInfo: "" }}
    >
      <div
        style={{
          maxHeight: "200px",
          overflowY: "auto",
          marginBottom: "20px",
        }}
      >
        <List
          dataSource={Object.entries(formData)
            .filter(
              ([key]) => !["testerName", "otherInfo", "checkConfirm"].includes(key)
            )
            .map(([key, value]) => {
              if (key === "samplingDate" || key === "receptionDate") {
                if (!value || isNotAvailableValue(value)) {
                  return { title: key, value: "n/a" };
                }
                const parsed = dayjs(value);
                return {
                  title: key,
                  value: parsed.isValid() ? parsed.format("YYYY/MM/DD") : value,
                };
              }
              if (key === "sampleType") {
                if (value === SampleType.QualityContral) {
                  return {
                    title: key,
                    value:
                      qualityControlType === "negative"
                        ? t(
                            "newRecord_sampleSource_sampleType_qualityControl_negative"
                          )
                        : t(
                            "newRecord_sampleSource_sampleType_qualityControl_positive"
                          ),
                  };
                }
              }
              if (key === "sampleId") {
                const merged = mergeSampleId(
                  value as string,
                  formData.sampleType,
                  qualityControlType
                );
                return { title: key, value: merged };
              }
              return { title: key, value };
            })}
          renderItem={(item) => {
            const field = items[item.title];
            return (
              <List.Item
                style={{
                  backgroundColor: isNotAvailableValue(item.value) ? "" : "#f0f0f0",
                  paddingLeft: 20,
                  paddingRight: 20,
                }}
              >
                {field && (
                  <>
                    <List.Item.Meta title={items[item.title].label} />
                    {isNotAvailableValue(item.value) ? (
                      <Typography.Text disabled>
                        {t("newRecord_notAvailable")}
                      </Typography.Text>
                    ) : (
                      <Typography.Text strong>
                        {field.valuePresentation?.[item.value]
                          ? field.valuePresentation[item.value]
                          : item.value}
                      </Typography.Text>
                    )}
                  </>
                )}
              </List.Item>
            );
          }}
        />
      </div>
      <Form.Item
        name={items.otherInfo.name}
        label={items.otherInfo.label}
        labelAlign="left"
      >
        <TextArea
          maxLength={30}
          placeholder={t("newRecord_placeholder_optional")}
          count={{ show: true }}
          autoSize={{ minRows: 1, maxRows: 2 }}
          autoComplete="off"
        />
      </Form.Item>
      <Form.Item>
        <Form.Item
          name={items.checkConfirm.name}
          valuePropName="checked"
          noStyle
          rules={[
            {
              required: true,
              validator: (_, value: boolean) =>
                value
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(t("newRecord_review_checkConfirm_warning"))
                    ),
              message: t("newRecord_review_checkConfirm_warning"),
            },
          ]}
        >
          <Checkbox>
            <Typography.Text>{t("newRecord_review_checkConfirm")}</Typography.Text>
          </Checkbox>
        </Form.Item>
      </Form.Item>
      <Form.Item>
        <Flex justify="flex-end">
          <Button type="default" onClick={onPrevious}>
            {t("newRecord_previous")}
          </Button>
          <Divider type="vertical" style={{ alignSelf: "center" }} />
          <Button type="primary" onClick={onSubmit}>
            {t("newRecord_submit")}
          </Button>
        </Flex>
      </Form.Item>
    </Form>
  );
};
export default ReviewForm;
