import { Text } from "@react-pdf/renderer";
import React from "react";
const Indentation = ({
  defaultStyle,
  camouflage = { color: "#fff" },
  placeholder,
}) => {
  return <Text style={{ ...defaultStyle, ...camouflage }}>{placeholder}</Text>;
};
export default Indentation;
