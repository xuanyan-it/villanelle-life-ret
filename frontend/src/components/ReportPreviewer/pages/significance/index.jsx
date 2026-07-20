import { StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";
import Indentation from "../../components/Indentation";
import PageFooter from "../../components/PageFooter";
import PageHeader from "../../components/PageHeader";
import Superscript from "../../components/Superscript";
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
  indentation: {
    color: "#fff",
  },
});
const Significance = (props) => {
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
export default Significance;
const Block = (props) => {
  const { content, lang } = props;
  return (
    <View>
      
      <Text style={styles.title}>{content.block1_title}</Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.block1_l1}
      </Text>
      <Text style={styles.line}>
        {content.block1_l2before1}
        <Superscript defaultstyle={styles.line}>
          {content.block1_l21}
        </Superscript>
        {content.block1_l2after1}
      </Text>
      <Text style={styles.line}>
        {content.block1_l3before2}
        <Superscript defaultstyle={styles.line}>
          {content.block1_l32}
        </Superscript>
        {content.block1_l3after2}
      </Text>
      <Text style={styles.line}>{content.block1_l4}</Text>
      <Text style={styles.line}>{content.block1_l5}</Text>
      <Text style={styles.line}>
        {content.block1_l6before3}
        <Superscript defaultstyle={styles.line}>
          {content.block1_l63}
        </Superscript>
        {content.block1_l6after3}
      </Text>
      
      <Text style={styles.title}>{content.block2_title}</Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.block2_l1}
      </Text>
      <Text style={styles.line}>{content.block2_l2}</Text>
      <Text style={styles.line}>
        {content.block2_l3before4}
        <Superscript defaultstyle={styles.line}>
          {content.block2_l34}
        </Superscript>
        {content.block2_l3after4}
      </Text>
      <Text style={styles.line}>{content.block2_l4}</Text>
      
      <Text style={styles.title}>{content.block3_title}</Text>
      <Text style={styles.line}>
        <Indentation
          defaultStyle={styles.line}
          camouflage={styles.indentation}
          lang={lang}
          placeholder={"中文"}
        />
        {content.block3_l1}
      </Text>
      <Text style={styles.line}>
        {content.block3_l2before5}
        <Superscript defaultstyle={styles.line}>
          {content.block3_l25}
        </Superscript>
        {content.block3_l2after5}
      </Text>
      <Text style={styles.line}>{content.block3_l3}</Text>
      <Text style={styles.line}>
        {content.block3_l4before6}
        <Superscript defaultstyle={styles.line}>
          {content.block3_l46}
        </Superscript>
        {content.block3_l4after6}
      </Text>
      <Text style={styles.line}>{content.block3_l5}</Text>
      <Text style={styles.line}>{content.block3_l6}</Text>
      <Text style={styles.line}>
        {content.block3_l7before7}
        <Superscript defaultstyle={styles.line}>
          {content.block3_l77}
        </Superscript>
        {content.block3_l7after7}
      </Text>
    </View>
  );
};
