import { describe, expect, it, vi } from "vitest";

import { AuthService } from "../auth.service";

import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import { PersistenceConflictError } from "../../persistence/persistence.repository.types";

const loginUserMock = vi.fn();
const createUserMock = vi.fn();

vi.mock("@villanelle/ret-shared/application", () => ({
  loginUser: (...args: unknown[]) => loginUserMock(...args),
  createUser: (...args: unknown[]) => createUserMock(...args),
}));

const createRepositoryStub = () =>
  ({
    listUsers: async () => ({ total: 0, result: [] }),
    findUserByEmail: async () => undefined,
    findUserByUsername: async () => undefined,
    loginUser: async () => undefined,
    createUser: async () => {
      throw new Error("not implemented");
    },
    deleteUsers: async () => true,
    listInstitutes: async () => ({ total: 0, result: [] }),
    createInstitute: async () => {
      throw new Error("not implemented");
    },
    verifyToken: async () => ({ total: 0, result: [] }),
    listRecords: async () => ({ total: 0, result: [] }),
    createRecord: async () => {
      throw new Error("not implemented");
    },
    deleteRecords: async () => true,
  }) as any;

const createConfigStub = () =>
  ({
    get: (key: string, fallback?: unknown) => {
      if (key === "JWT_SECRET") return "test-access-secret-123456";
      if (key === "JWT_EXPIRES_IN") return "24h";
      return fallback;
    },
  }) as any;

describe("AuthService", () => {
  it("delegates user login to shared application layer", async () => {
    loginUserMock.mockResolvedValue({ accessToken: "token" });
    const service = new AuthService(createRepositoryStub(), createConfigStub());
    const result = await service.userLogin({ email: "a@demo.com", password: "123" });
    expect(loginUserMock).toHaveBeenCalled();
    expect(result).toEqual({ accessToken: "token" });
  });

  it("delegates user create to shared application layer", async () => {
    createUserMock.mockResolvedValue({ data: { ok: true } });
    const service = new AuthService(createRepositoryStub(), createConfigStub());
    const result = await service.userCreate({
      instituteName: "Demo",
      email: "a@demo.com",
      username: "alice",
      password: "123",
      userRole: "administrator",
    });
    expect(createUserMock).toHaveBeenCalled();
    expect(result).toEqual({ data: { ok: true } });
  });

  it("maps PersistenceConflictError(email) to emailExists", async () => {
    createUserMock.mockRejectedValue(new PersistenceConflictError("email"));
    const service = new AuthService(createRepositoryStub(), createConfigStub());

    const result = await service.userCreate({
      instituteName: "Demo",
      email: "a@demo.com",
      username: "alice",
      password: "123",
      userRole: "administrator",
    });

    expect(result).toEqual({ error: SharedClientErrorMessage.emailExists });
  });

  it("maps PersistenceConflictError(username) to usernameExists", async () => {
    createUserMock.mockRejectedValue(new PersistenceConflictError("username"));
    const service = new AuthService(createRepositoryStub(), createConfigStub());

    const result = await service.userCreate({
      instituteName: "Demo",
      email: "a@demo.com",
      username: "alice",
      password: "123",
      userRole: "administrator",
    });

    expect(result).toEqual({ error: SharedClientErrorMessage.usernameExists });
  });

  it("rethrows PersistenceConflictError(instituteName)", async () => {
    createUserMock.mockRejectedValue(new PersistenceConflictError("instituteName"));
    const service = new AuthService(createRepositoryStub(), createConfigStub());

    await expect(
      service.userCreate({
        instituteName: "Demo",
        email: "a@demo.com",
        username: "alice",
        password: "123",
        userRole: "administrator",
      })
    ).rejects.toThrow(/persistence conflict/i);
  });

  it("rethrows non persistence errors", async () => {
    createUserMock.mockRejectedValue(new Error("boom"));
    const service = new AuthService(createRepositoryStub(), createConfigStub());

    await expect(
      service.userCreate({
        instituteName: "Demo",
        email: "a@demo.com",
        username: "alice",
        password: "123",
        userRole: "administrator",
      })
    ).rejects.toThrow("boom");
  });
});
