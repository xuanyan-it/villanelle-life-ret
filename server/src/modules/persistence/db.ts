import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { institutesTable, recordsTable, usersTable } from "./schema";
import { evaluationJobsTable, evaluationJobItemsTable } from "./schema";

export const createDrizzleDb = (databaseUrl: string) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, {
    schema: {
      institutesTable,
      usersTable,
      recordsTable,
      evaluationJobsTable,
      evaluationJobItemsTable
    }
  });
  return { db, pool };
};
