import {
  Document,
  Font,
  Page,
  PDFViewer,
  StyleSheet,
  View,
} from "@react-pdf/renderer";
import { Select } from "antd";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { closeReportPreviewer } from "../../store/reportPreviewer";
import DraggableModal from "../DraggableModal";
import Cover from "./pages/cover";
import Diagnosis from "./pages/diagnosis";
import Info from "./pages/info";
import Significance from "./pages/significance";
import Tips from "./pages/tips";
Font.register({
  family: "HanSansSC",
  fonts: [
    { src: "fonts/NotoSansSC-ExtraBold.ttf", fontWeight: 800 },
    { src: "fonts/NotoSansSC-SemiBold.ttf", fontWeight: 600 },
    { src: "fonts/NotoSansSC-ExtraLight.ttf", fontWeight: 200 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
const styles = StyleSheet.create({
  document: {
    fontFamily: "HanSansSC",
  },
  reportContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  previewerContainer: {
    height: 600,
    width: "100%",
  },
  layoutContainer: {
    display: "flex",
    flexDirection: "column",
    padding: "10px 10px 16px 10px",
  },
});
const ReportLayout = (props) => {
  const { content } = props.item;
  return (
    <Page size="A4" style={styles.layoutContainer} renderTexlayer={false}>
      <View style={styles.reportContentContainer}>{content}</View>
    </Page>
  );
};
export const Doc = ({ record, locale }) => {
  const reportContents = [
    { content: <Cover record={record} lang={locale} pageId={1} /> },
    { content: <Info record={record} lang={locale} pageId={2} /> },
    {
      content: <Diagnosis record={record} lang={locale} pageId={3} />,
    },
    { content: <Significance lang={locale} pageId={4} /> },
    { content: <Tips lang={locale} pageId={5} /> },
  ];
  return (
    <Document style={styles.document}>
      {reportContents.map((item, index) => {
        return <ReportLayout key={index} item={item} lang={locale} />;
      })}
    </Document>
  );
};
const ReportPreviewer = () => {
  const [lang, setLang] = useState("zh");
  const languageOptions = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
  ];
  const handleLanguageChange = (value) => {
    setLang(value);
  };
  const reportPreviewerState = useSelector((state) => state.reportPreviewer);
  const { open, record } = reportPreviewerState;
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event) => {
      const key = event.key?.toLowerCase();
      if (
        event.key === "F5" ||
        ((event.ctrlKey || event.metaKey) && key === "r") ||
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          (key === "r" || event.key === "F5"))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [open]);
  const reportContents = [
    { content: <Cover record={record} lang={lang} pageId={1} /> },
    { content: <Info record={record} lang={lang} /> },
    {
      content: <Diagnosis record={record} lang={lang} />,
    },
    { content: <Significance lang={lang} /> },
    { content: <Tips lang={lang} /> },
  ];
  const MyDoc = () => {
    return (
      <Document style={styles.document}>
        {reportContents.map((item, index) => {
          return <ReportLayout key={index} item={item} lang={lang} />;
        })}
      </Document>
    );
  };
  const dispatch = useDispatch();
  const handleCancel = () => {
    dispatch(closeReportPreviewer());
  };
  const handleOk = () => {
    dispatch(closeReportPreviewer());
  };
  const { t } = useTranslation();
  return (
    <DraggableModal
      title={t("reportPreviewer_modalTitle")}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      width={880}
      height={800}
      centered
      footer={[
        <Select
          key="report-language-selector"
          defaultValue="zh"
          options={languageOptions}
          onChange={handleLanguageChange}
        />,
      ]}
      style={styles.previewerContainer}
      destroyOnHidden
    >
      <PDFViewer style={styles.previewerContainer} showToolbar={false}>
        <MyDoc />
      </PDFViewer>
      
    </DraggableModal>
  );
};
export default ReportPreviewer;
