import request from "supertest";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { createApp } from "../../../app.factory";

describe("record capability real external dependencies", () => {
  it("uses postgres and python worker to create, list, and delete records", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const instituteName = `RealE2E-${seed}`;
    const email = `real-e2e-${seed}@demo.com`;
    const username = `u${seed}${Math.random().toString(36).slice(2, 8)}`;

    try {
      const register = await agent.post("/api/institute/register").send({
        instituteName,
        email,
        username,
        password: "Aa123456"
      });
      expect(register.statusCode).toBe(200);
      expect(register.body.code).toBe(0);

      const login = await agent.post("/api/user/login").send({
        email,
        password: "Aa123456"
      });
      expect(login.statusCode).toBe(200);
      expect(login.body.code).toBe(0);

      const createRecord = await agent.post("/api/record/create").send({
        hospitalName: "Real Hospital",
        doctorName: "Dr Real",
        patientName: "Patient Real",
        patientAge: "33",
        patientGender: "m",
        sampleId: `S-${seed}`,
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate: "2026-01-03",
        RPS4Y1: "26.1",
        PKHD1L1: "28.4",
        CRABP1: "27.5",
        GAPDH: "24.0",
        testerName: "Tester Real",
        otherInfo: "",
        instituteName
      });
      expect(createRecord.statusCode).toBe(200);
      expect(createRecord.body.code).toBe(0);
      expect(Number.parseFloat(createRecord.body.payload[0].result)).toBeGreaterThanOrEqual(0);

      const recordUuid = createRecord.body.payload[0].uuid as string;

      const listRecords = await agent.post("/api/record/list").send({
        instituteName,
        page: 1,
        pageSize: 10
      });
      expect(listRecords.statusCode).toBe(200);
      expect(listRecords.body.code).toBe(0);
      expect(listRecords.body.payload[0].total).toBeGreaterThanOrEqual(1);
      expect(
        listRecords.body.payload[0].result.some((item: { uuid: string }) => item.uuid === recordUuid)
      ).toBe(true);

      const deleteRecord = await agent.post("/api/record/delete").send([{ uuid: recordUuid }]);
      expect(deleteRecord.statusCode).toBe(200);
      expect(deleteRecord.body.code).toBe(0);
    } finally {
      await app.close();
    }
  }, 180000);

  it("supports evaluationAsync for single record with polling", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const instituteName = `RealE2E-EvalAsync-${seed}`;
    const email = `real-e2e-${seed}@demo.com`;
    const username = `u${seed}${Math.random().toString(36).slice(2, 8)}`;

    try {
      const register = await agent.post("/api/institute/register").send({
        instituteName,
        email,
        username,
        password: "Aa123456"
      });
      expect(register.statusCode).toBe(200);
      expect(register.body.code).toBe(0);

      const login = await agent.post("/api/user/login").send({
        email,
        password: "Aa123456"
      });
      expect(login.statusCode).toBe(200);
      expect(login.body.code).toBe(0);

      const jobUuid = randomUUID();
      const createRecord = await agent.post("/api/record/create").send({
        hospitalName: "Real Hospital",
        doctorName: "Dr Real",
        patientName: "Patient Real",
        patientAge: "33",
        patientGender: "m",
        sampleId: `S-${seed}`,
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate: "2026-01-03",
        RPS4Y1: "26.1",
        PKHD1L1: "28.4",
        CRABP1: "27.5",
        GAPDH: "24.0",
        testerName: "Tester Real",
        otherInfo: "",
        instituteName,
        evaluationAsync: true,
        evaluationJobUuid: jobUuid
      });

      expect(createRecord.statusCode).toBe(200);
      expect(createRecord.body.code).toBe(0);

      // Poll evaluation job status.
      let lastStatus: any = null;
      const maxAttempts = 60;
      const intervalMs = 2000;

      for (let i = 0; i < maxAttempts; i++) {
        const poll = await agent
          .get(`/api/record/evaluation-jobs/${jobUuid}`)
          .query({ instituteName });
        expect(poll.statusCode).toBe(200);
        expect(poll.body.code).toBe(0);
        lastStatus = poll.body.payload[0];

        if (
          lastStatus.status === "succeeded" ||
          lastStatus.status === "failed" ||
          lastStatus.status === "cancelled"
        ) {
          break;
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }

      expect(lastStatus).not.toBeNull();
      expect(lastStatus.status).toBe("succeeded");
      const recordUuid = lastStatus.items?.[0]?.recordUuid as string;
      expect(recordUuid).toBeTruthy();

      const listRecords = await agent.post("/api/record/list").send({
        instituteName,
        page: 1,
        pageSize: 10
      });
      expect(listRecords.statusCode).toBe(200);
      expect(listRecords.body.code).toBe(0);

      const found = listRecords.body.payload[0].result.find(
        (item: { uuid: string }) => item.uuid === recordUuid
      );
      expect(found).toBeTruthy();
      expect(Number.parseFloat(found.result)).toBeGreaterThanOrEqual(0);

      await agent.post("/api/record/delete").send([{ uuid: recordUuid }]);
    } finally {
      await app.close();
    }
  }, 180000);

  it("supports evaluationAsync cancellation (cancelled) with polling", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const instituteName = `RealE2E-EvalAsync-Cancel-${seed}`;
    const email = `real-e2e-cancel-${seed}@demo.com`;
    const username = `u${seed}${Math.random().toString(36).slice(2, 8)}`;

    try {
      const register = await agent.post("/api/institute/register").send({
        instituteName,
        email,
        username,
        password: "Aa123456"
      });
      expect(register.statusCode).toBe(200);
      expect(register.body.code).toBe(0);

      const login = await agent.post("/api/user/login").send({
        email,
        password: "Aa123456"
      });
      expect(login.statusCode).toBe(200);
      expect(login.body.code).toBe(0);

      const jobUuid = randomUUID();
      const createRecord = await agent.post("/api/record/create").send({
        hospitalName: "Real Hospital",
        doctorName: "Dr Real",
        patientName: "Patient Real",
        patientAge: "33",
        patientGender: "m",
        sampleId: `S-${seed}`,
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate: "2026-01-03",
        RPS4Y1: "26.1",
        PKHD1L1: "28.4",
        CRABP1: "27.5",
        GAPDH: "24.0",
        testerName: "Tester Real",
        otherInfo: "",
        instituteName,
        evaluationAsync: true,
        evaluationJobUuid: jobUuid
      });

      expect(createRecord.statusCode).toBe(200);
      expect(createRecord.body.code).toBe(0);

      // Cancel immediately after starting.
      await agent.post(`/api/record/evaluation-jobs/${jobUuid}`).send({
        jobUuid,
        instituteName
      });

      let lastStatus: any = null;
      const maxAttempts = 60;
      const intervalMs = 2000;

      for (let i = 0; i < maxAttempts; i++) {
        const poll = await agent
          .get(`/api/record/evaluation-jobs/${jobUuid}`)
          .query({ instituteName });
        expect(poll.statusCode).toBe(200);
        expect(poll.body.code).toBe(0);
        lastStatus = poll.body.payload[0];
        if (
          lastStatus.status === "cancelled" ||
          lastStatus.status === "succeeded" ||
          lastStatus.status === "failed"
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }

      expect(lastStatus).not.toBeNull();
      expect(lastStatus.status).toBe("cancelled");
      expect(lastStatus.items?.[0]?.recordUuid ?? "").toBe("");

      // If cancelled, no evaluated record should be persisted.
      const listRecords = await agent.post("/api/record/list").send({
        instituteName,
        page: 1,
        pageSize: 10
      });
      const found = listRecords.body.payload[0].result.find(
        (item: { sampleId: string }) => item.sampleId === `S-${seed}`
      );
      expect(found).toBeFalsy();
    } finally {
      await app.close();
    }
  }, 180000);

  it("supports evaluation jobs batch enqueue + polling (succeeded)", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const instituteName = `RealE2E-EvalBatch-${seed}`;
    const email = `real-e2e-batch-${seed}@demo.com`;
    const username = `u${seed}${Math.random().toString(36).slice(2, 8)}`;

    try {
      const register = await agent.post("/api/institute/register").send({
        instituteName,
        email,
        username,
        password: "Aa123456"
      });
      expect(register.statusCode).toBe(200);
      expect(register.body.code).toBe(0);

      const login = await agent.post("/api/user/login").send({
        email,
        password: "Aa123456"
      });
      expect(login.statusCode).toBe(200);
      expect(login.body.code).toBe(0);

      const testerName = "Tester Real";
      const testDate = "2026-01-03";
      const records = Array.from({ length: 3 }, (_, i) => ({
        hospitalName: "Real Hospital",
        doctorName: "Dr Real",
        patientName: `Patient Real-${i}`,
        patientAge: "33",
        patientGender: "m",
        sampleId: `S-${seed}-${i}`,
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate,
        RPS4Y1: "26.1",
        PKHD1L1: "28.4",
        CRABP1: "27.5",
        GAPDH: "24.0",
        testerName,
        otherInfo: "",
        instituteName
      }));

      const enqueue = await agent.post("/api/record/evaluation-jobs").send({
        instituteName,
        records,
        evaluationJobStart: true
      });
      expect(enqueue.statusCode).toBe(200);
      expect(enqueue.body.code).toBe(0);

      const jobUuid = enqueue.body.payload[0].jobUuid as string;
      expect(jobUuid).toBeTruthy();

      let lastStatus: any = null;
      const intervalMs = 2000;
      const maxAttempts = 90;

      for (let i = 0; i < maxAttempts; i++) {
        const poll = await agent
          .get(`/api/record/evaluation-jobs/${jobUuid}`)
          .query({ instituteName });
        expect(poll.statusCode).toBe(200);
        expect(poll.body.code).toBe(0);
        lastStatus = poll.body.payload[0];

        if (
          lastStatus.status === "succeeded" ||
          lastStatus.status === "failed" ||
          lastStatus.status === "cancelled"
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }

      expect(lastStatus).not.toBeNull();
      expect(lastStatus.status).toBe("succeeded");

      // Ensure all succeeded items have persisted record result.
      const recordUuids = lastStatus.items.map((it: any) => it.recordUuid as string);

      const listRecords = await agent.post("/api/record/list").send({
        instituteName,
        page: 1,
        pageSize: 20
      });
      expect(listRecords.statusCode).toBe(200);
      expect(listRecords.body.code).toBe(0);

      const all = listRecords.body.payload[0].result as Array<{ uuid: string; result: string }>;
      for (const ru of recordUuids) {
        const rec = all.find((x) => x.uuid === ru);
        expect(rec).toBeTruthy();
        expect(rec!.result).not.toBe("");
        expect(Number.parseFloat(rec!.result)).toBeGreaterThanOrEqual(0);
      }

      await agent
        .post("/api/record/delete")
        .send(recordUuids.map((uuid: string) => ({ uuid })));
    } finally {
      await app.close();
    }
  }, 220000);

  it("supports evaluation jobs batch cancellation keeps completed records and re-import appends", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const instituteName = `RealE2E-EvalBatch-Cancel-${seed}`;
    const email = `real-e2e-batch-cancel-${seed}@demo.com`;
    const username = `u${seed}${Math.random().toString(36).slice(2, 8)}`;

    try {
      const register = await agent.post("/api/institute/register").send({
        instituteName,
        email,
        username,
        password: "Aa123456"
      });
      expect(register.statusCode).toBe(200);
      expect(register.body.code).toBe(0);

      const login = await agent.post("/api/user/login").send({
        email,
        password: "Aa123456"
      });
      expect(login.statusCode).toBe(200);
      expect(login.body.code).toBe(0);

      const testerName = "Tester Real";
      const testDate = "2026-01-03";
      const N = 9;
      const records = Array.from({ length: N }, (_, i) => ({
        hospitalName: "Real Hospital",
        doctorName: "Dr Real",
        patientName: `Patient Real-${i}`,
        patientAge: "33",
        patientGender: "m",
        sampleId: `S-${seed}-${i}`,
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate,
        RPS4Y1: "26.1",
        PKHD1L1: "28.4",
        CRABP1: "27.5",
        GAPDH: "24.0",
        testerName,
        otherInfo: "",
        instituteName
      }));

      const enqueue = await agent.post("/api/record/evaluation-jobs").send({
        instituteName,
        records,
        evaluationJobStart: true
      });
      expect(enqueue.statusCode).toBe(200);
      expect(enqueue.body.code).toBe(0);

      const jobUuid = enqueue.body.payload[0].jobUuid as string;

      // Wait until item 0 starts evaluating, then cancel immediately.
      let status: any = null;
      const intervalMs = 150;
      for (let i = 0; i < 200; i++) {
        const poll = await agent
          .get(`/api/record/evaluation-jobs/${jobUuid}`)
          .query({ instituteName });
        expect(poll.statusCode).toBe(200);
        status = poll.body.payload[0];

        const item0 = status.items.find((it: any) => it.itemSeqNo === 0);
        // If the job already finished before we cancel, that's flaky in this real-e2e env.
        if (status.status === "succeeded" || status.status === "failed") {
          break;
        }

        if (item0?.itemStatus === "evaluating") {
          const patch = await agent
            .patch(`/api/record/evaluation-jobs/${jobUuid}`)
            .send({ cancelRequested: true });
          expect(patch.statusCode).toBe(200);
          break;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }

      // Poll until cancelled
      let lastStatus: any = null;
      const cancelPollIntervalMs = 2000;
      const cancelMaxAttempts = 90;
      for (let i = 0; i < cancelMaxAttempts; i++) {
        const poll = await agent
          .get(`/api/record/evaluation-jobs/${jobUuid}`)
          .query({ instituteName });
        expect(poll.statusCode).toBe(200);
        expect(poll.body.code).toBe(0);
        lastStatus = poll.body.payload[0];

        if (
          lastStatus.status === "cancelled" ||
          lastStatus.status === "succeeded" ||
          lastStatus.status === "failed"
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, cancelPollIntervalMs));
      }

      expect(lastStatus).not.toBeNull();
      expect(lastStatus.status).toBe("cancelled");

      const items = lastStatus.items as Array<any>;
      const succeededItems = items.filter((it) => it.itemStatus === "succeeded");
      const cancelledItems = items.filter((it) => it.itemStatus === "cancelled");
      expect(cancelledItems.length).toBeGreaterThan(0);

      const recordUuids = items.map((it) => it.recordUuid as string).filter((u) => !!u);
      const listRecords = await agent.post("/api/record/list").send({
        instituteName,
        page: 1,
        pageSize: 50
      });
      expect(listRecords.statusCode).toBe(200);
      expect(listRecords.body.code).toBe(0);
      const all = listRecords.body.payload[0].result as Array<{ uuid: string; result: string }>;

      for (const it of succeededItems) {
        const rec = all.find((x) => x.uuid === it.recordUuid);
        expect(rec).toBeTruthy();
        expect(rec!.result).not.toBe("");
      }

      for (const it of cancelledItems) {
        // 取消发生后仍可能存在尚未轮到创建 record 的 item，此时 recordUuid 可能为空串
        if (!it.recordUuid) continue;
        const rec = all.find((x) => x.uuid === it.recordUuid);
        expect(rec).toBeTruthy();
        expect(rec!.result).toBe("");
      }

      // Re-import: append new records, do not overwrite old completed/cancelled ones.
      const N2 = 2;
      const records2 = Array.from({ length: N2 }, (_, i) => ({
        hospitalName: "Real Hospital",
        doctorName: "Dr Real",
        patientName: `Patient Real-RE-${i}`,
        patientAge: "33",
        patientGender: "m",
        sampleId: `S-${seed}-re-${i}`,
        sampleType: "r",
        samplingDate: "2026-01-01",
        receptionDate: "2026-01-02",
        testDate,
        RPS4Y1: "26.1",
        PKHD1L1: "28.4",
        CRABP1: "27.5",
        GAPDH: "24.0",
        testerName,
        otherInfo: "",
        instituteName
      }));

      const enqueue2 = await agent.post("/api/record/evaluation-jobs").send({
        instituteName,
        records: records2,
        evaluationJobStart: true
      });
      expect(enqueue2.statusCode).toBe(200);
      expect(enqueue2.body.code).toBe(0);

      const jobUuid2 = enqueue2.body.payload[0].jobUuid as string;

      // Poll second job to succeed
      let lastStatus2: any = null;
      for (let i = 0; i < 90; i++) {
        const poll = await agent
          .get(`/api/record/evaluation-jobs/${jobUuid2}`)
          .query({ instituteName });
        expect(poll.statusCode).toBe(200);
        expect(poll.body.code).toBe(0);
        lastStatus2 = poll.body.payload[0];
        if (
          lastStatus2.status === "succeeded" ||
          lastStatus2.status === "failed" ||
          lastStatus2.status === "cancelled"
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      expect(lastStatus2).not.toBeNull();
      expect(lastStatus2.status).toBe("succeeded");

      const newRecordUuids = (lastStatus2.items as any[]).map((it) => it.recordUuid as string);

      const listRecords2 = await agent.post("/api/record/list").send({
        instituteName,
        page: 1,
        pageSize: 50
      });
      expect(listRecords2.statusCode).toBe(200);
      expect(listRecords2.body.code).toBe(0);
      const all2 = listRecords2.body.payload[0].result as Array<{ uuid: string; result: string }>;

      for (const it of succeededItems) {
        const rec = all2.find((x) => x.uuid === it.recordUuid);
        expect(rec).toBeTruthy();
        expect(rec!.result).not.toBe("");
      }
      for (const it of cancelledItems) {
        // 同上：尚未轮到创建 record 的 cancelled item 可能 recordUuid 为空串
        if (!it.recordUuid) continue;
        const rec = all2.find((x) => x.uuid === it.recordUuid);
        expect(rec).toBeTruthy();
        expect(rec!.result).toBe("");
      }
      for (const nu of newRecordUuids) {
        const rec = all2.find((x) => x.uuid === nu);
        expect(rec).toBeTruthy();
        expect(rec!.result).not.toBe("");
      }

      await agent
        .post("/api/record/delete")
        .send([...recordUuids, ...newRecordUuids].map((uuid) => ({ uuid })));
    } finally {
      await app.close();
    }
  }, 260000);
});
