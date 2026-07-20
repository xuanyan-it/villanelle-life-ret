import { describe, expect, it, vi } from "vitest";

import { createInstitute, listInstitutes, verifyInstituteToken } from "../institute";

describe("institute use-cases", () => {
  it("createInstitute delegates to repository", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ uuid: "i1", instituteName: "ins" })
    };

    const result = await createInstitute("ins", repository as never);
    expect(result.instituteName).toBe("ins");
  });

  it("verifyInstituteToken validates token required", async () => {
    const repository = {
      verifyToken: vi.fn()
    };
    await expect(verifyInstituteToken("", repository as never)).rejects.toThrow("token is required");
  });

  it("listInstitutes delegates to repository", async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({ total: 0, result: [] })
    };
    const result = await listInstitutes({ instituteName: "ins" }, repository as never);
    expect(result.total).toBe(0);
  });
});
