import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createSanitizedLogger } from "../sanitized-logger";

describe("SanitizedNestLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("redacts bearer token in log message", () => {
    const spy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const logger = createSanitizedLogger("Test");

    logger.log("Authorization: Bearer abc.def.ghi");

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Bearer [REDACTED]")
    );
  });

  test("redacts sensitive fields in object log payload", () => {
    const spy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const logger = createSanitizedLogger("Test");

    logger.log({
      email: "alice@example.com",
      password: "Aa123456"
    });

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("\"password\":\"[REDACTED]\"")
    );
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("\"email\":\"a***@example.com\"")
    );
  });

  test("redacts trace in error log", () => {
    const spy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const logger = createSanitizedLogger("Test");

    logger.error("request failed", "Authorization: Bearer abc.def.ghi");

    expect(spy).toHaveBeenCalledWith(
      "request failed",
      expect.stringContaining("Bearer [REDACTED]"),
      undefined
    );
  });
});
