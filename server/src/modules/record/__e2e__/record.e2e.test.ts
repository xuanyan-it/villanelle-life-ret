import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../../app.factory";

import { installE2eHooks, setupAuthSession } from "../../../__e2e__/e2e-harness";

describe("record capability", () => {
  installE2eHooks();

  it("supports record management", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const { instituteName } = await setupAuthSession(agent);

    const createRecord = await agent
      .post("/api/record/create")
      .send({
        hospitalName: "DemoInstitute",
        doctorName: "Dr A",
        patientName: "Foo",
        patientAge: "33",
        patientGender: "m",
        sampleId: "S001",
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate: "2026-01-03",
        RPS4Y1: "26.1",
        PKHD1L1: "28.4",
        CRABP1: "27.5",
        GAPDH: "24.0",
        testerName: "Tester",
        otherInfo: "",
        instituteName
      });
    expect(createRecord.statusCode).toBe(200);
    expect(createRecord.body.code).toBe(0);

    const recordUuid = createRecord.body.payload[0].uuid as string;

    const listRecords = await agent
      .post("/api/record/list")
      .send({ instituteName, page: 1, pageSize: 10 });
    expect(listRecords.statusCode).toBe(200);
    expect(listRecords.body.payload[0].total).toBe(1);

    const updateRecord = await agent
      .post("/api/record/update")
      .send({
        ...createRecord.body.payload[0],
        hospitalName: "UpdatedInstitute",
        reviewerName: "Reviewer A",
        result: "0.1234",
        isDeleted: 0
      });
    expect(updateRecord.statusCode).toBe(200);
    expect(updateRecord.body.code).toBe(0);

    const listUpdatedRecords = await agent
      .post("/api/record/list")
      .send({ instituteName, page: 1, pageSize: 10 });
    expect(listUpdatedRecords.statusCode).toBe(200);
    expect(listUpdatedRecords.body.payload[0].result[0].hospitalName).toBe("UpdatedInstitute");
    expect(listUpdatedRecords.body.payload[0].result[0].reviewerName).toBe("Reviewer A");
    expect(listUpdatedRecords.body.payload[0].result[0].result).toBe("0.1234");

    const deleteRecord = await agent
      .post("/api/record/delete")
      .send([{ uuid: recordUuid }]);
    expect(deleteRecord.statusCode).toBe(200);
    expect(deleteRecord.body.code).toBe(0);

    await app.close();
  });
});
