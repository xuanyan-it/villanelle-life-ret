export const isFieldValueNullString = (value: string | null | undefined) => {
  if (typeof value !== "string") return false;
  if (!value) return false;
  if (value.toLowerCase() === "n/a") return false;
  return true;
};
