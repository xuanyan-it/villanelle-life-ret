import { StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";
import PageFooter from "../../components/PageFooter";
import PageHeader from "../../components/PageHeader";
import Superscript from "../../components/Superscript";
import DescriptionContent from "./content.json";
const styles = StyleSheet.create({
  titleBlock: {
    height: 500,
    paddingTop: 10,
    title: {
      marginTop: 200,
      fontFamily: "HanSansSC",
      fontWeight: 600,
      fontSize: 22,
      color: "#37467a",
      marginLeft: 9,
    },
    subtitle: {
      marginTop: 20,
      marginLeft: 9,
      fontFamily: "HanSansSC",
      fontWeight: 600,
      fontSize: 24,
    },
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
  },
  line: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 200,
    fontSize: 10,
    marginTop: 8,
  },
});
const Cover = (props) => {
  const lang = props.lang;
  const content = DescriptionContent[lang];
  return (
    <>
      <PageHeader />
      <TitleBlock content={content} record={props.record} />
      <DisclaimerBlock content={content} />
      <PageFooter />
    </>
  );
};
export default Cover;
const TitleBlock = (props) => {
  const { content } = props;
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.titleBlock.title}>
        {content.productAbbrevName}
        <Superscript defaultstyle={{ ...styles.titleBlock.title }}>
          {content.productAbbrevName_TMSuperScript}
        </Superscript>
      </Text>
      <View style={styles.titleBlock.subtitle}>
        <Text>{content.productFullName}</Text>
      </View>
    </View>
  );
};
const DisclaimerBlock = (props) => {
  const { content } = props;
  return (
    <View style={styles.disclaimerBlock}>
      <Text style={styles.line}>{content.disclaimer_l1}</Text>
    </View>
  );
};
