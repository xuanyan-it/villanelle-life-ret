import { StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";
import { getResultKind } from "../../../RecordTable/recordTable.logic";
import Indentation from "../../components/Indentation";
import PageFooter from "../../components/PageFooter";
import PageHeader from "../../components/PageHeader";
import DiagnosisContent from "./content.json";
const styles = StyleSheet.create({
  taskDescriptionBlock: {
    marginTop: 5,
    paddingTop: 10,
  },
  diagnosisBlock: {
    marginTop: 10,
    paddingTop: 10,
  },
  diagnosisDetailContainer: {
    width: "100%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  tableContainer: {
    width: "100%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
  },
  tablecolumn: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  tableCell: {
    alignItems: "center",
    header: {
      height: "24px",
      paddingTop: 2,
      paddingBottom: 2,
      backgroundColor: "#156082",
      color: "#fff",
      fontWeight: 200,
      fontSize: 12,
      textAlign: "center",
      justifyContent: "center",
      alignItems: "center",
    },
    light: {
      display: "flex",
      flexDirection: "column",
      height: "24px",
      backgroundColor: "#E7EAED",
      fontWeight: 200,
      fontSize: 10,
      justifyContent: "center",
      textAlign: "center",
    },
    dark: {
      display: "flex",
      flexDirection: "column",
      height: "24px",
      backgroundColor: "#CCD2D8",
      fontWeight: 200,
      fontSize: 10,
      textAlign: "center",
      justifyContent: "center",
    },
    merged: {
      height: "96px",
      backgroundColor: "#E7EAED",
      fontWeight: 600,
      fontSize: 10,
      justifyContent: "center",
      textAlign: "center",
    },
  },
  footnote: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 200,
    fontSize: 8,
    textAlign: "right",
  },
  disclaimerBlock: {
    marginTop: 10,
    paddingTop: 10,
  },
  title: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 600,
    fontSize: 18,
    marginTop: 16,
    marginBottom: 12,
  },
  subTitle: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 600,
    fontSize: 12,
    marginVertical: 6,
  },
  line: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 200,
    fontSize: 10,
    marginTop: 4,
  },
  siginatureBlock: {
    position: "absolute",
    left: 30,
    bottom: 36,
    fontSize: 10,
  },
  infoBlock: {
    height: 20,
    marginTop: 5,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoText: {
    width: "30%",
    fontFamily: "HanSansSC",
    fontWeight: 600,
    fontSize: 10,
  },
  mutationTestTableCellHeight: {
    height: "80px",
  },
});
const formatCt = (value) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
};
const Diagnosis = (props) => {
  const lang = props.lang;
  const content = DiagnosisContent[lang];
  return (
    <>
      <PageHeader title={content.testResult_title} />
      <DiagnosisBlock record={props.record} content={content} />
      <DisclaimerBlock content={content} />
      <TestInfomationBlock
        record={props.record}
        lang={lang}
        content={content}
      />
      <PageFooter />
    </>
  );
};
export default Diagnosis;
const DiagnosisBlock = (props) => {
  const { record, content } = props;
  const resultKind = getResultKind(record.result);
  const resultText =
    resultKind === "negative"
      ? content.testResult_negative
      : resultKind === "positive"
        ? content.testResult_positive
        : resultKind === "borderline"
          ? content.testResult_borderline
          : content.testResult_unavailable;
  const resultColor =
    resultKind === "negative"
      ? "green"
      : resultKind === "positive"
        ? "red"
        : resultKind === "borderline"
          ? "#d48806"
          : "#666";
  return (
    <View style={styles.diagnosisBlock}>
      
      <View style={styles.diagnosisDetailContainer}>
        <View style={styles.tableContainer}>
          <View style={{ ...styles.tablecolumn, width: "20%" }}>
            <View style={styles.tableCell.header}>
              <Text>{content.testResult_testGene}</Text>
            </View>
            <View style={styles.tableCell.dark}>
              <Text>{content.testResult_RPS4Y1}</Text>
            </View>
            <View style={styles.tableCell.light}>
              <Text>{content.testResult_PKHD1L1}</Text>
            </View>
            <View style={styles.tableCell.dark}>
              <Text>{content.testResult_CRABP1}</Text>
            </View>
            <View style={styles.tableCell.light}>
              <Text>{content.testResult_GAPDH}</Text>
            </View>
          </View>
          <View style={{ ...styles.tablecolumn, width: "20%" }}>
            <View style={styles.tableCell.header}>
              <Text>{content.testResult_ctValue}</Text>
            </View>
            <View style={styles.tableCell.dark}>
              <Text>{formatCt(record.RPS4Y1)}</Text>
            </View>
            <View style={styles.tableCell.light}>
              <Text>{formatCt(record.PKHD1L1)}</Text>
            </View>
            <View style={styles.tableCell.dark}>
              <Text>{formatCt(record.CRABP1)}</Text>
            </View>
            <View style={styles.tableCell.light}>
              <Text>{formatCt(record.GAPDH)}</Text>
            </View>
          </View>
          <View style={{ ...styles.tablecolumn, width: "20%" }}>
            <View style={styles.tableCell.header}>
              <Text>{content.testResult_deltaCtValue}</Text>
            </View>
            <View style={styles.tableCell.dark}>
              <Text>
                {(parseFloat(record.RPS4Y1) - parseFloat(record.GAPDH))
                  .toFixed(2)
                  .toString()}
              </Text>
            </View>
            <View style={styles.tableCell.light}>
              <Text>
                {(parseFloat(record.PKHD1L1) - parseFloat(record.GAPDH))
                  .toFixed(2)
                  .toString()}
              </Text>
            </View>
            <View style={styles.tableCell.dark}>
              <Text>
                {(parseFloat(record.CRABP1) - parseFloat(record.GAPDH))
                  .toFixed(2)
                  .toString()}
              </Text>
            </View>
            <View style={styles.tableCell.light}>
              <Text>/</Text>
            </View>
          </View>
          <View style={{ ...styles.tablecolumn, width: "40%" }}>
            <View style={styles.tableCell.header}>
              <Text>{content.testResult_testResult}</Text>
            </View>
            <View style={styles.tableCell.merged}>
              <Text style={{ fontWeight: 600, color: resultColor }}>
                {resultText}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.footnote}>
        <Text>{content.testResult_footnote}</Text>
      </View>
    </View>
  );
};
const DisclaimerBlock = (props) => {
  const { content } = props;
  return (
    <View>
      <Text style={styles.title}>{content.disclaimerTitle}</Text>
      <Text style={styles.line}>{content.disclaimer_p1l1}</Text>
      <Text style={styles.line}>{content.disclaimer_p2l1}</Text>
      <Text style={styles.line}>
        <Indentation defaultStyle={styles.line} placeholder={"ע 2��"} />
        {content.disclaimer_p2l2}
      </Text>
      <Text style={styles.line}>
        <Indentation defaultStyle={styles.line} placeholder={"ע 2��"} />
        {content.disclaimer_p2l3}
      </Text>
      <Text style={styles.line}>{content.disclaimer_p3l1}</Text>
      <Text style={styles.line}>{content.disclaimer_p4l1}</Text>
      <Text style={styles.line}>
        <Indentation defaultStyle={styles.line} placeholder={"ע 4��"} />
        {content.disclaimer_p4l2}
      </Text>
    </View>
  );
};
const TestInfomationBlock = (props) => {
  const { record, content } = props;
  return (
    <View style={styles.siginatureBlock}>
      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>
          {content.tester}
          {record.testerName}
        </Text>
        <Text style={styles.infoText}>
          {content.reviewer} {record.reviewerName}
        </Text>
        <Text style={{ ...styles.infoText, fontWeight: 200, fontSize: 10 }}>
          {content.signAndStamp}
        </Text>
      </View>
      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>
          {content.testDate + record.testDate.substring(0, 10)}
        </Text>
        <Text style={styles.infoText}>
          {content.reportDate + new Date().toISOString().substring(0, 10)}
        </Text>
        <Text style={styles.infoText}></Text>
      </View>
    </View>
  );
};
