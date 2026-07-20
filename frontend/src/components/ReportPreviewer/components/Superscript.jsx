import { Text } from "@react-pdf/renderer";
import React from "react";
const Superscript = ({ defaultstyle, children }) => {
  const superscriptFontSize = defaultstyle.fontSize * 0.6;
  return (
    <Text
      style={{
        fontSize: superscriptFontSize,
        verticalAlign: "super",
        paddingBottom: 50,
      }}
    >
      {children}
    </Text>
  );
};
export default Superscript;
