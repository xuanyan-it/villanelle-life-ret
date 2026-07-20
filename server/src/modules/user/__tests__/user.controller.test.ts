import { ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

vi.mock("../../../common/envelope/response", () => ({
  ok: (payload: unknown) => ({ code: 0, payload: [payload] }),
}));

import { UserController } from "../user.controller";

describe("UserController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fail when delete operation is not fully successful", async () => {
    const service = {
      deleteUsers: vi.fn().mockResolvedValue(false),
    } as any;
    const controller = new UserController(service);

    await expect(controller.userDelete([{ uuid: "u-1" }] as any)).rejects.toThrow(
      new ConflictException(SharedClientErrorMessage.deleteFailed)
    );
  });

  it("lists users", async () => {
    const service = {
      listUsers: vi.fn().mockResolvedValue({ total: 1, result: [{ username: "alice" }] }),
      deleteUsers: vi.fn().mockResolvedValue(true),
    } as any;
    const controller = new UserController(service);

    const listed = await controller.userList({ instituteName: "Demo" } as any);

    expect(listed).toEqual({ code: 0, payload: [{ total: 1, result: [{ username: "alice" }] }] });
  });
});
