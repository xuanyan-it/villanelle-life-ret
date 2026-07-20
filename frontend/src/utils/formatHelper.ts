import * as SharedContracts from "@villanelle/ret-shared/contracts";

export const isValidEmail = (addr: string) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(addr);
};
export const isValidPassword = (passwd: string) => {
  return SharedContracts.PASSWORD_POLICY_REGEX.test(passwd);
};
export const isValid2DecimalFloat = (str: string) => {
  const regex = /^[+-]?\d+\.\d{2}$/;
  if (!regex.test(str)) return false;
  const num = parseFloat(str);
  return !isNaN(num);
};
export const YYYYMMDD2ISOString = (str: string) => {
  const parsedDate = new Date(str.replace(/\//g, "-"));
  return parsedDate.toISOString();
};
