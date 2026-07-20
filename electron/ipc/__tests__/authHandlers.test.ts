import { describe, expect, it, vi, beforeEach } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
  listUsersMock: vi.fn(),
  listInstitutesMock: vi.fn(),
  createUserMock: vi.fn(),
  createInstituteMock: vi.fn(),
  ensureInstituteMock: vi.fn(),
  verifyInstituteTokenMock: vi.fn(),
  hasLocalUsersMock: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: mocks.handleMock
  }
}));

vi.mock("../../database", () => ({
  createInstitute: mocks.createInstituteMock,
  createUser: mocks.createUserMock,
  deleteUsersByUuids: vi.fn(),
  ensureInstitute: mocks.ensureInstituteMock,
  getInstituteByName: vi.fn(),
  hasLocalUsers: mocks.hasLocalUsersMock,
  listInstitutes: mocks.listInstitutesMock,
  listUsers: mocks.listUsersMock,
  verifyInstituteToken: mocks.verifyInstituteTokenMock,
  verifyUser: vi.fn()
}));

import { registerAuthHandlers } from "../authHandlers";

describe("auth handlers", () => {
  const createAuthSession = (authenticated = true) => ({
    isAuthenticated: vi.fn(() => authenticated),
    markAuthenticated: vi.fn(),
    getPrincipal: vi.fn(() => ({ username: "alice", instituteName: "Demo" })),
    clear: vi.fn(),
    requireAuthenticated: vi.fn(() => {
      if (!authenticated) {
        throw new Error(SharedClientErrorMessage.unauthorized);
      }
    })
  });

  beforeEach(() => {
    mocks.handleMock.mockReset();
    mocks.listUsersMock.mockReset();
    mocks.listInstitutesMock.mockReset();
    mocks.createUserMock.mockReset();
    mocks.createInstituteMock.mockReset();
    mocks.ensureInstituteMock.mockReset();
    mocks.verifyInstituteTokenMock.mockReset();
    mocks.hasLocalUsersMock.mockReset();
  });

  it("registers userList handler and returns user query payload", async () => {
    mocks.listUsersMock.mockResolvedValue([
      { uuid: "u-1", username: "alice", email: "a@demo.com", userRole: "administrator" }
    ]);
    registerAuthHandlers({ authSession: createAuthSession(true) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    expect(handlers.has("userList")).toBe(true);
    const userList = handlers.get("userList");
    expect(userList).toBeTruthy();

    const result = await userList?.({}, { instituteName: "Demo" });
    expect(mocks.listUsersMock).toHaveBeenCalledWith({ instituteName: "Demo" });
    expect(result).toMatchObject({
      code: 0,
      status: "success",
      payload: [{ total: 1 }]
    });
    expect(result).toEqual(expect.objectContaining({
      meta: expect.objectContaining({
        requestId: expect.any(String)
      })
    }));
  });

  it("registers userLogout handler and returns true", async () => {
    const authSession = createAuthSession(true);
    registerAuthHandlers({ authSession });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    expect(handlers.has("userLogout")).toBe(true);
    const logout = handlers.get("userLogout");
    await expect(logout?.({})).resolves.toBe(true);
    expect(authSession.clear).toHaveBeenCalled();
  });

  it("returns shared error message when userCreate fails with duplicate email", async () => {
    mocks.ensureInstituteMock.mockResolvedValue({ uuid: "i-1", instituteName: "Demo", token: "TK" });
    mocks.createUserMock.mockRejectedValue(new Error(SharedClientErrorMessage.emailExists));
    registerAuthHandlers({ authSession: createAuthSession(true) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const userCreate = handlers.get("userCreate");
    const result = await userCreate?.({}, {
      instituteName: "Demo",
      username: "alice",
      email: "alice@example.com",
      password: "Abcd1234",
      userRole: "administrator"
    });

    expect(result).toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.emailExists
    });
  });

  it("registers institute list/create/verify handlers", async () => {
    mocks.listInstitutesMock.mockResolvedValue([
      { uuid: "i-1", instituteName: "Demo", token: "TK-1" }
    ]);
    mocks.createInstituteMock.mockResolvedValue({ uuid: "i-2", instituteName: "Lab", token: "TK-2" });
    mocks.verifyInstituteTokenMock.mockResolvedValue([
      { uuid: "i-1", instituteName: "Demo", token: "TK-1" }
    ]);
    registerAuthHandlers({ authSession: createAuthSession(true) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("instituteList")?.({}, { instituteName: "Demo" })).resolves.toMatchObject({
      code: 0,
      payload: [{ total: 1 }]
    });
    await expect(handlers.get("instituteCreate")?.({}, { instituteName: "Lab" })).resolves.toMatchObject({
      code: 0,
      payload: [{ instituteName: "Lab" }]
    });
    await expect(handlers.get("verifyInstituteToken")?.({}, { token: "TK-1" })).resolves.toMatchObject({
      code: 0,
      payload: [{ total: 1 }]
    });
  });

  it("registers instituteRegister handler and creates admin user", async () => {
    mocks.createInstituteMock.mockResolvedValue({ uuid: "i-1", instituteName: "Demo", token: "TK" });
    mocks.createUserMock.mockResolvedValue({
      uuid: "u-1",
      instituteName: "Demo",
      username: "alice",
      email: "alice@example.com",
      userRole: "administrator"
    });
    const onLoginSuccess = vi.fn();
    registerAuthHandlers({ authSession: createAuthSession(true), onLoginSuccess });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const result = await handlers.get("instituteRegister")?.({}, {
      instituteName: "Demo",
      username: "alice",
      email: "alice@example.com",
      password: "Abcd1234"
    });

    expect(mocks.createInstituteMock).toHaveBeenCalledWith("Demo");
    expect(mocks.createUserMock).toHaveBeenCalledWith({
      instituteName: "Demo",
      username: "alice",
      email: "alice@example.com",
      password: "Abcd1234",
      userRole: "administrator"
    });
    expect(onLoginSuccess).toHaveBeenCalled();
    expect(result).toMatchObject({
      code: 0,
      payload: [{ instituteName: "Demo", userRole: "administrator" }]
    });
  });

  it("returns invalid payload when instituteCreate payload fails shared schema", async () => {
    registerAuthHandlers({ authSession: createAuthSession(true) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("instituteCreate")?.({}, { instituteName: "" })).resolves.toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.invalidPayload
    });
  });

  it("returns server-aligned success envelope for userDelete", async () => {
    registerAuthHandlers({ authSession: createAuthSession(true) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("userDelete")?.({}, [{ uuid: "u-1" }])).resolves.toMatchObject({
      code: 0,
      status: "success",
      payload: [true]
    });
  });

  it("blocks protected handlers when not authenticated", async () => {
    registerAuthHandlers({ authSession: createAuthSession(false) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("userList")?.({}, { instituteName: "Demo" })).resolves.toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.unauthorized
    });
  });

  it("returns bootstrap required when local users do not exist", async () => {
    mocks.hasLocalUsersMock.mockResolvedValue(false);
    registerAuthHandlers({ authSession: createAuthSession(true) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("isBootstrapRequired")?.({})).resolves.toBe(true);
  });

  it("does not swallow bootstrap probe errors", async () => {
    mocks.hasLocalUsersMock.mockRejectedValue(new Error("db unavailable"));
    registerAuthHandlers({ authSession: createAuthSession(true) });

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("isBootstrapRequired")?.({})).rejects.toThrow("db unavailable");
  });

});
