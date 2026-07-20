import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { test, expect, chromium, type Page } from "@playwright/test";
import argon2 from "argon2";
import electronBinary from "electron";
import sqlite3 from "sqlite3";

const repoRoot = path.resolve(__dirname, "..", "..");
const electronAppDir = path.join(repoRoot, "electron");
const electronDbPath = path.join(
  repoRoot,
  "electron",
  "build",
  "electron",
  "database",
  "db.db",
);
const rootBuildDbPath = path.join(
  repoRoot,
  "build",
  "electron",
  "database",
  "db.db",
);
const legacyDbPaths = [
  path.join(repoRoot, "db.db"),
  path.join(repoRoot, "electron", "db.db"),
  electronDbPath,
  rootBuildDbPath,
];
const cdpPort = 9222;
const e2eDownloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "ret-electron-e2e-"));

const removeDevDatabase = () => {
  for (const dbPath of legacyDbPaths) {
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { force: true });
    }
  }
  fs.mkdirSync(path.dirname(electronDbPath), { recursive: true });
  fs.rmSync(e2eDownloadDir, { recursive: true, force: true });
  fs.mkdirSync(e2eDownloadDir, { recursive: true });
};

const openDatabase = (dbPath: string) =>
  new sqlite3.Database(dbPath);

const runSql = (db: sqlite3.Database, sql: string, params: Array<string | number> = []) =>
  new Promise<void>((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const closeDatabase = (db: sqlite3.Database) =>
  new Promise<void>((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const seedReviewerFlowData = async () => {
  fs.mkdirSync(path.dirname(electronDbPath), { recursive: true });
  const db = openDatabase(electronDbPath);
  const recordUuid = "e2e-review-record-001";
  const record = {
    uuid: recordUuid,
    hospitalName: "E2E Institute",
    doctorName: "Doctor",
    patientName: "Patient",
    patientAge: "33",
    patientGender: "f",
    sampleId: "S-UPDATE-001",
    sampleType: "r",
    samplingDate: "2026-01-01",
    receptionDate: "2026-01-02",
    testDate: "2026-01-03",
    RPS4Y1: "26.1",
    PKHD1L1: "28.4",
    CRABP1: "27.5",
    GAPDH: "24.0",
    testerName: "admin01",
    otherInfo: "",
    instituteName: "E2E Institute",
    result: "0.7921",
    isDeleted: 0,
    reviewerName: "",
  } as const;
  try {
    await runSql(
      db,
      "create table if not exists institute (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE, instituteName TEXT NOT NULL UNIQUE, token TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (datetime('now')))",
    );
    await runSql(
      db,
      "create table if not exists user (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE, instituteName TEXT NOT NULL, username TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, userRole TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (datetime('now')), passHash TEXT NOT NULL DEFAULT '')",
    );
    await runSql(db, "create unique index if not exists idx_user_username on user(username)");
    await runSql(
      db,
      "create table if not exists sampleRecord (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE, hospitalName TEXT NOT NULL, doctorName TEXT DEFAULT '', patientName TEXT DEFAULT '', patientAge TEXT DEFAULT '', patientGender TEXT NOT NULL, sampleId TEXT NOT NULL, sampleType TEXT NOT NULL, samplingDate TEXT NOT NULL, receptionDate TEXT NOT NULL, testDate TEXT NOT NULL, RPS4Y1 TEXT NOT NULL, PKHD1L1 TEXT NOT NULL, CRABP1 TEXT NOT NULL, GAPDH TEXT NOT NULL, testerName TEXT NOT NULL, otherInfo TEXT DEFAULT '', instituteName TEXT NOT NULL, result TEXT DEFAULT '', isDeleted INTEGER DEFAULT 0, reviewerName TEXT DEFAULT '')",
    );

    const adminHash = await argon2.hash("E2ePass123", { type: argon2.argon2id });
    const reviewerHash = await argon2.hash("Review123", { type: argon2.argon2id });

    await runSql(
      db,
      "INSERT INTO institute (uuid, instituteName, token) VALUES (?,?,?)",
      ["e2e-institute-001", "E2E Institute", "E2E-TOKEN-001"],
    );
    await runSql(
      db,
      "INSERT INTO user (uuid, instituteName, username, email, password, passHash, userRole) VALUES (?,?,?,?,?,?,?)",
      ["e2e-admin-001", "E2E Institute", "admin01", "admin.e2e@ret.local", "", adminHash, "admin"],
    );
    await runSql(
      db,
      "INSERT INTO user (uuid, instituteName, username, email, password, passHash, userRole) VALUES (?,?,?,?,?,?,?)",
      ["e2e-reviewer-001", "E2E Institute", "reviewer", "reviewer.e2e@ret.local", "", reviewerHash, "operator"],
    );
    await runSql(
      db,
      "INSERT INTO sampleRecord (uuid, hospitalName, doctorName, patientName, patientAge, patientGender, sampleId, sampleType, samplingDate, receptionDate, testDate, RPS4Y1, PKHD1L1, CRABP1, GAPDH, testerName, otherInfo, instituteName, result, isDeleted, reviewerName) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        record.uuid,
        record.hospitalName,
        record.doctorName,
        record.patientName,
        record.patientAge,
        record.patientGender,
        record.sampleId,
        record.sampleType,
        record.samplingDate,
        record.receptionDate,
        record.testDate,
        record.RPS4Y1,
        record.PKHD1L1,
        record.CRABP1,
        record.GAPDH,
        record.testerName,
        record.otherInfo,
        record.instituteName,
        record.result,
        record.isDeleted,
        record.reviewerName,
      ],
    );
  } finally {
    await closeDatabase(db);
  }
  return record;
};

const waitForCdp = async (port: number) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`cdp port ${port} did not become ready`);
};

const waitForPage = async (getPage: () => Page | undefined) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const page = getPage();
    if (page) {
      await page.waitForLoadState("domcontentloaded");
      return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("electron window did not become ready");
};

const launchElectronApp = async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const launchEnv = {
    ...process.env,
    NODE_ENV: "development",
    RET_E2E_CDP_PORT: String(cdpPort),
    RET_E2E_SAVE_DIR: e2eDownloadDir,
  };
  delete launchEnv.ELECTRON_RUN_AS_NODE;
  const child = spawn(
    electronBinary as unknown as string,
    [electronAppDir],
    {
      cwd: repoRoot,
      env: launchEnv,
      stdio: "pipe",
    },
  );

  const capture = (buffer: Buffer, target: string[]) => {
    target.push(buffer.toString("utf8"));
  };

  child.stdout.on("data", (buffer) => capture(buffer, stdout));
  child.stderr.on("data", (buffer) => capture(buffer, stderr));

  await waitForCdp(cdpPort);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  const page = await waitForPage(() => browser.contexts()[0]?.pages()[0]);

  const close = async () => {
    await browser.close();
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.once("exit", () => resolve());
      child.kill();
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }, 5_000);
    });
  };

  const fail = (error: unknown): never => {
    const output = [...stdout, ...stderr].join("");
    throw new Error(
      `electron e2e failed: ${error instanceof Error ? error.message : String(error)}\n${output}`,
    );
  };

  return { page, close, fail };
};

const registerBootstrapAdmin = async (page: Page) => {
  await page.waitForSelector('[data-testid="register-institute-name-input"]', {
    timeout: 10_000,
  });
  await page.getByTestId("register-institute-name-input").fill("E2E Institute");
  await page.getByTestId("register-username-input").fill("admin01");
  await page.getByTestId("register-email-input").fill("admin.e2e@ret.local");
  await page.getByTestId("register-password-input").fill("E2ePass123");
  await page.getByTestId("register-password-confirm-input").fill("E2ePass123");
  await page.getByTestId("register-submit").click();
  await expect(page.getByTestId("new-record-open")).toBeVisible({
    timeout: 30_000,
  });
};

const loginLocalUser = async (page: Page, email: string, password: string) => {
  await page.waitForSelector('[data-testid="login-email-input"]', {
    timeout: 10_000,
  });
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-password-input").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("new-record-open")).toBeVisible({
    timeout: 30_000,
  });
};

test.describe("electron app e2e", () => {
  test.beforeEach(() => {
    removeDevDatabase();
  });

  test("boots first-run desktop flow and reaches the main workspace", async () => {
    let app;
    try {
      app = await launchElectronApp();
      await registerBootstrapAdmin(app.page);
    } catch (error) {
      app?.fail(error);
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  test("downloads template from desktop import dialog into the e2e save directory", async () => {
    let app;
    try {
      app = await launchElectronApp();
      await registerBootstrapAdmin(app.page);

      await app.page.getByTestId("new-record-open").click();
      await app.page.getByTestId("new-record-import-many").click();
      await app.page.getByTestId("download-template-link").click();

      const downloadedTemplate = path.join(e2eDownloadDir, "template_zh-CN.csv");
      await expect.poll(() => fs.existsSync(downloadedTemplate)).toBe(true);
      expect(fs.readFileSync(downloadedTemplate, "utf8")).toContain("sampleId");
    } catch (error) {
      app?.fail(error);
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  test("shows updated reviewer in desktop detail view after record update", async () => {
    let app;
    try {
      const seededRecord = await seedReviewerFlowData();
      app = await launchElectronApp();
      await loginLocalUser(app.page, "admin.e2e@ret.local", "E2ePass123");
      await app.page.evaluate(async (record) => {
        const updatedRecord = {
          ...record,
          reviewerName: "reviewer",
        };
        const response = await window.electronAPI.call("updateSampleRecords", updatedRecord);
        if (response !== true) {
          throw new Error(String(response));
        }
      }, seededRecord);

      await app.page.reload();
      await loginLocalUser(app.page, "admin.e2e@ret.local", "E2ePass123");
      await expect(app.page.getByTestId(`record-check-${seededRecord.uuid}`)).toBeVisible({
        timeout: 30_000,
      });
      await app.page.getByTestId(`record-check-${seededRecord.uuid}`).click();
      await expect(app.page.getByTestId("record-detail-reviewer-name")).toHaveText("reviewer");
    } catch (error) {
      app?.fail(error);
    } finally {
      if (app) {
        await app.close();
      }
    }
  });
});
