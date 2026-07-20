import { describe, expect, it, vi } from "vitest";

vi.mock("@villanelle/ret-shared/application", () => ({
  createRecord: vi.fn(),
  listRecords: vi.fn(),
  deleteRecords: vi.fn(),
  updateRecord: vi.fn()
}));

import type { RecordDraft, RecordUpdate } from "@villanelle/ret-shared/domain";
import type { RecordRepositoryPort } from "@villanelle/ret-shared/domain";

describe("RecordService (wrapper)", () => {
  it("delegates createRecord and wires evaluator callback", async () => {
    const shared = await import("@villanelle/ret-shared/application");
    const createRecordMock = shared.createRecord as unknown as vi.Mock;

    const recordEvaluator = {
      evaluate: vi.fn().mockResolvedValue({} as any),
    };

    const persistenceRepo = {
      listRecords: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecords: vi.fn(),
    };

    const { RecordService } = await import("../record.service");
    createRecordMock.mockImplementation(async (_record: RecordDraft, _port: RecordRepositoryPort, evaluatorFn: any) => {
      await evaluatorFn("1" as any, "2" as any, "3" as any, "4" as any, "draft" as any);
      return {} as any;
    });

    const service = new RecordService(persistenceRepo as any, recordEvaluator as any, {
      get: vi.fn().mockReturnValue(undefined)
    } as any);
    const ret = await service.createRecord({
      hospitalName: "Hospital",
      patientGender: "f" as any,
      sampleId: "S-1",
      sampleType: "r" as any,
      samplingDate: "2026-01-01",
      receptionDate: "2026-01-01",
      testDate: "2026-01-01",
      RPS4Y1: "1",
      PKHD1L1: "1",
      CRABP1: "1",
      GAPDH: "1",
      testerName: "Tester",
      instituteName: "Institute",
    } as any);

    expect(ret).toBeDefined();
    expect(createRecordMock).toHaveBeenCalledTimes(1);
    expect(recordEvaluator.evaluate).toHaveBeenCalledWith("1", "2", "3", "4", "draft");
  });

  it("delegates list/delete/update calls", async () => {
    const shared = await import("@villanelle/ret-shared/application");
    const createRecordMock = shared.createRecord as unknown as vi.Mock;
    const listRecordsMock = shared.listRecords as unknown as vi.Mock;
    const deleteRecordsMock = shared.deleteRecords as unknown as vi.Mock;
    const updateRecordMock = shared.updateRecord as unknown as vi.Mock;

    // Ensure assertions are scoped to this test case only.
    createRecordMock.mockClear();
    listRecordsMock.mockClear();
    deleteRecordsMock.mockClear();
    updateRecordMock.mockClear();

    const recordEvaluator = { evaluate: vi.fn() };
    const persistenceRepo = {
      listRecords: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecords: vi.fn(),
    };

    const { RecordService } = await import("../record.service");
    listRecordsMock.mockResolvedValue({} as any);
    deleteRecordsMock.mockResolvedValue(true as any);
    updateRecordMock.mockResolvedValue(false as any);

    const service = new RecordService(persistenceRepo as any, recordEvaluator as any, {
      get: vi.fn().mockReturnValue(undefined)
    } as any);

    await service.listRecords({ instituteName: "Institute", page: 1, pageSize: 10 } as any);
    await service.deleteRecords(["u1", "u2"]);
    await service.updateRecord({ uuid: "u1" } as unknown as RecordUpdate);

    expect(listRecordsMock).toHaveBeenCalledTimes(1);
    expect(deleteRecordsMock).toHaveBeenCalledTimes(1);
    expect(updateRecordMock).toHaveBeenCalledTimes(1);
    expect(createRecordMock).toHaveBeenCalledTimes(0);
  });
});

