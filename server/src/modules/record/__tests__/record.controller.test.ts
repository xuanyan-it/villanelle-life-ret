import {
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

vi.mock("../../../common/envelope/response", () => ({
  ok: (payload: unknown) => ({ code: 0, payload: [payload] })
}));

import { RecordController } from "../record.controller";

describe("RecordController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeValidRecord = (id: number, uuid: string) => ({
    id,
    uuid,
    checkerName: "checker",
    hospitalName: "Demo hospital",
    doctorName: "",
    patientName: "",
    patientAge: "",
    patientGender: "m",
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
    reviewerName: "Reviewer",
    result: "0.1",
    isDeleted: 0,
    instituteName: "Demo",
  });

  it("throws when mapped record shape is invalid", async () => {
    const service = {
      createRecord: vi.fn().mockResolvedValue({
        id: 1,
        uuid: "r-1"
      })
    } as any;
    const controller = new RecordController(service);

    await expect(controller.recordCreate({} as any, {} as any)).rejects.toThrow(
      new InternalServerErrorException(SharedClientErrorMessage.invalidRecordShape)
    );
  });

  it("throws service unavailable when evaluator chain reports worker not ready", async () => {
    const service = {
      createRecord: vi.fn().mockRejectedValue(new Error(SharedClientErrorMessage.workerNotReady))
    } as any;
    const controller = new RecordController(service);

    await expect(controller.recordCreate({} as any, {
      hospitalName: "Demo",
      doctorName: "",
      patientName: "",
      patientAge: "",
      patientGender: "m",
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
    } as any)).rejects.toThrow(
      new ServiceUnavailableException(SharedClientErrorMessage.workerNotReady)
    );
  });

  it("throws conflict when delete operation is partial", async () => {
    const service = {
      deleteRecords: vi.fn().mockResolvedValue(false)
    } as any;
    const controller = new RecordController(service);

    await expect(controller.recordDelete([{ uuid: "r-1" }] as any)).rejects.toThrow(
      new ConflictException(SharedClientErrorMessage.deleteFailed)
    );
  });

  it("throws conflict when update operation fails", async () => {
    const service = {
      updateRecord: vi.fn().mockResolvedValue(false)
    } as any;
    const controller = new RecordController(service);

    await expect(controller.recordUpdate({} as any)).rejects.toThrow(
      new ConflictException(SharedClientErrorMessage.requestFailed)
    );
  });

  it("returns success when update operation succeeds", async () => {
    const service = {
      updateRecord: vi.fn().mockResolvedValue(true)
    } as any;
    const controller = new RecordController(service);

    await expect(controller.recordUpdate({
      uuid: "r-1",
      hospitalName: "Demo",
      doctorName: "",
      patientName: "",
      patientAge: "",
      patientGender: "m",
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
      reviewerName: "Reviewer",
      otherInfo: "",
      result: "0.1",
      instituteName: "Demo",
      isDeleted: 0
    } as any)).resolves.toMatchObject({ code: 0, payload: [true] });
  });

  it("returns ok for record list with defaults and filters invalid records", async () => {
    const service = {
      listRecords: vi.fn().mockResolvedValue({
        total: 2,
        result: [
          makeValidRecord(1, "r-1"),
          { ...makeValidRecord(2, "r-2"), reviewerName: undefined },
        ],
      }),
    } as any;
    const controller = new RecordController(service);

    const result = await controller.recordList({ instituteName: "Demo" } as any);

    expect(result).toMatchObject({ code: 0 });
    expect(result.payload[0].total).toBe(2);
    expect(result.payload[0].result).toHaveLength(1);
    expect(result.payload[0].result[0].uuid).toBe("r-1");
    expect(service.listRecords).toHaveBeenCalledWith({
      instituteName: "Demo",
      page: 1,
      pageSize: 10,
      deletedOnly: false,
      searchKeyword: undefined,
    });
  });

  it("passes searchKeyword to service in record list", async () => {
    const service = {
      listRecords: vi.fn().mockResolvedValue({
        total: 0,
        result: [],
      }),
    } as any;
    const controller = new RecordController(service);

    await controller.recordList({
      instituteName: "Demo",
      page: 2,
      pageSize: 15,
      deletedOnly: true,
      searchKeyword: "S-001",
    } as any);

    expect(service.listRecords).toHaveBeenCalledWith({
      instituteName: "Demo",
      page: 2,
      pageSize: 15,
      deletedOnly: true,
      searchKeyword: "S-001",
    });
  });

  it("rethrows non-worker-not-ready errors from recordCreate", async () => {
    const service = {
      createRecord: vi.fn().mockRejectedValue(new Error("other")),
    } as any;
    const controller = new RecordController(service);

    await expect(
      controller.recordCreate({} as any, {
        hospitalName: "Demo",
        doctorName: "",
        patientName: "",
        patientAge: "",
        patientGender: "m",
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
        instituteName: "Demo",
      } as any)
    ).rejects.toThrow("other");
  });

  it("returns success for recordCreate when mapped shape is valid", async () => {
    const service = {
      createRecord: vi.fn().mockResolvedValue(makeValidRecord(1, "r-create-1")),
    } as any;
    const controller = new RecordController(service);

    const result = await controller.recordCreate({} as any, {
      hospitalName: "Demo hospital",
      doctorName: "",
      patientName: "",
      patientAge: "",
      patientGender: "m",
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
      instituteName: "Demo",
    } as any);

    expect(result).toMatchObject({ code: 0 });
    expect(result.payload[0].uuid).toBe("r-create-1");
  });

  it("returns success when recordDelete succeeds", async () => {
    const service = {
      deleteRecords: vi.fn().mockResolvedValue(true),
    } as any;
    const controller = new RecordController(service);

    await expect(controller.recordDelete([{ uuid: "r-1" }] as any)).resolves.toMatchObject({
      code: 0,
      payload: [true],
    });
  });
});
