import { describe, expect, it, vi } from "vitest";

const drizzleMock = vi.fn();
const poolMock = vi.fn();

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: (...args: unknown[]) => drizzleMock(...args),
}));

vi.mock("pg", () => ({
  Pool: function Pool(this: unknown, ...args: unknown[]) {
    return poolMock(...args);
  },
}));

describe("createDrizzleDb", () => {
  it("creates pool and drizzle db with schema", async () => {
    const fakePool = { query: vi.fn() };
    const fakeDb = { select: vi.fn() };
    poolMock.mockReturnValue(fakePool);
    drizzleMock.mockReturnValue(fakeDb);

    const { createDrizzleDb } = await import("../db");
    const ret = createDrizzleDb("postgres://user:pass@localhost:5432/db");

    expect(poolMock).toHaveBeenCalledWith({
      connectionString: "postgres://user:pass@localhost:5432/db",
    });
    expect(drizzleMock).toHaveBeenCalled();
    expect(ret.pool).toBe(fakePool);
    expect(ret.db).toBe(fakeDb);
  });
});

