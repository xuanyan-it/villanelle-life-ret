import { randomBytes, randomUUID } from "node:crypto";

import * as argon2 from "argon2";
import { and, asc, desc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";

import type { InstituteCredential } from "@villanelle/ret-shared/application";
import type { QueryResult, SampleRecord, User, UserRole } from "@villanelle/ret-shared/domain";

import { createDrizzleDb } from "./db";
import type {
  InstituteFilters,
  PersistenceRepository,
  RecordCreatePayload,
  RecordUpdatePayload,
  UserFilters
} from "./persistence.repository.types";
import { institutesTable, recordsTable, usersTable } from "./schema";
import { PersistenceConflictError } from "./persistence.repository.types";

type UserRow = typeof usersTable.$inferSelect;
type InstituteRow = typeof institutesTable.$inferSelect;
type RecordRow = typeof recordsTable.$inferSelect;

const REQUIRED_SCHEMA = {
  institute: ["id", "uuid", "institute_name", "token", "created_at", "is_deleted"],
  user: [
    "id",
    "uuid",
    "institute_name",
    "user_role",
    "email",
    "username",
    "pass_hash",
    "created_at",
    "updated_at",
    "last_login_at",
    "is_activated"
  ],
  record: [
    "id",
    "uuid",
    "hospital_name",
    "doctor_name",
    "patient_name",
    "patient_age",
    "patient_gender",
    "upload_id",
    "slide_file_name",
    "slide_id",
    "sampling_date",
    "reception_date",
    "test_date",
    "model_type",
    "generate_heatmap",
    "tester_name",
    "checker_name",
    "reviewer_name",
    "other_info",
    "result",
    "institute_name",
    "is_deleted"
  ]
} as const;

const mapUser = (row: UserRow): User => ({
  id: Number(row.id),
  uuid: String(row.uuid),
  instituteName: String(row.instituteName ?? ""),
  userRole: String(row.userRole ?? "operator") as UserRole,
  email: String(row.email ?? ""),
  username: String(row.username ?? ""),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  lastLoginAt: row.lastLoginAt.toISOString(),
  isActivated: Boolean(row.isActivated)
});

const mapInstitute = (row: InstituteRow): InstituteCredential => ({
  id: Number(row.id),
  uuid: String(row.uuid),
  instituteName: String(row.instituteName),
  token: String(row.token),
  createdAt: String(row.createdAt),
  isDeleted: Number(row.isDeleted)
});

const mapRecord = (row: RecordRow): SampleRecord => ({
  id: Number(row.id),
  uuid: String(row.uuid),
  hospitalName: String(row.hospitalName ?? ""),
  doctorName: String(row.doctorName ?? ""),
  patientName: String(row.patientName ?? ""),
  patientAge: String(row.patientAge ?? ""),
  patientGender: String(row.patientGender ?? ""),
  uploadId: String(row.uploadId),
  slideFileName: String(row.slideFileName),
  slideId: String(row.slideId),
  samplingDate: String(row.samplingDate ?? ""),
  receptionDate: String(row.receptionDate ?? ""),
  testDate: String(row.testDate ?? ""),
  modelType: String(row.modelType ?? "3class") as SampleRecord["modelType"],
  generateHeatmap: Boolean(row.generateHeatmap),
  testerName: String(row.testerName ?? ""),
  checkerName: String(row.checkerName ?? ""),
  reviewerName: String(row.reviewerName ?? ""),
  otherInfo: String(row.otherInfo ?? ""),
  result: String(row.result ?? ""),
  instituteName: String(row.instituteName ?? ""),
  isDeleted: Number(row.isDeleted ?? 0)
});

export class PostgresPersistenceRepository implements PersistenceRepository {
  private readonly db: ReturnType<typeof createDrizzleDb>["db"];
  private readonly pool: ReturnType<typeof createDrizzleDb>["pool"];
  private schemaReady = false;

  constructor(databaseUrl: string) {
    const { db, pool } = createDrizzleDb(databaseUrl);
    this.db = db;
    this.pool = pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private isUniqueViolation(error: unknown): error is { code: string; constraint?: string } {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
  }

  private mapConflict(error: unknown): PersistenceConflictError | null {
    if (!this.isUniqueViolation(error)) {
      return null;
    }
    switch (error.constraint) {
      case "user_email_unique":
        return new PersistenceConflictError("email");
      case "user_username_unique":
        return new PersistenceConflictError("username");
      case "institute_institute_name_unique":
        return new PersistenceConflictError("instituteName");
      case "institute_token_unique":
        return new PersistenceConflictError("token");
      default:
        return null;
    }
  }

  private generateInstituteToken(length = 16): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(length);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    const requiredTables = Object.keys(REQUIRED_SCHEMA);
    const result = await this.pool.query<{
      table_name: string;
      column_name: string;
    }>(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ANY($1::text[])
      `,
      [requiredTables]
    );
    const rows = result.rows ?? [];
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      const tableColumns = columnsByTable.get(row.table_name) ?? new Set<string>();
      tableColumns.add(row.column_name);
      columnsByTable.set(row.table_name, tableColumns);
    }

    const missing: string[] = [];
    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
      const tableColumns = columnsByTable.get(tableName);
      if (!tableColumns) {
        missing.push(`table ${tableName}`);
        continue;
      }
      for (const columnName of requiredColumns) {
        if (!tableColumns.has(columnName)) {
          missing.push(`${tableName}.${columnName}`);
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `database schema is not initialized: missing ${missing.join(", ")}; run pnpm --filter @villanelle/ret-server db:migrate`
      );
    }
    this.schemaReady = true;
  }

  private firstOrThrow<T>(rows: T[], message: string): T {
    const row = rows[0];
    if (!row) {
      throw new Error(message);
    }
    return row;
  }

  async listUsers(filters: UserFilters): Promise<QueryResult<User>> {
    await this.ensureSchema();
    const where: SQL<unknown>[] = [];
    if (filters.uuid) where.push(eq(usersTable.uuid, filters.uuid));
    if (filters.email) where.push(eq(usersTable.email, filters.email));
    if (filters.username) where.push(eq(usersTable.username, filters.username));
    if (filters.instituteName) where.push(eq(usersTable.instituteName, filters.instituteName));
    if (filters.userRole) where.push(eq(usersTable.userRole, filters.userRole));
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(usersTable.userRole), asc(usersTable.id));
    const result = rows.map(mapUser);
    return { total: result.length, result };
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureSchema();
    const row = await this.db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    return row[0] ? mapUser(row[0]) : undefined;
  }

  async findUserByUsername(username: string): Promise<User | undefined> {
    await this.ensureSchema();
    const row = await this.db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    return row[0] ? mapUser(row[0]) : undefined;
  }

  async loginUser(email: string, password: string): Promise<User | undefined> {
    await this.ensureSchema();
    const row = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (!row[0]) return undefined;
    const matched = await argon2.verify(row[0].passHash, password);
    return matched ? mapUser(row[0]) : undefined;
  }

  async createUser(input: {
    instituteName: string;
    email: string;
    username: string;
    password: string;
    userRole: UserRole;
  }): Promise<User> {
    await this.ensureSchema();
    const passHash = await argon2.hash(input.password, { type: argon2.argon2id });
    let rows;
    try {
      rows = await this.db
        .insert(usersTable)
        .values({
          uuid: randomUUID(),
          instituteName: input.instituteName,
          userRole: input.userRole,
          email: input.email,
          username: input.username,
          passHash,
          isActivated: true
        })
        .returning();
    } catch (error) {
      const conflict = this.mapConflict(error);
      if (conflict) {
        throw conflict;
      }
      throw error;
    }
    return mapUser(this.firstOrThrow(rows, "failed to create user"));
  }

  async deleteUsers(uuids: string[]): Promise<boolean> {
    if (uuids.length === 0) return true;
    await this.ensureSchema();
    const rows = await this.db
      .delete(usersTable)
      .where(inArray(usersTable.uuid, uuids))
      .returning({ uuid: usersTable.uuid });
    return rows.length === uuids.length;
  }

  async listInstitutes(filters: InstituteFilters): Promise<QueryResult<InstituteCredential>> {
    await this.ensureSchema();
    const where: SQL<unknown>[] = [eq(institutesTable.isDeleted, 0)];
    if (filters.uuid) where.push(eq(institutesTable.uuid, filters.uuid));
    if (filters.instituteName) where.push(eq(institutesTable.instituteName, filters.instituteName));
    if (filters.token) where.push(eq(institutesTable.token, filters.token));
    const rows = await this.db
      .select()
      .from(institutesTable)
      .where(and(...where))
      .orderBy(desc(institutesTable.id));
    const result = rows.map(mapInstitute);
    return { total: result.length, result };
  }

  async createInstitute(instituteName: string): Promise<InstituteCredential> {
    await this.ensureSchema();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const rows = await this.db
          .insert(institutesTable)
          .values({
            uuid: randomUUID(),
            instituteName,
            token: this.generateInstituteToken(),
            createdAt: new Date().toISOString(),
            isDeleted: 0
          })
          .returning();
        return mapInstitute(this.firstOrThrow(rows, "failed to create institute"));
      } catch (error) {
        const conflict = this.mapConflict(error);
        if (!conflict) {
          throw error;
        }
        if (conflict.field === "token" && attempt < 4) {
          continue;
        }
        throw conflict;
      }
    }
    throw new Error("failed to create institute");
  }

  async verifyToken(token: string): Promise<QueryResult<InstituteCredential>> {
    await this.ensureSchema();
    const rows = await this.db
      .select()
      .from(institutesTable)
      .where(
        and(
          eq(institutesTable.isDeleted, 0),
          eq(institutesTable.token, token)
        )
      )
      .orderBy(desc(institutesTable.id));
    const result = rows.map(mapInstitute);
    return { total: result.length, result };
  }

  async listRecords(params: {
    instituteName: string;
    page: number;
    pageSize: number;
    deletedOnly?: boolean;
    searchKeyword?: string;
  }): Promise<QueryResult<SampleRecord>> {
    await this.ensureSchema();
    const page = Math.max(1, params.page);
    const pageSize = Math.max(1, params.pageSize);
    const deletedFlag = params.deletedOnly ? 1 : 0;
    const keyword = params.searchKeyword?.trim();
    const keywordCondition = keyword
      ? or(
          ilike(recordsTable.patientName, `%${keyword}%`),
          ilike(recordsTable.slideFileName, `%${keyword}%`)
        )
      : undefined;
    const condition = and(
      eq(recordsTable.instituteName, params.instituteName),
      eq(recordsTable.isDeleted, deletedFlag),
      keywordCondition
    );
    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(recordsTable)
      .where(condition);
    const rows = await this.db
      .select()
      .from(recordsTable)
      .where(condition)
      .orderBy(desc(recordsTable.id))
      .offset((page - 1) * pageSize)
      .limit(pageSize);
    return { total: countRows[0]?.count ?? 0, result: rows.map(mapRecord) };
  }

  async createRecord(payload: RecordCreatePayload, result: string): Promise<SampleRecord> {
    await this.ensureSchema();
    const rows = await this.db
      .insert(recordsTable)
      .values({
        uuid: randomUUID(),
        hospitalName: payload.hospitalName,
        doctorName: payload.doctorName,
        patientName: payload.patientName,
        patientAge: payload.patientAge,
        patientGender: payload.patientGender,
        uploadId: payload.uploadId,
        slideFileName: payload.slideFileName,
        slideId: payload.slideId,
        samplingDate: payload.samplingDate,
        receptionDate: payload.receptionDate,
        testDate: payload.testDate,
        modelType: payload.modelType,
        generateHeatmap: payload.generateHeatmap,
        testerName: payload.testerName,
        checkerName: "",
        reviewerName: "",
        otherInfo: payload.otherInfo,
        result,
        instituteName: payload.instituteName,
        isDeleted: 0
      })
      .returning();
    return mapRecord(this.firstOrThrow(rows, "failed to create record"));
  }

  async updateRecord(payload: RecordUpdatePayload): Promise<boolean> {
    await this.ensureSchema();
    const rows = await this.db
      .update(recordsTable)
      .set({
        hospitalName: payload.hospitalName,
        doctorName: payload.doctorName,
        patientName: payload.patientName,
        patientAge: payload.patientAge,
        patientGender: payload.patientGender,
        uploadId: payload.uploadId,
        slideFileName: payload.slideFileName,
        slideId: payload.slideId,
        samplingDate: payload.samplingDate,
        receptionDate: payload.receptionDate,
        testDate: payload.testDate,
        modelType: payload.modelType,
        generateHeatmap: payload.generateHeatmap,
        testerName: payload.testerName,
        reviewerName: payload.reviewerName,
        otherInfo: payload.otherInfo,
        result: payload.result,
        instituteName: payload.instituteName,
        isDeleted: payload.isDeleted
      })
      .where(eq(recordsTable.uuid, payload.uuid))
      .returning({ uuid: recordsTable.uuid });
    return rows.length === 1;
  }

  async deleteRecords(uuids: string[]): Promise<boolean> {
    if (uuids.length === 0) return true;
    await this.ensureSchema();
    const rows = await this.db
      .update(recordsTable)
      .set({ isDeleted: 1 })
      .where(and(inArray(recordsTable.uuid, uuids), eq(recordsTable.isDeleted, 0)))
      .returning({ uuid: recordsTable.uuid });
    return rows.length === uuids.length;
  }
}
