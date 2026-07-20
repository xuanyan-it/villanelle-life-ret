import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  userColumns: [{ name: "id" }, { name: "password" }],
  hashMock: vi.fn(),
  verifyMock: vi.fn(),
  runCalls: [] as Array<{ sql: string; params: Array<string | number | null> }>,
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd()
  }
}));

vi.mock("argon2", () => ({
  default: {
    argon2id: 2,
    hash: (...args: unknown[]) => state.hashMock(...args),
    verify: (...args: unknown[]) => state.verifyMock(...args)
  }
}));

vi.mock("sqlite3", () => {
  class Database {
    constructor(_path: string, callback?: (err: Error | null) => void) {
      callback?.(null);
    }

    serialize(callback: () => void) {
      callback();
    }

    run(sql: string, params: Array<string | number | null> | ((err: Error | null) => void), callback?: (this: { lastID: number }, err: Error | null) => void) {
      const normalizedParams = Array.isArray(params) ? params : [];
      const normalizedCallback = typeof params === "function" ? params : callback;
      state.runCalls.push({ sql, params: normalizedParams });

      if (sql.includes("INSERT INTO user")) {
        const [instituteName, username, email, password, passHash, userRole] = normalizedParams;
        state.users.push({
          uuid: "u-1",
          instituteName,
          username,
          email,
          password,
          passHash,
          userRole
        });
      }

      if (sql.startsWith("UPDATE user SET passHash")) {
        const [passHash, password, uuid] = normalizedParams;
        const user = state.users.find((item) => item.uuid === uuid);
        if (user) {
          user.passHash = passHash;
          user.password = password;
        }
      }

      normalizedCallback?.call({ lastID: 1 }, null);
      return this;
    }

    get(sql: string, params: Array<string | number | null>, callback: (err: Error | null, row?: any) => void) {
      if (sql.includes("SELECT * FROM user WHERE email = ?")) {
        const email = params[0];
        callback(null, state.users.find((item) => item.email === email));
        return this;
      }
      callback(null, undefined);
      return this;
    }

    all(sql: string, _params: Array<string | number | null>, callback: (err: Error | null, rows: any[]) => void) {
      if (sql.includes("PRAGMA table_info(user)")) {
        callback(null, state.userColumns);
        return this;
      }
      callback(null, []);
      return this;
    }

    close() {}
  }

  return { default: { Database }, Database };
});

describe("electron database auth", () => {
  beforeEach(() => {
    vi.resetModules();
    state.users = [];
    state.userColumns = [{ name: "id" }, { name: "password" }];
    state.runCalls = [];
    state.hashMock.mockReset();
    state.verifyMock.mockReset();
    state.hashMock.mockResolvedValue("argon-hash");
    state.verifyMock.mockResolvedValue(true);
    process.env.NODE_ENV = "test";
  });

  it("creates auth tables with passHash column and stores hashed password for new users", async () => {
    const dbModule = await import("../index");

    await dbModule.createAuthTables();
    await dbModule.createUser({
      instituteName: "Demo",
      username: "alice",
      email: "alice@example.com",
      password: "Aa123456",
      userRole: "administrator"
    });

    expect(state.runCalls.some((call) => call.sql.includes("ALTER TABLE user ADD COLUMN passHash"))).toBe(true);
    expect(state.hashMock).toHaveBeenCalledWith("Aa123456", { type: 2 });
    const insertedUser = state.users[0];
    expect(insertedUser?.password).toBe("");
    expect(insertedUser?.passHash).toBe("argon-hash");
  });

  it("migrates legacy plaintext password on successful login", async () => {
    state.userColumns = [{ name: "id" }, { name: "password" }, { name: "passHash" }];
    state.users = [
      {
        uuid: "u-legacy",
        instituteName: "Demo",
        username: "alice",
        email: "alice@example.com",
        password: "Aa123456",
        passHash: "",
        userRole: "administrator"
      }
    ];

    const dbModule = await import("../index");
    const user = await dbModule.verifyUser("alice@example.com", "Aa123456");

    expect(user?.uuid).toBe("u-legacy");
    expect(state.hashMock).toHaveBeenCalledWith("Aa123456", { type: 2 });
    expect(state.runCalls.some((call) => call.sql.startsWith("UPDATE user SET passHash"))).toBe(true);
    expect(state.users[0]?.password).toBe("");
    expect(state.users[0]?.passHash).toBe("argon-hash");
  });
});
