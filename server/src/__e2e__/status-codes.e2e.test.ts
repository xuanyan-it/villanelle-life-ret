import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.factory";

import { installE2eHooks, setupAuthSession } from "./e2e-harness";

describe("http status regression", () => {
  installE2eHooks();

  it("returns stable 4xx statuses for core business failures", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const { instituteName, email } = await setupAuthSession(agent);

    const loginFailed = await agent.post("/api/user/login").send({
      email,
      password: "wrong-password"
    });
    expect(loginFailed.statusCode).toBe(401);
    expect(loginFailed.body.code).toBe(1);
    expect(loginFailed.body.message).toBe("login failed");

    const duplicateUser = await agent.post("/api/user/create").send({
      instituteName,
      email,
      username: `dup-${Date.now()}`,
      password: "Aa123456",
      userRole: "operator"
    });
    expect(duplicateUser.statusCode).toBe(409);
    expect(duplicateUser.body.code).toBe(1);
    expect(duplicateUser.body.message).toBe("email exists");

    const invalidToken = await agent.post("/api/institute/verify").send({
      token: "INVALID-TOKEN"
    });
    expect(invalidToken.statusCode).toBe(400);
    expect(invalidToken.body.code).toBe(1);
    expect(invalidToken.body.message).toBe("invalid token");

    const deleteMissingUser = await agent.post("/api/user/delete").send([
      { uuid: "00000000-0000-0000-0000-000000000000" }
    ]);
    expect(deleteMissingUser.statusCode).toBe(409);
    expect(deleteMissingUser.body.code).toBe(1);
    expect(deleteMissingUser.body.message).toBe("delete failed");

    const updateMissingRecord = await agent.post("/api/record/update").send({
      uuid: "00000000-0000-0000-0000-000000000000",
      hospitalName: "Demo",
      doctorName: "",
      patientName: "",
      patientAge: "",
      patientGender: "m",
      sampleId: "S-404",
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
      instituteName,
      isDeleted: 0
    });
    expect(updateMissingRecord.statusCode).toBe(409);
    expect(updateMissingRecord.body.code).toBe(1);
    expect(updateMissingRecord.body.message).toBe("request failed");

    await app.close();
  });
});
