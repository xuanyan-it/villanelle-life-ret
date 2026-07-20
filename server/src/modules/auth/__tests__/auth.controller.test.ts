import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

vi.mock("../../../common/envelope/response", () => ({
  ok: (payload: unknown) => ({ code: 0, payload: [payload] }),
}));

import { AuthController } from "../auth.controller";

describe("AuthController", () => {
  const config = {
    get: (key: string, fallback?: unknown) => {
      if (key === "NODE_ENV") return "test";
      if (key === "JWT_EXPIRES_IN") return "24h";
      if (key === "AUTH_COOKIE_NAME") return "ret_at";
      return fallback;
    }
  } as any;
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn()
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fail on login miss", async () => {
    const service = {
      userLogin: vi.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new AuthController(service, config);

    await expect(controller.userLogin({ email: "a@b.com", password: "x" } as any, response)).rejects.toThrow(
      new UnauthorizedException(SharedClientErrorMessage.loginFailed)
    );
  });

  it("returns ok on login success", async () => {
    const service = {
      userLogin: vi.fn().mockResolvedValue({
        uuid: "u-1",
        instituteName: "Demo",
        username: "alice",
        email: "a@b.com",
        userRole: "administrator",
        accessToken: "token",
      }),
    } as any;
    const controller = new AuthController(service, config);

    const result = await controller.userLogin({ email: "a@b.com", password: "x" } as any, response);
    expect(result.code).toBe(0);
    expect(response.cookie).toHaveBeenCalledTimes(1);
  });

  it("returns fail when user create returns error", async () => {
    const service = {
      userCreate: vi.fn().mockResolvedValue({ error: SharedClientErrorMessage.emailExists }),
    } as any;
    const controller = new AuthController(service, config);

    await expect(controller.userCreate({} as any, response)).rejects.toThrow(
      new ConflictException(SharedClientErrorMessage.emailExists)
    );
  });

  it("returns ok on logout", async () => {
    const controller = new AuthController({} as any, config);

    const result = await controller.userLogout(response);
    expect(result.code).toBe(0);
    expect(response.clearCookie).toHaveBeenCalledTimes(1);
  });
});
