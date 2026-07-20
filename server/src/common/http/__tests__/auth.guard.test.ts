import { UnauthorizedException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { issueAccessJwt } from "../../auth/jwt";
import { AuthGuard } from "../guards/auth.guard";

const makeGuard = (opts?: { isPublic?: boolean }) => {
  const reflector = {
    getAllAndOverride: () => opts?.isPublic ?? false,
  } as any;
  const configService = {
    get: (key: string, fallback?: unknown) => {
      if (key === "JWT_SECRET") return "test-access-secret-123456";
      if (key === "AUTH_COOKIE_NAME") return "ret_at";
      return fallback;
    },
  } as any;
  return new AuthGuard(reflector, configService);
};

const makeContext = (headers: Record<string, unknown>, cookies?: Record<string, unknown>) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers, cookies }),
    }),
  }) as any;

describe("AuthGuard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows public route", () => {
    const guard = makeGuard({ isPublic: true });
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it("rejects missing token when strict mode is enabled", () => {
    const guard = makeGuard();
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it("rejects missing token in non-test env", () => {
    const guard = makeGuard();
    expect(() => guard.canActivate(makeContext({}))).toThrow("missing access token");
  });

  it("accepts valid cookie token and injects auth user", () => {
    const token = issueAccessJwt({
      payload: {
        uuid: "u-1",
        username: "alice",
        instituteName: "Demo",
        email: "alice@example.com",
        userRole: "administrator",
      },
      secret: "test-access-secret-123456",
      expiresIn: "1h",
    });
    const req: any = { headers: {}, cookies: { ret_at: token } };
    const context: any = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    };
    const guard = makeGuard();
    expect(guard.canActivate(context)).toBe(true);
    expect(req.authUser?.username).toBe("alice");
  });

  it("rejects expired token", () => {
    const token = issueAccessJwt({
      payload: {
        uuid: "u-3",
        username: "charlie",
        instituteName: "Demo",
        email: "charlie@example.com",
        userRole: "operator",
      },
      secret: "test-access-secret-123456",
      expiresIn: "-1s",
    });
    const guard = makeGuard();
    expect(() => guard.canActivate(makeContext({}, { ret_at: token }))).toThrow(
      "token expired",
    );
  });

  it("rejects invalid token", () => {
    const guard = makeGuard();
    expect(() => guard.canActivate(makeContext({}, { ret_at: "bad-token" }))).toThrow(
      "invalid access token",
    );
  });
});
