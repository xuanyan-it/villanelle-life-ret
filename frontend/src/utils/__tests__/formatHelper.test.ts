import { describe, expect, it } from "vitest";

import {
  YYYYMMDD2ISOString,
  isValid2DecimalFloat,
  isValidEmail,
  isValidPassword
} from "../formatHelper";

describe("formatHelper password policy", () => {
  it("accepts passwords that satisfy the shared policy", () => {
    expect(isValidPassword("Aa123456")).toBe(true);
    expect(isValidPassword("ThyroM3tStrong")).toBe(true);
  });

  it("rejects passwords that violate the shared policy", () => {
    expect(isValidPassword("short1A")).toBe(false);
    expect(isValidPassword("alllowercase1")).toBe(false);
    expect(isValidPassword("ALLUPPERCASE1")).toBe(false);
    expect(isValidPassword("NoDigitsHere")).toBe(false);
    expect(isValidPassword("Space 123A")).toBe(false);
  });
});

describe("formatHelper email validator", () => {
  it("accepts valid email addresses", () => {
    expect(isValidEmail("doctor@example.com")).toBe(true);
    expect(isValidEmail("a.b+tag@sample.co")).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    expect(isValidEmail("doctor.example.com")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("formatHelper decimal validator", () => {
  it("accepts signed and unsigned 2-decimal numbers", () => {
    expect(isValid2DecimalFloat("12.34")).toBe(true);
    expect(isValid2DecimalFloat("-0.01")).toBe(true);
    expect(isValid2DecimalFloat("+1.20")).toBe(true);
  });

  it("rejects invalid 2-decimal numbers", () => {
    expect(isValid2DecimalFloat("12")).toBe(false);
    expect(isValid2DecimalFloat("12.3")).toBe(false);
    expect(isValid2DecimalFloat("12.345")).toBe(false);
    expect(isValid2DecimalFloat("abc")).toBe(false);
  });
});

describe("formatHelper date converter", () => {
  it("converts yyyy/mm/dd to ISO string", () => {
    expect(YYYYMMDD2ISOString("2026/03/23")).toBe("2026-03-23T00:00:00.000Z");
  });
});
