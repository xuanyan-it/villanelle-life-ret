import type { FormProps } from "antd";
import { Flex, Form, Typography } from "antd";
import React from "react";
import { ellipsisText } from "../../utils/ellipsisText";
type Props = {
  filename: string;
  formItemLayout: {
    labelCol: FormProps["labelCol"];
    wrapperCol: FormProps["wrapperCol"];
  };
};
const RecordImportBody: React.FC<Props> = ({ filename, formItemLayout }) => {
  if (!filename) {
    return null;
  }
  return (
    <Form {...formItemLayout} autoComplete="off">
      <Form.Item colon={false} labelAlign="left">
        <Flex justify="space-between" wrap>
          <Typography.Text
            ellipsis={{
              suffix: ellipsisText(filename, 12).suffix,
            }}
            style={{ maxWidth: "60%" }}
          >
            {ellipsisText(filename, 12).prefix}
          </Typography.Text>
        </Flex>
      </Form.Item>
    </Form>
  );
};
export default RecordImportBody;
