import { describe, expect, it } from "vitest";

import { PasswordPolicySchema, DEFAULT_IDLE_TIMEOUT_SECONDS } from "../security-policy";

describe("shared security policy", () => {
  it("accepts valid passwords", () => {
    expect(PasswordPolicySchema.parse("Aa123456")).toBe("Aa123456");
  });

  it("rejects invalid passwords", () => {
    expect(() => PasswordPolicySchema.parse("weakpass")).toThrow();
    expect(() => PasswordPolicySchema.parse("AA123456")).toThrow();
    expect(() => PasswordPolicySchema.parse("aa123456")).toThrow();
    expect(() => PasswordPolicySchema.parse("Aa 12345")).toThrow();
  });

  it("keeps the shared idle timeout at 24 hours", () => {
    expect(DEFAULT_IDLE_TIMEOUT_SECONDS).toBe(24 * 60 * 60);
  });
});
