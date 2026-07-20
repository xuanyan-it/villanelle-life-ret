import { StyleSheet, Text, View } from "@react-pdf/renderer";
const styles = StyleSheet.create({
  footerContainer: {
    fontFamily: "HanSansSC",
    fontWeight: 600,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 24,
    width: "100%",
    backgroundColor: "#37467aff",
    color: "#fff",
    position: "absolute",
    left: 0,
    bottom: 0,
    fontSize: 12,
  },
});
const PageFooter = ({ pageId, content = { footer: "" } }) => {
  return (
    <View className="pdf-footer-container" style={styles.footerContainer}>
      <Text>{content.footer}</Text>
      <Text>{pageId}</Text>
    </View>
  );
};
export default PageFooter;
