import { BadRequestException, ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

vi.mock("../../../common/envelope/response", () => ({
  ok: (payload: unknown) => ({ code: 0, payload: [payload] }),
}));

import { InstituteController } from "../institute.controller";

describe("InstituteController", () => {
  const config = {
    get: (key: string, fallback?: unknown) => {
      if (key === "NODE_ENV") return "test";
      if (key === "JWT_EXPIRES_IN") return "24h";
      if (key === "AUTH_COOKIE_NAME") return "ret_at";
      return fallback;
    }
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fail when register result contains error", async () => {
    const service = {
      registerInstitute: vi.fn().mockResolvedValue({ error: SharedClientErrorMessage.instituteExists }),
    } as any;
    const controller = new InstituteController(service, config);

    await expect(controller.instituteRegister({} as any)).rejects.toThrow(
      new ConflictException(SharedClientErrorMessage.instituteExists)
    );
  });

  it("returns fail for invalid token", async () => {
    const service = {
      verifyInstituteToken: vi.fn().mockResolvedValue({ total: 0, result: [] }),
    } as any;
    const controller = new InstituteController(service, config);

    await expect(controller.instituteVerify({ token: "bad" } as any)).rejects.toThrow(
      new BadRequestException(SharedClientErrorMessage.invalidToken)
    );
  });

  it("returns ok for valid token", async () => {
    const service = {
      verifyInstituteToken: vi.fn().mockResolvedValue({ total: 1, result: [{ token: "ok" }] }),
    } as any;
    const controller = new InstituteController(service, config);

    const result = await controller.instituteVerify({ token: "ok" } as any);
    expect(result).toEqual({ code: 0, payload: [{ total: 1, result: [{ token: "ok" }] }] });
  });

  it("delegates list, credential and create operations", async () => {
    const service = {
      listInstitutes: vi.fn().mockResolvedValue({ total: 1, result: [{ instituteName: "Demo" }] }),
      getInstituteCredential: vi.fn().mockResolvedValue({ total: 1, result: [{ token: "t-1" }] }),
      createInstitute: vi.fn().mockResolvedValue({ instituteName: "Demo", token: "t-1" }),
    } as any;
    const controller = new InstituteController(service, config);

    const listed = await controller.instituteList({ instituteName: "Demo" } as any);
    const credential = await controller.instituteCredentialGet({ instituteName: "Demo" } as any);
    const created = await controller.instituteCreate({ instituteName: "Demo" } as any);

    expect(listed.code).toBe(0);
    expect(credential.code).toBe(0);
    expect(created.code).toBe(0);
  });

  it("raises conflict when institute create returns duplicated name", async () => {
    const service = {
      createInstitute: vi.fn().mockResolvedValue({ error: SharedClientErrorMessage.instituteExists }),
    } as any;
    const controller = new InstituteController(service, config);

    await expect(controller.instituteCreate({ instituteName: "Demo" } as any)).rejects.toThrow(
      new ConflictException(SharedClientErrorMessage.instituteExists)
    );
  });
});
