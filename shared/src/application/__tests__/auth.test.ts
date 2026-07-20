import { describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "../../contracts/error-messages";

import { createUser, loginUser } from "../auth";

describe("auth use-cases", () => {
  it("loginUser returns auth payload", async () => {
    const repository = {
      login: vi.fn().mockResolvedValue({
        id: 1,
        uuid: "u1",
        instituteName: "ins",
        userRole: "operator",
        email: "a@b.com",
        username: "user",
        createdAt: "",
        updatedAt: "",
        lastLoginAt: "",
        isActivated: true
      })
    };
    const tokenPort = { issueToken: vi.fn().mockReturnValue("token") };

    const result = await loginUser({ email: "a@b.com", password: "123" }, repository, tokenPort);
    expect(result?.accessToken).toBe("token");
    expect(result?.uuid).toBe("u1");
  });

  it("createUser returns email exists when duplicated", async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue({ uuid: "u1" }),
      findByUsername: vi.fn(),
      create: vi.fn()
    };
    const tokenPort = { issueToken: vi.fn() };

    const result = await createUser(
      {
        instituteName: "ins",
        email: "a@b.com",
        username: "user",
        password: "123",
        userRole: "operator"
      },
      repository as never,
      tokenPort
    );

    expect(result).toEqual({ error: SharedClientErrorMessage.emailExists });
  });

  it("loginUser returns null when credentials are invalid", async () => {
    const repository = {
      login: vi.fn().mockResolvedValue(null)
    };
    const tokenPort = { issueToken: vi.fn() };

    const result = await loginUser(
      { email: "not-found@example.com", password: "wrong" },
      repository,
      tokenPort as any
    );

    expect(result).toBeNull();
    expect(tokenPort.issueToken).not.toHaveBeenCalled();
  });

  it("createUser returns username exists when duplicated", async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findByUsername: vi.fn().mockResolvedValue({ uuid: "u2" }),
      create: vi.fn()
    };
    const tokenPort = { issueToken: vi.fn() };

    const result = await createUser(
      {
        instituteName: "ins",
        email: "a@b.com",
        username: "user",
        password: "123",
        userRole: "operator"
      },
      repository as never,
      tokenPort as any
    );

    expect(result).toEqual({ error: SharedClientErrorMessage.usernameExists });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("createUser creates institute when repository is provided and empty", async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findByUsername: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        uuid: "u3",
        instituteName: "ins",
        username: "new-user",
        email: "new@b.com",
        userRole: "operator"
      })
    };
    const instituteRepository = {
      list: vi.fn().mockResolvedValue({ total: 0 }),
      create: vi.fn().mockResolvedValue(undefined)
    };
    const tokenPort = { issueToken: vi.fn().mockReturnValue("token-3") };

    const result = await createUser(
      {
        instituteName: "ins",
        email: "new@b.com",
        username: "new-user",
        password: "123",
        userRole: "operator"
      },
      repository as never,
      tokenPort as any,
      instituteRepository as never
    );

    expect(instituteRepository.create).toHaveBeenCalledWith("ins");
    expect(result).toEqual({
      data: expect.objectContaining({
        uuid: "u3",
        accessToken: "token-3"
      })
    });
  });

  it("createUser does not create institute when already exists", async () => {
    const repository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findByUsername: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        uuid: "u4",
        instituteName: "ins",
        username: "existing",
        email: "e@b.com",
        userRole: "operator"
      })
    };
    const instituteRepository = {
      list: vi.fn().mockResolvedValue({ total: 1 }),
      create: vi.fn()
    };
    const tokenPort = { issueToken: vi.fn().mockReturnValue("token-4") };

    await createUser(
      {
        instituteName: "ins",
        email: "e@b.com",
        username: "existing",
        password: "123",
        userRole: "operator"
      },
      repository as never,
      tokenPort as any,
      instituteRepository as never
    );

    expect(instituteRepository.create).not.toHaveBeenCalled();
  });

  it("createUser throws when required fields are missing", async () => {
    const repository = {
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn()
    };
    const tokenPort = { issueToken: vi.fn() };

    await expect(
      createUser(
        {
          instituteName: "",
          email: "a@b.com",
          username: "user",
          password: "123",
          userRole: "operator"
        },
        repository as never,
        tokenPort as any
      )
    ).rejects.toThrow("instituteName is required");
  });
});
