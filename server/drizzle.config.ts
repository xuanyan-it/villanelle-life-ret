import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  out: "./migrations",
  schema: "./src/modules/persistence/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  }
});
