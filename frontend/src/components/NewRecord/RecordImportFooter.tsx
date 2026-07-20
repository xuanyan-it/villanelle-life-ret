import { UploadOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import {
  Button,
  Divider,
  Flex,
  Space,
  Typography,
  Upload,
} from "antd";
import type { TFunction } from "i18next";
import React from "react";
type Props = {
  t: TFunction;
  onCancel: () => void;
  onSubmit: () => void;
  onDownloadTemplate: () => void;
  onBeforeUpload: UploadProps["beforeUpload"];
  onRemove: UploadProps["onRemove"];
  disableSubmit: boolean;
  submitLoading: boolean;
};
const RecordImportFooter: React.FC<Props> = ({
  t,
  onCancel,
  onSubmit,
  onDownloadTemplate,
  onBeforeUpload,
  onRemove,
  disableSubmit,
  submitLoading,
}) => {
  const noopUploadRequest: UploadProps["customRequest"] = ({ onSuccess }) => {
    if (onSuccess) {
      onSuccess("ok");
    }
  };
  return (
    <Flex justify="space-between" wrap>
      <Space wrap>
        <Upload
          listType="text"
          maxCount={1}
          accept=".csv"
          customRequest={noopUploadRequest}
          beforeUpload={onBeforeUpload}
          onRemove={onRemove}
          showUploadList={false}
        >
          <Button key="selectFile" icon={<UploadOutlined />}>
            {t("newRecord_importMany_uploadButton")}
          </Button>
        </Upload>
        <Typography.Link
          style={{ fontSize: 12 }}
          onClick={onDownloadTemplate}
          data-testid="download-template-link"
        >
          {t("newRecord_importMany_csvTemplate")}
        </Typography.Link>
      </Space>
      <Space wrap split={<Divider type="vertical" />}>
        <Button key="cancelImport" type="default" onClick={onCancel}>
          {t("newRecord_cancel")}
        </Button>
        <Button
          key="confirmImport"
          type="primary"
          disabled={disableSubmit}
          loading={submitLoading}
          onClick={onSubmit}
        >
          {t("newRecord_submit")}
        </Button>
      </Space>
    </Flex>
  );
};
export default RecordImportFooter;
