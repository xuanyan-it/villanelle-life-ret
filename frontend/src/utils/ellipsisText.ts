export const ellipsisText = (text: string, suffixLength: number) => {
  return {
    prefix:
      text.length <= suffixLength
        ? ""
        : text.slice(0, text.length - suffixLength),
    suffix: text.length <= suffixLength ? text : text.slice(-suffixLength),
  };
};
