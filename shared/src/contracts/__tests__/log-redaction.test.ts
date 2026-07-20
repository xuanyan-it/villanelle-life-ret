import { describe, expect, it } from "vitest";

import { sanitizeLogMessage, sanitizeLogValue } from "../log-redaction";

describe("log redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const sanitized = sanitizeLogValue({
      password: "Aa123456",
      nested: {
        access_token: "token-value",
        profile: {
          email: "alice@example.com"
        }
      }
    }) as any;

    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.nested.access_token).toBe("[REDACTED]");
    expect(sanitized.nested.profile.email).toBe("a***@example.com");
  });

  it("redacts bearer token text fragments", () => {
    expect(sanitizeLogMessage("Authorization: Bearer abc.def.ghi")).toContain("Bearer [REDACTED]");
  });
});
