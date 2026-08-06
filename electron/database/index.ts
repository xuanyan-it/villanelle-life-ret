import crypto from "crypto";
import argon2 from "argon2";
import { app } from "electron";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import { getElectronLogger } from "../infrastructure/logger";
import type { SampleRecord } from "../types";

const NODE_ENV = app.isPackaged ? "production" : "development";
let DB_PATH: string;
const logger = getElectronLogger();

export { DB_PATH };
const getDevRoot = () => {
  if (app && typeof app.getAppPath === "function") {
    return app.getAppPath();
  }
  return process.cwd();
};

const getPortableDir = () => {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  if (app && typeof app.getPath === "function") {
    return path.dirname(app.getPath("exe"));
  }
  return process.cwd();
};

if (NODE_ENV === "development") {
  // The current application directory should be the root project dir
  DB_PATH = path.join(getDevRoot(), "./build/electron/database/db.db");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const legacyDbPath = path.join(path.dirname(app.getPath("exe")), "db.db");
  if (!fs.existsSync(DB_PATH) && fs.existsSync(legacyDbPath)) {
    fs.copyFileSync(legacyDbPath, DB_PATH);
    logger.info("[db] migrated legacy development database", {
      from: legacyDbPath,
      to: DB_PATH,
    });
  }
  logger.info("[db] resolved path", { nodeEnv: NODE_ENV, dbPath: DB_PATH });
} else {
  const portableDir = getPortableDir();
  DB_PATH = path.join(portableDir, "db.db");
  logger.info("[db] resolved path", { nodeEnv: NODE_ENV, dbPath: DB_PATH });
}

export const db = new sqlite3.Database(DB_PATH, (err: Error | null) => {
  if (err) {
    logger.error("[db] open failed", { error: err.message });
    return err;
  } else {
    logger.info("[db] opened");
  }
});

export const createDataTable = async () => {
  await new Promise((res, rej) => {
    db.serialize(() => {
      db.run(
        "create table if not exists sampleRecord (\
        id INTEGER PRIMARY KEY AUTOINCREMENT,\
        uuid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),\
        hospitalName TEXT NOT NULL,\
        doctorName TEXT DEFAULT '',\
        patientName TEXT DEFAULT '',\
        patientAge TEXT DEFAULT '',\
        patientGender TEXT NOT NULL,\
        uploadId TEXT DEFAULT '',\
        slideFileName TEXT NOT NULL,\
        slideId TEXT NOT NULL,\
        samplingDate TEXT NOT NULL,\
        receptionDate TEXT NOT NULL,\
        testDate TEXT NOT NULL,\
        modelType TEXT DEFAULT '3class',\
        generateHeatmap INTEGER DEFAULT 0,\
        testerName TEXT NOT NULL,\
        otherInfo TEXT DEFAULT '',\
        instituteName TEXT NOT NULL,\
        result TEXT DEFAULT '',\
        isDeleted INTEGER DEFAULT 0,\
        reviewerName TEXT DEFAULT ''\
        );",
        (err: Error | null) => {
          if (err) {
            logger.error("[db] create sampleRecord table failed", { error: err.message });
            rej(err);
          } else {
            logger.info("[db] sampleRecord table ready");
            res("sampleRecord table create successful");
          }
        }
      );
    });
  });
  await ensureEvaluationJobTables();
  return "sampleRecord table create successful";
};

const run = (sql: string, params: Array<string | number | null> = []) => {
  return new Promise<sqlite3.RunResult>((res, rej) => {
    db.run(sql, params, function (err: Error | null) {
      if (err) {
        rej(err);
      } else {
        res(this);
      }
    });
  });
};

const get = <T = any>(sql: string, params: Array<string | number | null> = []) => {
  return new Promise<T | undefined>((res, rej) => {
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) {
        rej(err);
      } else {
        res(row);
      }
    });
  });
};

const all = <T = any>(sql: string, params: Array<string | number | null> = []) => {
  return new Promise<T[]>((res, rej) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) {
        rej(err);
      } else {
        res(rows ?? []);
      }
    });
  });
};

export type EvaluationJobStatus =
  | "pending"
  | "evaluating"
  | "succeeded"
  | "failed"
  | "cancelled";

export type EvaluationJobRow = {
  id: number;
  jobUuid: string;
  instituteName: string;
  createdByUsername: string;
  status: EvaluationJobStatus;
  cancelRequested: number;
  progressPercent: number;
  recordUuid: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type EvaluationJobItemRow = {
  id: number;
  evaluationJobUuid: string;
  itemSeqNo: number;
  itemStatus: EvaluationJobStatus;
  recordUuid: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export const ensureEvaluationJobTables = async () => {
  await run(
    "create table if not exists evaluation_job (\
      id INTEGER PRIMARY KEY AUTOINCREMENT,\
      jobUuid TEXT NOT NULL UNIQUE,\
      instituteName TEXT NOT NULL,\
      createdByUsername TEXT NOT NULL DEFAULT '',\
      status TEXT NOT NULL,\
      cancelRequested INTEGER NOT NULL DEFAULT 0,\
      progressPercent INTEGER NOT NULL DEFAULT 0,\
      recordUuid TEXT NOT NULL DEFAULT '',\
      errorMessage TEXT NOT NULL DEFAULT '',\
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),\
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))\
    );"
  );
  await run(
    "create table if not exists evaluation_job_item (\
      id INTEGER PRIMARY KEY AUTOINCREMENT,\
      evaluationJobUuid TEXT NOT NULL,\
      itemSeqNo INTEGER NOT NULL,\
      itemStatus TEXT NOT NULL,\
      recordUuid TEXT NOT NULL DEFAULT '',\
      errorMessage TEXT NOT NULL DEFAULT '',\
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),\
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),\
      UNIQUE(evaluationJobUuid, itemSeqNo)\
    );"
  );
  await run(
    "CREATE INDEX IF NOT EXISTS idx_evaluation_job_scope_active ON evaluation_job(instituteName, createdByUsername, status)"
  );
  await run(
    "CREATE INDEX IF NOT EXISTS idx_evaluation_job_item_job_seq ON evaluation_job_item(evaluationJobUuid, itemSeqNo)"
  );
};

export const createEvaluationJob = async (params: {
  jobUuid: string;
  instituteName: string;
  createdByUsername: string;
  status: EvaluationJobStatus;
}) => {
  await run(
    "INSERT INTO evaluation_job (jobUuid, instituteName, createdByUsername, status, cancelRequested, progressPercent, recordUuid, errorMessage) VALUES (?,?,?,?,0,0,'','')",
    [params.jobUuid, params.instituteName, params.createdByUsername, params.status]
  );
  return getEvaluationJobByUuid(params.jobUuid);
};

export const createEvaluationJobItems = async (params: {
  jobUuid: string;
  totalCount: number;
}) => {
  for (let i = 0; i < params.totalCount; i++) {
    await run(
      "INSERT INTO evaluation_job_item (evaluationJobUuid, itemSeqNo, itemStatus, recordUuid, errorMessage) VALUES (?,?,'pending','','')",
      [params.jobUuid, i]
    );
  }
  return listEvaluationJobItems(params.jobUuid);
};

export const getEvaluationJobByUuid = async (jobUuid: string) => {
  return get<EvaluationJobRow>(
    "SELECT * FROM evaluation_job WHERE jobUuid = ?",
    [jobUuid]
  );
};

export const listEvaluationJobItems = async (jobUuid: string) => {
  return all<EvaluationJobItemRow>(
    "SELECT * FROM evaluation_job_item WHERE evaluationJobUuid = ? ORDER BY itemSeqNo ASC",
    [jobUuid]
  );
};

export const findActiveEvaluationJob = async (params: {
  instituteName: string;
  createdByUsername: string;
}) => {
  return get<EvaluationJobRow>(
    "SELECT * FROM evaluation_job WHERE instituteName = ? AND createdByUsername = ? AND status IN ('pending','evaluating') ORDER BY id DESC LIMIT 1",
    [params.instituteName, params.createdByUsername]
  );
};

/** Returns the oldest pending evaluation job (FIFO queue order). */
export const findNextPendingJob = async (params: {
  instituteName: string;
  createdByUsername: string;
}) => {
  return get<EvaluationJobRow>(
    "SELECT * FROM evaluation_job WHERE instituteName = ? AND createdByUsername = ? AND status = 'pending' ORDER BY id ASC LIMIT 1",
    [params.instituteName, params.createdByUsername]
  );
};

/** Lists all active evaluation jobs (pending + evaluating) for an institute/user. */
export const listActiveEvaluationJobs = async (params: {
  instituteName: string;
  createdByUsername: string;
}) => {
  return all<EvaluationJobRow>(
    "SELECT * FROM evaluation_job WHERE instituteName = ? AND createdByUsername = ? AND status IN ('pending','evaluating') ORDER BY id ASC",
    [params.instituteName, params.createdByUsername]
  );
};

export const updateEvaluationJob = async (params: {
  jobUuid: string;
  status?: EvaluationJobStatus;
  cancelRequested?: number;
  progressPercent?: number;
  recordUuid?: string;
  errorMessage?: string;
}) => {
  const sets: string[] = [];
  const values: Array<string | number | null> = [];
  if (typeof params.status === "string") {
    sets.push("status = ?");
    values.push(params.status);
  }
  if (typeof params.cancelRequested === "number") {
    sets.push("cancelRequested = ?");
    values.push(params.cancelRequested);
  }
  if (typeof params.progressPercent === "number") {
    sets.push("progressPercent = ?");
    values.push(params.progressPercent);
  }
  if (typeof params.recordUuid === "string") {
    sets.push("recordUuid = ?");
    values.push(params.recordUuid);
  }
  if (typeof params.errorMessage === "string") {
    sets.push("errorMessage = ?");
    values.push(params.errorMessage);
  }
  if (sets.length === 0) {
    return getEvaluationJobByUuid(params.jobUuid);
  }
  sets.push("updatedAt = datetime('now')");
  values.push(params.jobUuid);
  await run(
    `UPDATE evaluation_job SET ${sets.join(", ")} WHERE jobUuid = ?`,
    values
  );
  return getEvaluationJobByUuid(params.jobUuid);
};

export const updateEvaluationJobItem = async (params: {
  jobUuid: string;
  itemSeqNo: number;
  itemStatus?: EvaluationJobStatus;
  recordUuid?: string;
  errorMessage?: string;
}) => {
  const sets: string[] = [];
  const values: Array<string | number | null> = [];
  if (typeof params.itemStatus === "string") {
    sets.push("itemStatus = ?");
    values.push(params.itemStatus);
  }
  if (typeof params.recordUuid === "string") {
    sets.push("recordUuid = ?");
    values.push(params.recordUuid);
  }
  if (typeof params.errorMessage === "string") {
    sets.push("errorMessage = ?");
    values.push(params.errorMessage);
  }
  if (sets.length === 0) {
    return;
  }
  sets.push("updatedAt = datetime('now')");
  values.push(params.jobUuid, params.itemSeqNo);
  await run(
    `UPDATE evaluation_job_item SET ${sets.join(", ")} WHERE evaluationJobUuid = ? AND itemSeqNo = ?`,
    values
  );
};

export const listPendingOrEvaluatingItems = async (jobUuid: string) => {
  return all<EvaluationJobItemRow>(
    "SELECT * FROM evaluation_job_item WHERE evaluationJobUuid = ? AND itemStatus IN ('pending','evaluating') ORDER BY itemSeqNo ASC",
    [jobUuid]
  );
};

export const cancelPendingOrEvaluatingItems = async (jobUuid: string) => {
  await run(
    "UPDATE evaluation_job_item SET itemStatus = 'cancelled', recordUuid = '', errorMessage = '', updatedAt = datetime('now') WHERE evaluationJobUuid = ? AND itemStatus IN ('pending','evaluating')",
    [jobUuid]
  );
};

/** Cancel all pending jobs (not yet evaluating) for a given institute/user.
 *  Returns the UUIDs of the cancelled jobs so the caller can clean up drafts. */
export const cancelAllPendingJobs = async (params: {
  instituteName: string;
  createdByUsername: string;
}): Promise<string[]> => {
  const rows = await all<{ jobUuid: string }>(
    "SELECT jobUuid FROM evaluation_job WHERE instituteName = ? AND createdByUsername = ? AND status = 'pending'",
    [params.instituteName, params.createdByUsername]
  );
  if (rows.length === 0) return [];
  const uuids = rows.map((r) => r.jobUuid);
  const placeholders = uuids.map(() => "?").join(",");
  await run(
    `UPDATE evaluation_job SET status = 'cancelled', cancelRequested = 1, errorMessage = '已被更新的任务取代', updatedAt = datetime('now') WHERE jobUuid IN (${placeholders})`,
    uuids
  );
  // Also cancel their items
  for (const uuid of uuids) {
    await cancelPendingOrEvaluatingItems(uuid);
  }
  return uuids;
};

const generateToken = () => {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
};

export type LocalUserRecord = {
  uuid: string;
  instituteName: string;
  username: string;
  email: string;
  password: string;
  passHash?: string;
  userRole: string;
};

export type InstituteRecord = {
  uuid: string;
  instituteName: string;
  token: string;
};

export const createAuthTables = async () => {
  const instituteTableSQL =
    "create table if not exists institute (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    uuid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),\
    instituteName TEXT NOT NULL UNIQUE,\
    token TEXT NOT NULL,\
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))\
    );";
  const userTableSQL =
    "create table if not exists user (\
    id INTEGER PRIMARY KEY AUTOINCREMENT,\
    uuid TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),\
    instituteName TEXT NOT NULL,\
    username TEXT NOT NULL,\
    email TEXT NOT NULL UNIQUE,\
    password TEXT NOT NULL,\
    userRole TEXT NOT NULL,\
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))\
    );";
  await run(instituteTableSQL);
  const instituteColumns = await all<{ name: string }>("PRAGMA table_info(institute)");
  const hasToken = instituteColumns.some((column) => column.name === "token");
  const hasInstituteToken = instituteColumns.some((column) => column.name === "instituteToken");
  const hasAuthorizationToken = instituteColumns.some((column) => column.name === "authorizationToken");
  if (!hasToken) {
    await run("ALTER TABLE institute ADD COLUMN token TEXT");
  }
  if (hasInstituteToken && hasAuthorizationToken) {
    await run("UPDATE institute SET token = COALESCE(token, instituteToken, authorizationToken)");
  } else if (hasInstituteToken) {
    await run("UPDATE institute SET token = COALESCE(token, instituteToken)");
  } else if (hasAuthorizationToken) {
    await run("UPDATE institute SET token = COALESCE(token, authorizationToken)");
  }
  if (hasInstituteToken) {
    try {
      await run("ALTER TABLE institute DROP COLUMN instituteToken");
    } catch {}
  }
  if (hasAuthorizationToken) {
    try {
      await run("ALTER TABLE institute DROP COLUMN authorizationToken");
    } catch {}
  }
  await run(userTableSQL);
  const userColumns = await all<{ name: string }>("PRAGMA table_info(user)");
  const hasPassHash = userColumns.some((column) => column.name === "passHash");
  if (!hasPassHash) {
    await run("ALTER TABLE user ADD COLUMN passHash TEXT NOT NULL DEFAULT ''");
  }
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON user(username)");
  return "auth tables create successful";
};

export const getInstituteByName = async (instituteName: string) => {
  return await get<InstituteRecord>(
    "SELECT * FROM institute WHERE instituteName = ?",
    [instituteName]
  );
};

export const listInstitutes = async (filters: {
  uuid?: string;
  instituteName?: string;
  token?: string;
}) => {
  const where: string[] = [];
  const values: Array<string | number | null> = [];
  if (filters.uuid) {
    where.push("uuid = ?");
    values.push(filters.uuid);
  }
  if (filters.instituteName) {
    where.push("instituteName = ?");
    values.push(filters.instituteName);
  }
  if (filters.token) {
    where.push("token = ?");
    values.push(filters.token);
  }
  const whereSQL = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";
  return await all<InstituteRecord>(`SELECT * FROM institute${whereSQL} ORDER BY id DESC`, values);
};

export const createInstitute = async (instituteName: string) => {
  const existing = await getInstituteByName(instituteName);
  if (existing) {
    throw new Error(SharedClientErrorMessage.instituteExists);
  }
  const token = generateToken();
  await run(
    "INSERT INTO institute (instituteName, token) VALUES (?,?)",
    [instituteName, token]
  );
  return await getInstituteByName(instituteName);
};

export const verifyInstituteToken = async (token: string) => {
  return await listInstitutes({ token });
};

export const ensureInstitute = async (instituteName: string) => {
  const existing = await getInstituteByName(instituteName);
  if (existing) {
    return existing;
  }
  return await createInstitute(instituteName);
};

export const createUser = async (params: {
  instituteName: string;
  username: string;
  email: string;
  password: string;
  userRole: string;
}) => {
  const { instituteName, username, email, password, userRole } = params;
  const existingByEmail = await get<LocalUserRecord>(
    "SELECT * FROM user WHERE email = ?",
    [email]
  );
  if (existingByEmail) {
    throw new Error(SharedClientErrorMessage.emailExists);
  }
  const existingByName = await get<LocalUserRecord>(
    "SELECT * FROM user WHERE username = ?",
    [username]
  );
  if (existingByName) {
    throw new Error(SharedClientErrorMessage.usernameExists);
  }
  const passHash = await argon2.hash(password, { type: argon2.argon2id });
  await run(
    "INSERT INTO user (instituteName, username, email, password, passHash, userRole) VALUES (?,?,?,?,?,?)",
    [instituteName, username, email, "", passHash, userRole]
  );
  return await get<LocalUserRecord>("SELECT * FROM user WHERE email = ?", [
    email,
  ]);
};

export const verifyUser = async (email: string, password: string) => {
  const user = await get<LocalUserRecord>("SELECT * FROM user WHERE email = ?", [
    email,
  ]);
  if (!user) {
    return null;
  }
  if (typeof user.passHash === "string" && user.passHash.length > 0) {
    const matched = await argon2.verify(user.passHash, password);
    return matched ? user : null;
  }
  if (user.password !== password) {
    return null;
  }
  const migratedPassHash = await argon2.hash(password, { type: argon2.argon2id });
  await run("UPDATE user SET passHash = ?, password = '' WHERE uuid = ?", [migratedPassHash, user.uuid]);
  user.passHash = migratedPassHash;
  user.password = "";
  return user;
};

export const listUsers = async (filters: {
  uuid?: string;
  email?: string;
  username?: string;
  instituteName?: string;
  userRole?: string;
}) => {
  const where: string[] = [];
  const values: Array<string | number | null> = [];
  if (filters.uuid) {
    where.push("uuid = ?");
    values.push(filters.uuid);
  }
  if (filters.email) {
    where.push("email = ?");
    values.push(filters.email);
  }
  if (filters.username) {
    where.push("username = ?");
    values.push(filters.username);
  }
  if (filters.instituteName) {
    where.push("instituteName = ?");
    values.push(filters.instituteName);
  }
  if (filters.userRole) {
    where.push("userRole = ?");
    values.push(filters.userRole);
  }
  const whereSQL = where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "";
  return await all<
    Pick<LocalUserRecord, "uuid" | "username" | "email" | "userRole">
  >(
    `SELECT uuid, username, email, userRole FROM user${whereSQL} ORDER BY id DESC`,
    values
  );
};

export const listUsersByInstitute = async (instituteName: string) => {
  return await listUsers({ instituteName });
};

export const deleteUsersByUuids = async (uuids: string[]) => {
  for (const uuid of uuids) {
    await run("DELETE FROM user WHERE uuid = ?", [uuid]);
  }
  return true;
};

export const hasLocalUsers = async () => {
  const row = await get<{ total: number }>(
    "SELECT COUNT(*) as total FROM user"
  );
  return Number(row?.total ?? 0) > 0;
};

/**
 * Sample Records
 */
export const fetchSampleRecords = async (params: {
  instituteName: string;
  page?: number;
  pageSize?: number;
  deletedOnly?: boolean;
  searchKeyword?: string;
}): Promise<{ total: number; rows: SampleRecord[] }> => {
  return new Promise((res, rej) => {
    const page =
      params?.page && Number.isFinite(params.page) ? params.page : 1;
    const pageSize =
      params?.pageSize && Number.isFinite(params.pageSize)
        ? params.pageSize
        : undefined;

    const instituteName = params?.instituteName ?? "";
    const isDeletedValue = params?.deletedOnly ? 1 : 0;
    const searchKeyword = params?.searchKeyword?.trim() ?? "";
    const hasSearchKeyword = searchKeyword.length > 0;
    const whereSQL = hasSearchKeyword
      ? "WHERE instituteName = ? AND isDeleted = ? AND (patientName LIKE ? OR slideId LIKE ?)"
      : "WHERE instituteName = ? AND isDeleted = ?";
    const whereValues: Array<string | number> = [instituteName, isDeletedValue];
    if (hasSearchKeyword) {
      const like = `%${searchKeyword}%`;
      whereValues.push(like, like);
    }

    const countSQL = `SELECT COUNT(*) as total FROM sampleRecord ${whereSQL}`;
    const dataSQLBase = `SELECT * FROM sampleRecord ${whereSQL} ORDER BY testDate DESC, id DESC`;
    const dataSQL = pageSize
      ? `${dataSQLBase} LIMIT ? OFFSET ?`
      : dataSQLBase;
    const dataValues = pageSize
      ? [...whereValues, pageSize, (page - 1) * pageSize]
      : whereValues;

    db.serialize(() => {
      db.get(
        countSQL,
        whereValues,
        (countErr: Error | null, countRow: any) => {
          if (countErr) {
            logger.warn("[db] query sample record count failed", { error: countErr.message });
            rej(countErr);
            return;
          }
          const total = Number(countRow?.total ?? 0);
          db.all(
            dataSQL,
            dataValues,
            (err: Error | null, rows: any[]) => {
              if (err) {
                logger.warn("[db] query sample record rows failed", { error: err.message });
                rej(err);
              } else {
                logger.info("[db] query sample record rows succeeded");
                const normalizedRows = rows.map((rawRow) => {
                  const row =
                    typeof rawRow === "object" && rawRow !== null ? rawRow : {};
                  return {
                    ...row,
                    doctorName: row.doctorName ?? "",
                    patientName: row.patientName ?? "",
                    patientAge: row.patientAge ?? "",
                    otherInfo: row.otherInfo ?? "",
                    isDeleted: Number((row as any).isDeleted ?? 0),
                  };
                });
                res({ total, rows: normalizedRows as SampleRecord[] });
              }
            }
          );
        }
      );
    });
  });
};

/* lack batch create */
export const createSampleRecords = async (
  record: Omit<SampleRecord, "uuid">
): Promise<SampleRecord> => {
  return new Promise((res, rej) => {
    const {
      hospitalName,
      doctorName = "",
      patientName = "",
      patientAge = "",
      patientGender,
      uploadId = "",
      slideFileName,
      slideId,
      samplingDate,
      receptionDate,
      testDate,
      modelType = "3class",
      generateHeatmap = 0,
      testerName,
      otherInfo = "",
      instituteName,
      result = "",
      isDeleted = 0,
      reviewerName = "",
    } = record as any;
    const insertSQL = `INSERT INTO sampleRecord (\
      hospitalName,\
      doctorName,\
      patientName,\
      patientAge,\
      patientGender,\
      uploadId,\
      slideFileName,\
      slideId,\
      samplingDate,\
      receptionDate,\
      testDate,\
      modelType,\
      generateHeatmap,\
      testerName,\
      otherInfo,\
      instituteName,\
      result,\
      isDeleted,\
      reviewerName\
    ) VALUES (\
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?\
    );`;
    db.serialize(() => {
      db.run(
        insertSQL,
        [
          hospitalName,
          doctorName,
          patientName,
          patientAge,
          patientGender,
          uploadId,
          slideFileName,
          slideId,
          samplingDate,
          receptionDate,
          testDate,
          modelType,
          generateHeatmap ? 1 : 0,
          testerName,
          otherInfo,
          instituteName,
          result,
          isDeleted,
          reviewerName,
        ],
        function (err) {
          if (err) {
            logger.warn("[db] insert sample record failed", { error: err.message });
            rej(err);
          } else {
            const insertedId = this.lastID;
            db.get(
              "SELECT * FROM sampleRecord WHERE id = ?",
              [insertedId],
              (err, row) => {
                if (err || !row) {
                  rej(err || new Error("No row fetched after insert"));
                } else {
                  res({
                    ...(row as SampleRecord),
                    isDeleted: Number((row as any).isDeleted ?? 0),
                  });
                }
              }
            );
          }
        }
      );
    });
  });
};

/* missing batch update */
export const updateSampleRecords = async (record: SampleRecord) => {
  return new Promise((res, rej) => {
    const {
      uuid,
      hospitalName,
      doctorName = "",
      patientName = "",
      patientAge = "",
      patientGender,
      uploadId = "",
      slideFileName,
      slideId,
      samplingDate,
      receptionDate,
      testDate,
      modelType = "3class",
      generateHeatmap = 0,
      testerName,
      otherInfo = "",
      instituteName,
      result = "",
      isDeleted = 0,
      reviewerName,
    } = record as any;
    const updateSQL =
      "UPDATE sampleRecord SET \
      hospitalName = ?,\
      doctorName = ?,\
      patientName = ?,\
      patientAge = ?,\
      patientGender = ?,\
      uploadId = ?,\
      slideFileName = ?,\
      slideId = ?,\
      samplingDate = ?,\
      receptionDate = ?,\
      testDate = ?,\
      modelType = ?,\
      generateHeatmap = ?,\
      testerName = ?,\
      otherInfo = ?,\
      instituteName = ?,\
      result = ?,\
      isDeleted = ?,\
      reviewerName = ?\
      WHERE \
      uuid = ?";
    db.serialize(() => {
      db.run(
        updateSQL,
        [
          hospitalName,
          doctorName,
          patientName,
          patientAge,
          patientGender,
          uploadId,
          slideFileName,
          slideId,
          samplingDate,
          receptionDate,
          testDate,
          modelType,
          generateHeatmap ? 1 : 0,
          testerName,
          otherInfo,
          instituteName,
          result,
          isDeleted,
          reviewerName,
          // condition
          uuid,
        ],
        (err) => {
          if (err) {
            logger.warn("[db] update sample record failed", { error: err.message });
            rej(err);
          } else {
            logger.info("[db] sample record updated", { uuid });
            res(true);
          }
        }
      );
    });
  });
};

/* missing batch delete */

export const deleteSampleRecords = (record: Pick<SampleRecord, "uuid">) => {
  return new Promise((res, rej) => {
    const { uuid } = record;
    const deleteSQL = "UPDATE sampleRecord SET isDeleted = 1 WHERE uuid = ?";
    db.serialize(() => {
      db.serialize(() => {
        db.run(deleteSQL, [uuid], (err) => {
          if (err) {
            logger.warn("[db] delete sample record failed", { error: err.message, uuid });
            rej(err);
          } else {
            logger.info("[db] sample record soft deleted", { uuid });
            res(true);
          }
        });
      });
    });
  });
};

export const deleteSampleRecordsByUuids = async (uuids: string[]) => {
  for (const uuid of uuids) {
    await run("DELETE FROM sampleRecord WHERE uuid = ?", [uuid]);
  }
  return true;
};
export const checkDatabaseStatus = () => {
  db.close();
  return new Promise((res, rej) => {
    let connection = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        res("connection successful");
      } else {
        rej("connection failed");
      }
    });
  });
};

export const getDBPath = () => {
  return DB_PATH;
};
