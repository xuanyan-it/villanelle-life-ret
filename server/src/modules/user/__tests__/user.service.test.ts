import { describe, expect, it, vi } from "vitest";

vi.mock("@villanelle/ret-shared/application", () => ({
  listUsers: vi.fn(),
  deleteUsers: vi.fn()
}));

describe("UserService (wrapper)", () => {
  it("delegates listUsers/deleteUsers to shared application", async () => {
    const shared = await import("@villanelle/ret-shared/application");
    const listUsersMock = shared.listUsers as unknown as vi.Mock;
    const deleteUsersMock = shared.deleteUsers as unknown as vi.Mock;

    listUsersMock.mockResolvedValue({ total: 0, result: [] } as any);
    deleteUsersMock.mockResolvedValue(true as any);

    const persistenceRepo = {
      listUsers: vi.fn(),
      findUserByEmail: vi.fn(),
      findUserByUsername: vi.fn(),
      loginUser: vi.fn(),
      createUser: vi.fn(),
      deleteUsers: vi.fn(),
      listInstitutes: vi.fn(),
      createInstitute: vi.fn(),
      verifyToken: vi.fn(),
      listRecords: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecords: vi.fn(),
    };

    const { UserService } = await import("../user.service");
    const service = new UserService(persistenceRepo as any);

    await service.listUsers({ instituteName: "Institute" } as any);
    await service.deleteUsers(["u1", "u2"]);

    expect(listUsersMock).toHaveBeenCalledTimes(1);
    expect(deleteUsersMock).toHaveBeenCalledTimes(1);
  });
});

