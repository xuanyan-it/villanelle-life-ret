import { describe, expect, it } from "vitest";

import { parseServerEnv } from "../env";

describe("parseServerEnv", () => {
  it("parses required values and applies defaults", () => {
    const parsed = parseServerEnv({
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    });

    expect(parsed.HOST).toBe("0.0.0.0");
    expect(parsed.PORT).toBe(7001);
    expect(parsed.JWT_EXPIRES_IN).toBe("24h");
  });

  it("accepts postgresql:// database urls", () => {
    const parsed = parseServerEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });

    expect(parsed.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL is required/);
  });

  it("throws when DATABASE_URL has an invalid protocol", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "mysql://user:pass@localhost:3306/db",
      }),
    ).toThrow(/must start with postgres:\/\/ or postgresql:\/\//);
  });

  it("requires JWT secrets in production", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      }),
    ).toThrow(/JWT_SECRET/i);
  });

  it("accepts explicit JWT secret in production", () => {
    const parsed = parseServerEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      JWT_SECRET: "prod-access-secret-1234567890",
    });

    expect(parsed.JWT_SECRET).toBe("prod-access-secret-1234567890");
  });

  it("throws when JWT_EXPIRES_IN exceeds 24h", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
        JWT_EXPIRES_IN: "25h",
      }),
    ).toThrow(/must not exceed 24h/i);
  });

  it("throws when JWT_EXPIRES_IN format is invalid", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
        JWT_EXPIRES_IN: "90000",
      }),
    ).toThrow(/must use s\/m\/h\/d format/i);
  });
});
