import { describe, expect, it, vi } from "vitest";

import { createRecord, deleteRecords, listRecords } from "../record";

describe("record use-cases", () => {
  it("createRecord calls evaluate and repository.create", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ uuid: "r1", result: "0.7" })
    };
    const evaluate = vi.fn().mockResolvedValue("0.7");

    const result = await createRecord(
      {
        hospitalName: "h",
        doctorName: "",
        patientName: "",
        patientAge: "",
        patientGender: "m",
        sampleId: "s1",
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-01",
        testDate: "2026-01-01",
        RPS4Y1: "1",
        PKHD1L1: "1",
        CRABP1: "1",
        GAPDH: "1",
        testerName: "t",
        otherInfo: "",
        instituteName: "ins"
      },
      repository as never,
      evaluate
    );

    expect(evaluate).toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalled();
    expect((result as { uuid: string }).uuid).toBe("r1");
  });

  it("listRecords validates instituteName", async () => {
    const repository = { list: vi.fn() };
    await expect(listRecords({ instituteName: "", page: 1, pageSize: 10 }, repository as never)).rejects.toThrow(
      "instituteName is required"
    );
  });

  it("deleteRecords validates non-empty uuids", async () => {
    const repository = { deleteByUuids: vi.fn() };
    await expect(deleteRecords([], repository as never)).rejects.toThrow("uuids is required");
  });
});
