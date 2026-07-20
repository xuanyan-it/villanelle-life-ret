import { describe, expect, it, vi } from "vitest";

import { deleteUsers, listUsers } from "../user";

describe("user use-cases", () => {
  it("listUsers delegates to repository", async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ total: 1, result: [{ uuid: "u1" }] })
    };

    const result = await listUsers({ instituteName: "ins" }, repository as never);
    expect(result.total).toBe(1);
    expect(repository.list).toHaveBeenCalledWith({ instituteName: "ins" });
  });

  it("deleteUsers validates non-empty uuids", async () => {
    const repository = {
      deleteByUuids: vi.fn().mockResolvedValue(true)
    };

    await expect(deleteUsers([], repository as never)).rejects.toThrow("uuids is required");
  });
});
