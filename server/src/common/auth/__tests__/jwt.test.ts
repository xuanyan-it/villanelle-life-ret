import { describe, expect, it } from "vitest";

import {
  issueAccessJwt,
  verifyAccessJwt,
} from "../jwt";

const ACCESS_SECRET = "test-access-secret-123456";

const basePayload = {
  uuid: "u-1",
  username: "alice",
  instituteName: "Demo Institute",
  email: "alice@example.com",
  userRole: "administrator" as const,
};

describe("jwt helpers", () => {
  it("issues and verifies access token", () => {
    const token = issueAccessJwt({
      payload: basePayload,
      secret: ACCESS_SECRET,
      expiresIn: "1h",
    });

    const decoded = verifyAccessJwt(token, ACCESS_SECRET);
    expect(decoded.username).toBe(basePayload.username);
    expect(decoded.instituteName).toBe(basePayload.instituteName);
    expect(decoded.email).toBe(basePayload.email);
    expect(decoded.userRole).toBe(basePayload.userRole);
  });

  it("rejects token with wrong secret", () => {
    const token = issueAccessJwt({
      payload: basePayload,
      secret: ACCESS_SECRET,
      expiresIn: "1h",
    });

    expect(() => verifyAccessJwt(token, "wrong-secret")).toThrow();
  });

  it("allows access payload without uuid", () => {
    const token = issueAccessJwt({
      payload: {
        username: "alice",
        instituteName: "Demo Institute",
        email: "alice@example.com",
        userRole: "administrator",
      },
      secret: ACCESS_SECRET,
      expiresIn: "1h",
    });

    const decoded = verifyAccessJwt(token, ACCESS_SECRET);
    expect(decoded.uuid).toBeUndefined();
    expect(decoded.username).toBe("alice");
  });

});
