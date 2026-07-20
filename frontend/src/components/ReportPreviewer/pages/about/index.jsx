import { StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";
import Indentation from "../../components/Indentation";
import PageFooter from "../../components/PageFooter";
import PageHeader from "../../components/PageHeader";
import AboutContent from "./content.json";
const styles = StyleSheet.create({
  sloganBlock: {
    height: 480,
    paddingTop: 140,
    textAlign: "center",
  },
  contactBlock: {},
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
const About = (props) => {
  const lang = props.lang;
  const content = AboutContent[lang];
  return (
    <>
      <PageHeader />
      <AboutBlock content={content} />
      <SloganBlock content={content} />
      <PageFooter />
    </>
  );
};
export default About;
const AboutBlock = (props) => {
  const { content } = props;
  return (
    <View>
      <Text style={styles.title}>{content.aboutTitle}</Text>
      <Text style={styles.line}>
        <Indentation defaultStyle={styles.line} placeholder={"中文"} />
        {content.about_p1l1}
      </Text>
      <Text style={styles.line}>
        <Indentation defaultStyle={styles.line} placeholder={"中文"} />
        {content.about_p1l2}
      </Text>
      <Text style={styles.line}>{content.about_p1l3}</Text>
      <Text style={styles.line}>{content.about_p1l4}</Text>
      <Text style={styles.line}>{content.about_p1l5}</Text>
    </View>
  );
};
const SloganBlock = () => {
  const slogan = "";
  return (
    <View style={styles.sloganBlock}>
      <Text style={{}}>{slogan}</Text>
    </View>
  );
};
