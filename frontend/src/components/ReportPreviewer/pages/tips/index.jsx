import { StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";
import Indentation from "../../components/Indentation";
import PageFooter from "../../components/PageFooter";
import PageHeader from "../../components/PageHeader";
import SignificanceContent from "./content.json";
const styles = StyleSheet.create({
  title: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 600,
    fontSize: 18,
    marginTop: 20,
  },
  line: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 200,
    fontSize: 10,
    marginTop: 8,
  },
  citationline: {
    width: "100%",
    fontFamily: "HanSansSC",
    fontWeight: 200,
    fontSize: 8,
    marginTop: 4,
  },
});
const Tips = (props) => {
  const lang = props.lang;
  const content = SignificanceContent[lang];
  return (
    <>
      <PageHeader title={content.page_title} />
      <Block content={content} />
      <PageFooter />
    </>
  );
};
export default Tips;
const Block = (props) => {
  const { content, lang } = props;
  return (
    <View>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p1l1}
      </Text>
      <Text style={styles.line}>{content.p1l2}</Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p3l1}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p3b1l1}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文1. "}
        />
        {content.p3b1l2}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p3b2l1}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文2. "}
        />
        {content.p3b2l2}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p3b3}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p3b4}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p4l1}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p4b1l1}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文1. "}
        />
        {content.p4b1l2}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p4b2}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p4b3l1}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文3. "}
        />
        {content.p4b3l2}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p4b4}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p4b5}
      </Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.p5l1}
      </Text>
      <Text style={styles.line}>{content.p5l2}</Text>
      <Text style={styles.title}>{content.reference_title}</Text>
      <Text style={styles.citationline}>{content.reference_1}</Text>
      <Text style={styles.citationline}>{content.reference_2}</Text>
      <Text style={styles.citationline}>{content.reference_3l1}</Text>
      <Text style={styles.citationline}>
        <Indentation
          defaultStyle={styles.citationline}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"3. "}
        />
        {content.reference_3l2}
      </Text>
      <Text style={styles.citationline}>
        <Indentation
          defaultStyle={styles.citationline}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"3. "}
        />
        {content.reference_3l3}
      </Text>
      <Text style={styles.citationline}>{content.reference_4l1}</Text>
      <Text style={styles.citationline}>
        <Indentation
          defaultStyle={styles.citationline}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"4. "}
        />
        {content.reference_4l2}
      </Text>
      <Text style={styles.citationline}>{content.reference_5l1}</Text>
      <Text style={styles.citationline}>
        <Indentation
          defaultStyle={styles.citationline}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"5. "}
        />
        {content.reference_5l2}
      </Text>
      <Text style={styles.citationline}>{content.reference_6l1}</Text>
      <Text style={styles.citationline}>
        <Indentation
          defaultStyle={styles.citationline}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"6. "}
        />
        {content.reference_6l2}
      </Text>
      <Text style={styles.citationline}>{content.reference_7}</Text>
      <Text style={styles.citationline}>{content.reference_8l1}</Text>
      <Text style={styles.citationline}>
        <Indentation
          defaultStyle={styles.citationline}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"8. "}
        />
        {content.reference_8l2}
      </Text>
    </View>
  );
};
