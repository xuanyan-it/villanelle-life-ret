import { randomUUID } from "node:crypto";
import path from "node:path";

import { beforeEach, expect, vi } from "vitest";

import type { PersistenceRepository } from "../modules/persistence/persistence.repository";

type PostSendAgent = {
  post: (path: string) => {
    send: (body?: string | object) => any;
  };
};

type StoredUser = {
  id: number;
  uuid: string;
  instituteName: string;
  userRole: "administrator" | "operator";
  email: string;
  username: string;
  passHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  isActivated: boolean;
};

type StoredInstitute = {
  id: number;
  uuid: string;
  instituteName: string;
  token: string;
  createdAt: string;
  isDeleted: number;
};

type StoredRecord = {
  id: number;
  uuid: string;
  hospitalName: string;
  doctorName: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  sampleId: string;
  sampleType: string;
  samplingDate: string;
  receptionDate: string;
  testDate: string;
  RPS4Y1: string;
  PKHD1L1: string;
  CRABP1: string;
  GAPDH: string;
  testerName: string;
  checkerName: string;
  reviewerName: string;
  otherInfo: string;
  result: string;
  instituteName: string;
  isDeleted: number;
};

const testState = vi.hoisted(() => {
  const createRepo = (): PersistenceRepository => {
    const users: StoredUser[] = [];
    const institutes: StoredInstitute[] = [];
    const records: StoredRecord[] = [];

    const now = () => new Date().toISOString();

    const toDomainUser = (user: StoredUser) => {
      const { passHash: _passHash, ...rest } = user;
      return rest;
    };

    return {
      async listUsers(filters) {
        const result = users
          .filter((u) =>
            Object.entries(filters).every(([k, v]) => (u as unknown as Record<string, unknown>)[k] === v)
          )
          .map(toDomainUser);
        return { total: result.length, result };
      },
      async findUserByEmail(email) {
        const user = users.find((u) => u.email === email);
        return user ? toDomainUser(user) : undefined;
      },
      async findUserByUsername(username) {
        const user = users.find((u) => u.username === username);
        return user ? toDomainUser(user) : undefined;
      },
      async loginUser(email, password) {
        const user = users.find((u) => u.email === email && u.passHash === password);
        return user ? toDomainUser(user) : undefined;
      },
      async createUser(input) {
        const user: StoredUser = {
          id: users.length + 1,
          uuid: randomUUID(),
          instituteName: input.instituteName,
          userRole: input.userRole,
          email: input.email,
          username: input.username,
          passHash: input.password,
          createdAt: now(),
          updatedAt: now(),
          lastLoginAt: now(),
          isActivated: true
        };
        users.push(user);
        return toDomainUser(user);
      },
      async deleteUsers(uuids) {
        const before = users.length;
        for (let i = users.length - 1; i >= 0; i -= 1) {
          const user = users[i];
          if (user && uuids.includes(user.uuid)) users.splice(i, 1);
        }
        return before - users.length === uuids.length;
      },
      async listInstitutes(filters) {
        const result = institutes.filter(
          (i) =>
            i.isDeleted === 0 &&
            Object.entries(filters).every(([k, v]) => (i as unknown as Record<string, unknown>)[k] === v)
        );
        return { total: result.length, result };
      },
      async createInstitute(instituteName) {
        const institute: StoredInstitute = {
          id: institutes.length + 1,
          uuid: randomUUID(),
          instituteName,
          token: `TKN${institutes.length + 1}`,
          createdAt: now(),
          isDeleted: 0
        };
        institutes.push(institute);
        return institute;
      },
      async verifyToken(token) {
        const result = institutes.filter(
          (i) => i.isDeleted === 0 && i.token === token
        );
        return { total: result.length, result };
      },
      async listRecords(params) {
        const page = Math.max(params.page, 1);
        const pageSize = Math.max(params.pageSize, 1);
        const deletedFlag = params.deletedOnly ? 1 : 0;
        const filtered = records.filter(
          (r) => r.instituteName === params.instituteName && r.isDeleted === deletedFlag
        );
        const start = (page - 1) * pageSize;
        return { total: filtered.length, result: filtered.slice(start, start + pageSize) };
      },
      async createRecord(payload, result) {
        const record: StoredRecord = {
          ...payload,
          id: records.length + 1,
          uuid: randomUUID(),
          checkerName: "",
          reviewerName: "",
          result,
          isDeleted: 0
        };
        records.push(record);
        return record;
      },
      async updateRecord(payload) {
        const target = records.find((record) => record.uuid === payload.uuid);
        if (!target) return false;
        Object.assign(target, {
          hospitalName: payload.hospitalName,
          doctorName: payload.doctorName,
          patientName: payload.patientName,
          patientAge: payload.patientAge,
          patientGender: payload.patientGender,
          sampleId: payload.sampleId,
          sampleType: payload.sampleType,
          samplingDate: payload.samplingDate,
          receptionDate: payload.receptionDate,
          testDate: payload.testDate,
          RPS4Y1: payload.RPS4Y1,
          PKHD1L1: payload.PKHD1L1,
          CRABP1: payload.CRABP1,
          GAPDH: payload.GAPDH,
          testerName: payload.testerName,
          reviewerName: payload.reviewerName,
          otherInfo: payload.otherInfo,
          result: payload.result,
          instituteName: payload.instituteName,
          isDeleted: payload.isDeleted
        });
        return true;
      },
      async deleteRecords(uuids) {
        let affected = 0;
        for (const record of records) {
          if (uuids.includes(record.uuid) && record.isDeleted === 0) {
            record.isDeleted = 1;
            affected += 1;
          }
        }
        return affected === uuids.length;
      }
    } as PersistenceRepository;
  };

  return { repo: createRepo(), createRepo };
});

vi.mock("../modules/persistence/persistence.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/persistence/persistence.repository")>();
  return {
    ...actual,
    createPersistenceRepository: () => testState.repo
  };
});

vi.mock("../modules/persistence/evaluation", () => ({
  evaluateRecord: () => "0.75"
}));

export const installE2eHooks = () => {
  beforeEach(() => {
    testState.repo = testState.createRepo();
    process.env.JWT_SECRET = "test-access-secret-123456";
    process.env.JWT_EXPIRES_IN = "24h";
    process.env.SERVICE_PYTHON_CMD = process.execPath;
    process.env.SERVICE_EVAL_SCRIPT = path.resolve(__dirname, "fixtures", "fake-worker.js");
  });
};

export const setupAuthSession = async (agent: PostSendAgent) => {
  const seed = Date.now();
  const instituteName = `DemoInstitute-${seed}`;
  const email = `admin-${seed}@demo.com`;
  const username = `admin-${seed}`;

  const instituteCreate = await agent.post("/api/institute/create").send({ instituteName });
  expect(instituteCreate.statusCode).toBe(200);
  expect(instituteCreate.body.code).toBe(0);

  const userCreate = await agent.post("/api/user/create").send({
    instituteName,
    email,
    username,
    password: "Aa123456",
    userRole: "administrator"
  });
  expect(userCreate.statusCode).toBe(200);
  expect(userCreate.body.code).toBe(0);

  const userLogin = await agent.post("/api/user/login").send({ email, password: "Aa123456" });
  expect(userLogin.statusCode).toBe(200);
  expect(userLogin.body.code).toBe(0);
  expect(userLogin.headers["set-cookie"]).toBeDefined();

  const payload = (userLogin.body as { payload: Array<{ accessToken: string }> }).payload;
  expect(payload.length).toBeGreaterThan(0);
  const accessToken = payload[0]!.accessToken;

  return { instituteName, email, accessToken };
};
