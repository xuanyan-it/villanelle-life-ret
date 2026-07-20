import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import PageFooter from "../../components/PageFooter";
import PageHeader from "../../components/PageHeader";
import Procedure from "../../image/procedure.png";
import InfoContent from "./content.json";
const styles = StyleSheet.create({
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
    fontWeight: 200,
    fontSize: 10,
  },
  diagnosisBlock: {
    marginTop: 10,
    paddingTop: 10,
  },
  testerInformationBlock: {
    height: 100,
    columnContainer: {
      height: "100%",
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    column: {
      height: "100%",
      width: "20%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-evenly",
      alignItems: "flex-start",
      fontSize: 12,
      color: "#000",
      fontFamily: "HanSansSC",
      fontWeight: 600,
    },
  },
  title: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 600,
    fontSize: 18,
    marginVertical: 20,
  },
  line: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 200,
    fontSize: 10,
    marginTop: 6,
    lineHeight: 1.6,
    textAlign: "left",
    wordSpacing: 0,
  },
});

const formatPatientField = (value, missingText = "（无）") => {
  if (value === null || value === undefined) {
    return missingText;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === "n/a") {
      return missingText;
    }
    return trimmed;
  }

  return String(value);
};

const Info = (props) => {
  const lang = props.lang;
  const content = InfoContent[lang];
  return (
    <>
      <PageHeader title={content.page_title} />
      <InfomationBlock record={props.record} lang={lang} content={content} />
      <TaskDescriptionBlock
        record={props.record}
        lang={lang}
        content={content}
      />
      <PageFooter />
    </>
  );
};
export default Info;
const InfomationBlock = (props) => {
  const {
    record,
    content,
  } = props;
  const missingText = content.common_missingValue || "（无）";
  return (
    <View>
      <Text style={styles.title}>{content.sampleInfo_title}</Text>
      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>
          {content.sampleInfo_sampleId}
          {record.sampleId}
        </Text>
        <Text style={styles.infoText}>
          {content.sampleInfo_sampleType}
          {record.sampleType === "q"
            ? record.sampleId?.toUpperCase().startsWith("NQ-")
              ? content.sampleInfo_sampleType_qualityControl_negative
              : content.sampleInfo_sampleType_qualityControl_positive
            : content.sampleInfo_sampleType_regular}
        </Text>
        <Text style={styles.infoText}>
          {content.hostpitalInfo_hospitalName}
          {record.hospitalName}
        </Text>
      </View>
      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>
          {content.sampleInfo_patientGender}
          {record.patientGender === "n/a"
            ? "-"
            : record.patientGender === "m"
              ? "男"
              : "女"}
        </Text>
        <Text style={styles.infoText}>
          {content.sampleInfo_patientName}
          {formatPatientField(record.patientName, missingText)}
        </Text>
        <Text style={styles.infoText}>
          {content.sampleInfo_patientAge}
          {formatPatientField(record.patientAge, missingText)}
        </Text>
      </View>
      <View style={styles.infoBlock}>
        <Text style={styles.infoText}>
          {content.sampleInfo_samplingTimestamp}
          {record.samplingDate.substring(0, 10)}
        </Text>
        <Text style={styles.infoText}>
          {content.sampleInfo_receptionTimestamp}
          {record.receptionDate.substring(0, 10)}
        </Text>
        <Text style={styles.infoText}>
          {content.sampleInfo_testTimestamp}
          {record.testDate.substring(0, 10)}
        </Text>
      </View>
      <View
        style={{
          ...styles.infoBlock,
          justifyContent: "flex-start",
          marginRight: 10,
        }}
      >
        <Text style={{ ...styles.infoText, width: "100%" }}>
          {content.otherInfo}
          {formatPatientField(record.otherInfo, missingText)}
        </Text>
      </View>
    </View>
  );
};
const TaskDescriptionBlock = (props) => {
  const { content } = props;
  const descriptionLines = [
    content.testDescription_l1,
    content.testDescription_l2,
    content.testDescription_l3,
    content.testDescription_l4,
  ].filter((line) => typeof line === "string" && line.trim().length > 0);
  return (
    <View>
      <Text style={styles.title}>{content.testDescription_title}</Text>
      {descriptionLines.map((line, index) => (
        <Text key={`desc-${index}`} style={styles.line}>
          {line}
        </Text>
      ))}
      <Image src={Procedure} style={{ marginVertical: 20 }} />
      <Text style={styles.line}>{content.target}</Text>
      <Text style={styles.line}>{content.testMethod}</Text>
      <Text style={styles.line}>{content.testInstrument_l1}</Text>
    </View>
  );
};
