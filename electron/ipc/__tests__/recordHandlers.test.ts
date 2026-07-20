import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
  fetchSampleRecordsMock: vi.fn(),
  createSampleRecordsMock: vi.fn(),
  updateSampleRecordsMock: vi.fn(),
  deleteSampleRecordsMock: vi.fn(),
  deleteSampleRecordsByUuidsMock: vi.fn(),
  createEvaluationJobMock: vi.fn(),
  createEvaluationJobItemsMock: vi.fn(),
  getEvaluationJobByUuidMock: vi.fn(),
  listEvaluationJobItemsMock: vi.fn(),
  findActiveEvaluationJobMock: vi.fn(),
  updateEvaluationJobMock: vi.fn(),
  updateEvaluationJobItemMock: vi.fn(),
  listPendingOrEvaluatingItemsMock: vi.fn(),
  cancelPendingOrEvaluatingItemsMock: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: mocks.handleMock
  }
}));

vi.mock("../../database", () => ({
  createSampleRecords: mocks.createSampleRecordsMock,
  createEvaluationJob: mocks.createEvaluationJobMock,
  createEvaluationJobItems: mocks.createEvaluationJobItemsMock,
  cancelPendingOrEvaluatingItems: mocks.cancelPendingOrEvaluatingItemsMock,
  findActiveEvaluationJob: mocks.findActiveEvaluationJobMock,
  getEvaluationJobByUuid: mocks.getEvaluationJobByUuidMock,
  listEvaluationJobItems: mocks.listEvaluationJobItemsMock,
  listPendingOrEvaluatingItems: mocks.listPendingOrEvaluatingItemsMock,
  updateEvaluationJob: mocks.updateEvaluationJobMock,
  updateEvaluationJobItem: mocks.updateEvaluationJobItemMock,
  deleteSampleRecordsByUuids: mocks.deleteSampleRecordsByUuidsMock,
  deleteSampleRecords: mocks.deleteSampleRecordsMock,
  fetchSampleRecords: mocks.fetchSampleRecordsMock,
  updateSampleRecords: mocks.updateSampleRecordsMock
}));

import { registerRecordHandlers } from "../recordHandlers";

describe("record handlers", () => {
  const createAuthSession = (authenticated = true) => ({
    isAuthenticated: vi.fn(() => authenticated),
    markAuthenticated: vi.fn(),
    getPrincipal: vi.fn(() => ({ username: "tester", instituteName: "Demo" })),
    clear: vi.fn(),
    requireAuthenticated: vi.fn(() => {
      if (!authenticated) {
        throw new Error(SharedClientErrorMessage.unauthorized);
      }
    })
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid payload for malformed list request", async () => {
    registerRecordHandlers({
      authSession: createAuthSession(true),
      emitShellOutput: vi.fn(),
      workerManager: { start: vi.fn(), request: vi.fn() },
      workerCommand: "python",
      workerArgs: [],
      mainWindow: { webContents: { send: vi.fn() } }
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const fetchRecords = handlers.get("fetchSampleRecords");
    const result = await fetchRecords?.({}, { instituteName: "" });

    expect(result).toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.invalidPayload
    });
  });

  it("replaces internal fetch errors with a stable fallback message", async () => {
    mocks.fetchSampleRecordsMock.mockRejectedValue(new Error("sqlite busy"));
    registerRecordHandlers({
      authSession: createAuthSession(true),
      emitShellOutput: vi.fn(),
      workerManager: { start: vi.fn(), request: vi.fn() },
      workerCommand: "python",
      workerArgs: [],
      mainWindow: { webContents: { send: vi.fn() } }
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const fetchRecords = handlers.get("fetchSampleRecords");
    const result = await fetchRecords?.({}, { instituteName: "Demo" });

    expect(result).toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.fetchSampleRecordsFailed
    });
  });

  it("replaces worker startup errors with a stable create-record failure message", async () => {
    const workerManager = {
      start: vi.fn().mockRejectedValue(new Error("spawn EACCES")),
      request: vi.fn()
    };
    registerRecordHandlers({
      authSession: createAuthSession(true),
      emitShellOutput: vi.fn(),
      workerManager,
      workerCommand: "python",
      workerArgs: [],
      mainWindow: { webContents: { send: vi.fn() } }
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    const createRecords = handlers.get("createSampleRecords");
    await expect(
      createRecords?.({}, {
        hospitalName: "Hospital",
        doctorName: "",
        patientName: "",
        patientAge: "",
        patientGender: "f",
        sampleId: "S-1",
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate: "2026-01-03",
        RPS4Y1: "1",
        PKHD1L1: "1",
        CRABP1: "1",
        GAPDH: "1",
        testerName: "Tester",
        otherInfo: "",
        instituteName: "Demo"
      })
    ).rejects.toThrow(SharedClientErrorMessage.workerNotReady);
  });

  it("rejects malformed update payload with invalid payload", async () => {
    registerRecordHandlers({
      authSession: createAuthSession(true),
      emitShellOutput: vi.fn(),
      workerManager: { start: vi.fn(), request: vi.fn() },
      workerCommand: "python",
      workerArgs: [],
      mainWindow: { webContents: { send: vi.fn() } }
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(
      handlers.get("updateSampleRecords")?.({}, {
        uuid: "",
        instituteName: "Demo"
      } as any)
    ).rejects.toThrow(SharedClientErrorMessage.invalidPayload);
  });

  it("creates records with empty reviewerName until explicit review happens", async () => {
    const workerManager = {
      start: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockResolvedValue(0.62)
    };
    mocks.createSampleRecordsMock.mockImplementation(async (record) => ({
      uuid: "record-1",
      ...record
    }));
    registerRecordHandlers({
      authSession: createAuthSession(true),
      emitShellOutput: vi.fn(),
      workerManager,
      workerCommand: "python",
      workerArgs: [],
      mainWindow: { webContents: { send: vi.fn() } }
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await handlers.get("createSampleRecords")?.({}, {
      hospitalName: "Hospital",
      doctorName: "",
      patientName: "",
      patientAge: "",
      patientGender: "f",
      sampleId: "S-1",
      sampleType: "r",
      samplingDate: "2026-01-01",
      receptionDate: "2026-01-02",
      testDate: "2026-01-03",
      RPS4Y1: "1",
      PKHD1L1: "1",
      CRABP1: "1",
      GAPDH: "1",
      testerName: "Tester",
      otherInfo: "",
      instituteName: "Demo"
    });

    expect(mocks.createSampleRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerName: ""
      })
    );
  });

  it("blocks protected record handlers when not authenticated", async () => {
    registerRecordHandlers({
      authSession: createAuthSession(false),
      emitShellOutput: vi.fn(),
      workerManager: { start: vi.fn(), request: vi.fn() },
      workerCommand: "python",
      workerArgs: [],
      mainWindow: { webContents: { send: vi.fn() } }
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("fetchSampleRecords")?.({}, { instituteName: "Demo" })).resolves.toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.unauthorized
    });
  });
});
