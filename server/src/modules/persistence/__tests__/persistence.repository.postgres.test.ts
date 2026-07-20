import { beforeEach, describe, expect, it, vi } from "vitest";

const createDrizzleDbMock = vi.fn();
const hashMock = vi.fn();
const verifyMock = vi.fn();
const randomBytesMock = vi.fn();

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return {
    ...actual,
    randomBytes: (...args: unknown[]) => randomBytesMock(...args)
  };
});

const makeSchemaRows = () => [
  ...[
    "id",
    "uuid",
    "institute_name",
    "token",
    "created_at",
    "is_deleted"
  ].map((column_name) => ({ table_name: "institute", column_name })),
  ...[
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
  ].map((column_name) => ({ table_name: "user", column_name })),
  ...[
    "id",
    "uuid",
    "hospital_name",
    "doctor_name",
    "patient_name",
    "patient_age",
    "patient_gender",
    "sample_id",
    "sample_type",
    "sampling_date",
    "reception_date",
    "test_date",
    "rps4y1",
    "pkhd1l1",
    "crabp1",
    "gapdh",
    "tester_name",
    "checker_name",
    "reviewer_name",
    "other_info",
    "result",
    "institute_name",
    "is_deleted"
  ].map((column_name) => ({ table_name: "record", column_name }))
];

const makePool = (rows = makeSchemaRows()) => ({
  query: vi.fn().mockResolvedValue({ rows }),
  end: vi.fn().mockResolvedValue(undefined)
});

vi.mock("../db", () => ({
  createDrizzleDb: (...args: unknown[]) => createDrizzleDbMock(...args),
}));

vi.mock("argon2", () => ({
  argon2id: 2,
  hash: (...args: unknown[]) => hashMock(...args),
  verify: (...args: unknown[]) => verifyMock(...args),
}));

const makeUserRow = () => {
  const date = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: 1,
    uuid: "u-1",
    instituteName: "Demo Institute",
    userRole: "operator",
    email: "alice@example.com",
    username: "alice",
    passHash: "hash",
    createdAt: date,
    updatedAt: date,
    lastLoginAt: date,
    isActivated: true,
  };
};

const makeRecordRow = () => ({
  id: 7,
  uuid: "r-1",
  hospitalName: "Hospital A",
  doctorName: "Doctor A",
  patientName: "Patient A",
  patientAge: "30",
  patientGender: "female",
  sampleId: "S-001",
  sampleType: "blood",
  samplingDate: "2025-01-01",
  receptionDate: "2025-01-02",
  testDate: "2025-01-03",
  RPS4Y1: "1",
  PKHD1L1: "2",
  CRABP1: "3",
  GAPDH: "4",
  testerName: "Tester",
  checkerName: "Checker",
  reviewerName: "Reviewer",
  otherInfo: "",
  result: "1",
  instituteName: "Demo Institute",
  isDeleted: 1,
});

describe("PostgresPersistenceRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashMock.mockResolvedValue("argon-hash");
    verifyMock.mockResolvedValue(true);
    randomBytesMock.mockImplementation((size: number) => Buffer.alloc(size, 1));
  });

  it("ensures schema once and maps user lookup result", async () => {
    const selectEmailChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeUserRow()]),
    };
    const selectUsernameChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(selectEmailChain).mockReturnValueOnce(selectUsernameChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const found = await repository.findUserByEmail("alice@example.com");
    const missing = await repository.findUserByUsername("missing");

    expect(createDrizzleDbMock).toHaveBeenCalledWith("postgres://demo");
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(String(pool.query.mock.calls[0]?.[0] ?? "")).not.toContain("CREATE TABLE");
    expect(found?.username).toBe("alice");
    expect(found?.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(missing).toBeUndefined();
  });

  it("short-circuits deleteUsers on empty input", async () => {
    const db = { delete: vi.fn() };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const deleted = await repository.deleteUsers([]);
    expect(deleted).toBe(true);
    expect(db.delete).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("throws when createUser insert returns no rows", async () => {
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insertChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    await expect(
      repository.createUser({
        instituteName: "Demo Institute",
        email: "alice@example.com",
        username: "alice",
        password: "secret",
        userRole: "operator",
      }),
    ).rejects.toThrow(/failed to create user/);
    expect(hashMock).toHaveBeenCalledWith("secret", { type: 2 });
  });

  it("maps duplicate email conflict during createUser", async () => {
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue({ code: "23505", constraint: "user_email_unique" }),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insertChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const { PersistenceConflictError } = await import("../persistence.repository.types");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    await expect(
      repository.createUser({
        instituteName: "Demo Institute",
        email: "alice@example.com",
        username: "alice",
        password: "secret",
        userRole: "operator",
      }),
    ).rejects.toEqual(new PersistenceConflictError("email"));
  });

  it("returns false when deleteRecords affects fewer rows than requested", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ uuid: "r-1" }]),
    };
    const db = {
      update: vi.fn().mockReturnValue(updateChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const deleted = await repository.deleteRecords(["r-1", "r-2"]);
    expect(deleted).toBe(false);
  });

  it("lists deleted records with sanitized pagination and mapped output", async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };
    const listChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeRecordRow()]),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(listChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const result = await repository.listRecords({
      instituteName: "Demo Institute",
      page: 0,
      pageSize: 0,
      deletedOnly: true,
    });

    expect(listChain.offset).toHaveBeenCalledWith(0);
    expect(listChain.limit).toHaveBeenCalledWith(1);
    expect(result.total).toBe(1);
    expect(result.result[0]?.sampleId).toBe("S-001");
    expect(result.result[0]?.isDeleted).toBe(1);
  });

  it("verifies institute token and maps query result", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          id: 9,
          uuid: "i-1",
          instituteName: "Demo Institute",
          token: "token-1",
          createdAt: "2025-01-01T00:00:00.000Z",
          isDeleted: 0,
        },
      ]),
    };
    const db = {
      select: vi.fn().mockReturnValue(selectChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const result = await repository.verifyToken("token-1");
    expect(result.total).toBe(1);
    expect(result.result[0]).toEqual({
      id: 9,
      uuid: "i-1",
      instituteName: "Demo Institute",
      token: "token-1",
      createdAt: "2025-01-01T00:00:00.000Z",
      isDeleted: 0,
    });
  });

  it("lists institutes with filters and maps rows", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          id: 5,
          uuid: "i-5",
          instituteName: "Lab A",
          token: "TK001",
          createdAt: "2025-03-01T00:00:00.000Z",
          isDeleted: 0,
        },
      ]),
    };
    const db = {
      select: vi.fn().mockReturnValue(selectChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const result = await repository.listInstitutes({
      uuid: "i-5",
      instituteName: "Lab A",
      token: "TK001",
    });

    expect(result.total).toBe(1);
    expect(result.result[0]?.instituteName).toBe("Lab A");
  });

  it("throws when createInstitute insert returns no rows", async () => {
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insertChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    await expect(repository.createInstitute("Lab A")).rejects.toThrow(/failed to create institute/);
  });

  it("retries token conflict and generates secure token alphabet", async () => {
    const returning = vi
      .fn()
      .mockRejectedValueOnce({ code: "23505", constraint: "institute_token_unique" })
      .mockResolvedValueOnce([
        {
          id: 3,
          uuid: "i-3",
          instituteName: "Lab A",
          token: "ABCDEFGH23456789",
          createdAt: "2025-01-01T00:00:00.000Z",
          isDeleted: 0,
        },
      ]);
    const values = vi.fn().mockReturnThis();
    const insertChain = { values, returning };
    const db = {
      insert: vi.fn().mockReturnValue(insertChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    randomBytesMock
      .mockReturnValueOnce(Buffer.alloc(16, 0))
      .mockReturnValueOnce(Buffer.alloc(16, 8));

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const institute = await repository.createInstitute("Lab A");

    expect(values).toHaveBeenCalledTimes(2);
    expect(String(values.mock.calls[0]?.[0]?.token ?? "")).toMatch(/^[A-Z2-9]{16}$/);
    expect(institute.token).toBe("ABCDEFGH23456789");
  });

  it("closes postgres pool", async () => {
    const db = { select: vi.fn() };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    await repository.close();

    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("creates record and maps output", async () => {
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([makeRecordRow()]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insertChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const record = await repository.createRecord(
      {
        instituteName: "Demo Institute",
        hospitalName: "Hospital A",
        doctorName: "Doctor A",
        patientName: "Patient A",
        patientAge: "30",
        patientGender: "female",
        sampleId: "S-001",
        sampleType: "blood",
        samplingDate: "2025-01-01",
        receptionDate: "2025-01-02",
        testDate: "2025-01-03",
        RPS4Y1: "1",
        PKHD1L1: "2",
        CRABP1: "3",
        GAPDH: "4",
        testerName: "Tester",
        otherInfo: "",
      },
      "1",
    );

    expect(record.sampleId).toBe("S-001");
    expect(record.result).toBe("1");
  });

  it("throws when createRecord insert returns no rows", async () => {
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    const db = {
      insert: vi.fn().mockReturnValue(insertChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    await expect(
      repository.createRecord(
        {
          instituteName: "Demo Institute",
          hospitalName: "Hospital A",
          doctorName: "Doctor A",
          patientName: "Patient A",
          patientAge: "30",
          patientGender: "female",
          sampleId: "S-001",
          sampleType: "blood",
          samplingDate: "2025-01-01",
          receptionDate: "2025-01-02",
          testDate: "2025-01-03",
          RPS4Y1: "1",
          PKHD1L1: "2",
          CRABP1: "3",
          GAPDH: "4",
          testerName: "Tester",
          otherInfo: "",
        },
        "1",
      ),
    ).rejects.toThrow(/failed to create record/);
  });

  it("returns true for empty deleteRecords input", async () => {
    const db = { update: vi.fn() };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const deleted = await repository.deleteRecords([]);
    expect(deleted).toBe(true);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns true when deleteRecords affects all requested rows", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ uuid: "r-1" }, { uuid: "r-2" }]),
    };
    const db = {
      update: vi.fn().mockReturnValue(updateChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const deleted = await repository.deleteRecords(["r-1", "r-2"]);
    expect(deleted).toBe(true);
  });

  it("returns total=0 when listRecords count query is empty", async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const listChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(listChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const result = await repository.listRecords({
      instituteName: "Demo Institute",
      page: 1,
      pageSize: 10,
      deletedOnly: false,
    });

    expect(result.total).toBe(0);
    expect(result.result).toEqual([]);
  });

  it("lists records with searchKeyword filter", async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };
    const listChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeRecordRow()]),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(listChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const result = await repository.listRecords({
      instituteName: "Demo Institute",
      page: 1,
      pageSize: 10,
      deletedOnly: false,
      searchKeyword: "S-001",
    });

    expect(countChain.where).toHaveBeenCalledTimes(1);
    expect(listChain.where).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
    expect(result.result[0]?.sampleId).toBe("S-001");
  });

  it("listUsers supports empty filters and all filters", async () => {
    const row = makeUserRow();
    const emptyFiltersChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([row]),
    };
    const fullFiltersChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([row]),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(emptyFiltersChain).mockReturnValueOnce(fullFiltersChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const emptyResult = await repository.listUsers({});
    const fullResult = await repository.listUsers({
      uuid: "u-1",
      email: "alice@example.com",
      username: "alice",
      instituteName: "Demo Institute",
      userRole: "operator",
    });

    expect(emptyResult.total).toBe(1);
    expect(fullResult.total).toBe(1);
    expect(emptyFiltersChain.where).toHaveBeenCalledWith(undefined);
    expect(fullFiltersChain.where).not.toHaveBeenCalledWith(undefined);
  });

  it("maps nullable user fields to defaults", async () => {
    const date = new Date("2025-01-01T00:00:00.000Z");
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 1,
          uuid: "u-null",
          instituteName: null,
          userRole: null,
          email: null,
          username: null,
          passHash: "hash",
          createdAt: date,
          updatedAt: date,
          lastLoginAt: date,
          isActivated: 0,
        },
      ]),
    };
    const db = { select: vi.fn().mockReturnValue(selectChain) };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const user = await repository.findUserByEmail("nullable@example.com");
    expect(user).toEqual({
      id: 1,
      uuid: "u-null",
      instituteName: "",
      userRole: "operator",
      email: "",
      username: "",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      lastLoginAt: "2025-01-01T00:00:00.000Z",
      isActivated: false,
    });
  });

  it("returns mapped user for findUserByUsername and loginUser", async () => {
    const foundByUsernameChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeUserRow()]),
    };
    const loginChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeUserRow()]),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(foundByUsernameChain).mockReturnValueOnce(loginChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const byUsername = await repository.findUserByUsername("alice");
    const login = await repository.loginUser("alice@example.com", "secret");
    expect(byUsername?.username).toBe("alice");
    expect(login?.email).toBe("alice@example.com");
    expect(verifyMock).toHaveBeenCalledWith("hash", "secret");
  });

  it("returns undefined when password verification fails", async () => {
    const loginChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makeUserRow()]),
    };
    const db = {
      select: vi.fn().mockReturnValue(loginChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });
    verifyMock.mockResolvedValueOnce(false);

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const login = await repository.loginUser("alice@example.com", "wrong-password");
    expect(login).toBeUndefined();
  });

  it("lists institutes without optional filters", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    const db = { select: vi.fn().mockReturnValue(selectChain) };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const result = await repository.listInstitutes({});
    expect(result.total).toBe(0);
  });

  it("maps nullable record fields to defaults", async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };
    const listChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: 10,
          uuid: "r-null",
          hospitalName: null,
          doctorName: null,
          patientName: null,
          patientAge: null,
          patientGender: null,
          sampleId: null,
          sampleType: null,
          samplingDate: null,
          receptionDate: null,
          testDate: null,
          RPS4Y1: null,
          PKHD1L1: null,
          CRABP1: null,
          GAPDH: null,
          testerName: null,
          checkerName: null,
          reviewerName: null,
          otherInfo: null,
          result: null,
          instituteName: null,
          isDeleted: null,
        },
      ]),
    };
    const db = {
      select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(listChain),
    };
    const pool = makePool();
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    const result = await repository.listRecords({
      instituteName: "Demo Institute",
      page: 1,
      pageSize: 1,
      deletedOnly: false,
    });
    expect(result.result[0]?.hospitalName).toBe("");
    expect(result.result[0]?.result).toBe("");
    expect(result.result[0]?.isDeleted).toBe(0);
  });

  it("throws when required schema objects are missing", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn()
    };
    const db = { select: vi.fn().mockReturnValue(selectChain) };
    const pool = makePool([{ table_name: "user", column_name: "id" }]);
    createDrizzleDbMock.mockReturnValue({ db, pool });

    const { PostgresPersistenceRepository } = await import("../persistence.repository.postgres");
    const repository = new PostgresPersistenceRepository("postgres://demo");

    await expect(repository.findUserByEmail("alice@example.com")).rejects.toThrow(/database schema is not initialized/);
    expect(selectChain.limit).not.toHaveBeenCalled();
  });

});
