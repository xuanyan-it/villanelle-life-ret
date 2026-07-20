import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const institutesTable = pgTable(
  "institute",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").notNull().unique(),
    instituteName: text("institute_name").notNull(),
    token: text("token").notNull(),
    createdAt: text("created_at").notNull().default(""),
    isDeleted: integer("is_deleted").notNull().default(0)
  },
  (table) => [
    uniqueIndex("institute_institute_name_unique").on(table.instituteName),
    uniqueIndex("institute_token_unique").on(table.token)
  ]
);

export const usersTable = pgTable(
  "user",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").notNull().unique(),
    instituteName: text("institute_name").notNull().default(""),
    userRole: text("user_role").notNull(),
    email: text("email").notNull().default(""),
    username: text("username").notNull().default(""),
    passHash: text("pass_hash").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    isActivated: boolean("is_activated").notNull().default(true)
  },
  (table) => [
    uniqueIndex("user_email_unique").on(table.email),
    uniqueIndex("user_username_unique").on(table.username)
  ]
);

export const recordsTable = pgTable(
  "record",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").notNull().unique(),
    hospitalName: text("hospital_name").notNull().default(""),
    doctorName: text("doctor_name").notNull().default(""),
    patientName: text("patient_name").notNull().default(""),
    patientAge: text("patient_age").notNull().default(""),
    patientGender: text("patient_gender").notNull().default(""),
    sampleId: text("sample_id").notNull().default(""),
    sampleType: text("sample_type").notNull().default(""),
    samplingDate: text("sampling_date").notNull().default(""),
    receptionDate: text("reception_date").notNull().default(""),
    testDate: text("test_date").notNull().default(""),
    RPS4Y1: text("rps4y1").notNull().default(""),
    PKHD1L1: text("pkhd1l1").notNull().default(""),
    CRABP1: text("crabp1").notNull().default(""),
    GAPDH: text("gapdh").notNull().default(""),
    testerName: text("tester_name").notNull().default(""),
    checkerName: text("checker_name").notNull().default(""),
    reviewerName: text("reviewer_name").notNull().default(""),
    otherInfo: text("other_info").notNull().default(""),
    result: text("result").notNull().default(""),
    instituteName: text("institute_name").notNull().default(""),
    isDeleted: integer("is_deleted").notNull().default(0)
  },
  (table) => [index("idx_record_institute_deleted").on(table.instituteName, table.isDeleted)]
);

// evaluation_job: 聚合一次“单条/批量评估”的会话状态（用于前端轮询恢复）。
export const evaluationJobsTable = pgTable(
  "evaluation_job",
  {
    uuid: uuid("uuid").primaryKey(),
    instituteName: text("institute_name").notNull(),
    createdByUsername: text("created_by_username").notNull().default(""),
    status: text("status").notNull().default("pending"),
    progressPercent: integer("progress_percent").notNull().default(0),
    errorMessage: text("error_message").notNull().default(""),
    recordUuid: text("record_uuid").notNull().default(""),
    cancelRequested: integer("cancel_requested").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
  },
  (table) => [index("idx_evaluation_job_institute").on(table.instituteName)]
);

// evaluation_job_item: job 下的子项（单条 MVP 也创建 1 个 item）。
export const evaluationJobItemsTable = pgTable(
  "evaluation_job_item",
  {
    id: serial("id").primaryKey(),
    uuid: uuid("uuid").notNull().unique(),
    evaluationJobUuid: uuid("evaluation_job_uuid").notNull(),
    itemSeqNo: integer("item_seq_no").notNull().default(0),
    itemStatus: text("item_status").notNull().default("pending"),
    recordUuid: text("record_uuid").notNull().default(""),
    errorMessage: text("error_message").notNull().default("")
  },
  (table) => [
    index("idx_evaluation_job_item_job").on(table.evaluationJobUuid),
    // `uuid` column already has `.unique()`, so avoid duplicating the same unique index.
  ]
);
