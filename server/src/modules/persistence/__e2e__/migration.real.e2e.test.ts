import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { PostgresPersistenceRepository } from "../persistence.repository.postgres";

const serverRoot = path.resolve(__dirname, "..", "..", "..", "..");
const baseDatabaseUrl = process.env.DATABASE_URL;
const baselineMigrationSql = fs.readFileSync(
  path.join(serverRoot, "migrations", "0000_initial_schema.sql"),
  "utf8",
);

if (!baseDatabaseUrl) {
  throw new Error("migration real e2e requires DATABASE_URL");
}

const createSchemaName = () => `migration_e2e_${randomUUID().replace(/-/g, "")}`;

const withSearchPath = (databaseUrl: string, schemaName: string) => {
  const url = new URL(databaseUrl);
  const currentOptions = url.searchParams.get("options");
  const searchPathOption = `-c search_path=${schemaName}`;
  url.searchParams.set(
    "options",
    currentOptions ? `${currentOptions} ${searchPathOption}` : searchPathOption,
  );
  return url.toString();
};

const applyBaselineMigration = async (pool: Pool, schemaName: string) => {
  const statements = baselineMigrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  await pool.query(`SET search_path TO "${schemaName}"`);
  for (const statement of statements) {
    await pool.query(statement);
  }
};

describe("server migration real e2e", () => {
  let adminPool: Pool;
  let schemaName: string;
  let schemaDatabaseUrl: string;

  beforeEach(async () => {
    adminPool = new Pool({ connectionString: baseDatabaseUrl });
    schemaName = createSchemaName();
    schemaDatabaseUrl = withSearchPath(baseDatabaseUrl, schemaName);
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
  });

  afterEach(async () => {
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  });

  it("fails fast when schema is missing", async () => {
    const repository = new PostgresPersistenceRepository(schemaDatabaseUrl);

    await expect(repository.findUserByEmail("missing@example.com")).rejects.toThrow(
      /database schema is not initialized/,
    );

    await repository.close();
  });

  it("fails fast on a partial legacy schema", async () => {
    await adminPool.query(`
      SET search_path TO "${schemaName}";
      CREATE TABLE institute (id serial primary key);
    `);

    const repository = new PostgresPersistenceRepository(schemaDatabaseUrl);

    await expect(repository.findUserByEmail("partial@example.com")).rejects.toThrow(
      /database schema is not initialized/,
    );

    await repository.close();
  });

  it("applies the managed baseline migration to an empty schema and becomes usable", async () => {
    await applyBaselineMigration(adminPool, schemaName);
    const repository = new PostgresPersistenceRepository(schemaDatabaseUrl);
    const institute = await repository.createInstitute("Migration Lab");
    const user = await repository.createUser({
      instituteName: institute.instituteName,
      email: "migration-admin@example.com",
      username: "migration_admin",
      password: "Secret123",
      userRole: "administrator",
    });
    const found = await repository.findUserByEmail("migration-admin@example.com");

    expect(user.email).toBe("migration-admin@example.com");
    expect(found?.username).toBe("migration_admin");

    await repository.close();
  });
});
