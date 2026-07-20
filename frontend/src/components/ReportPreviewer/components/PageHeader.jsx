import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import LogoLight from "../image/LogoWithSloganLight_1200x400.png";
const styles = StyleSheet.create({
  header: {
    width: "100%",
    height: 80,
    left: 0,
    top: 0,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  title: {
    fontFamily: "HanSansSC",
    fontWeight: 800,
    textAlign: "center",
    color: "#37467a",
    fontSize: 28,
    marginTop: 20,
  },
  logo: {
    height: 50,
    width: 160,
    marginRight: 20,
    marginVertical: 10,
  },
});
const PageHeader = ({ title = "", logo = LogoLight }) => {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Image src={logo} style={styles.logo} />
    </View>
  );
};
export default PageHeader;
