import { describe, expect, it } from "vitest";

import { institutesTable, recordsTable, usersTable } from "../schema";

describe("persistence schema", () => {
  it("exports drizzle table definitions", () => {
    expect(institutesTable).toBeDefined();
    expect(usersTable).toBeDefined();
    expect(recordsTable).toBeDefined();
  });
});

