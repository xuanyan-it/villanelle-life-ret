import { beforeEach, describe, expect, it, vi } from "vitest";

describe("electronApi", () => {
  const callMock = vi.fn();

  beforeEach(() => {
    callMock.mockReset();
    (globalThis as any).window = {
      electronAPI: {
        call: callMock
      }
    };
  });

  it("returns health ok in electron runtime", async () => {
    const { electronApi } = await import("../electronApi");
    await expect(electronApi.health()).resolves.toEqual({ ok: true });
    expect(callMock).not.toHaveBeenCalled();
  });

  it("delegates user login to electron bridge", async () => {
    callMock.mockResolvedValue({ code: 0, payload: [{ token: "abc" }] });
    const { electronApi } = await import("../electronApi");

    const payload = { email: "doctor@example.com", password: "Password1" };
    const result = await electronApi.userLogin(payload as any);

    expect(callMock).toHaveBeenCalledWith("userLogin", payload);
    expect(result).toEqual({ code: 0, payload: [{ token: "abc" }] });
  });

  it("maps verifyToken to verifyInstituteToken route", async () => {
    callMock.mockResolvedValue({ code: 0, payload: [{ ok: true }] });
    const { electronApi } = await import("../electronApi");

    await electronApi.verifyToken("token-123");

    expect(callMock).toHaveBeenCalledWith("verifyInstituteToken", {
      token: "token-123"
    });
  });

  it("delegates record APIs and download APIs", async () => {
    callMock.mockResolvedValue({ code: 0, payload: [] });
    const { electronApi } = await import("../electronApi");

    await electronApi.fetchSampleRecords({
      instituteName: "A",
      page: 1,
      pageSize: 20
    } as any);
    await electronApi.createSampleRecords([{ id: "001" }] as any);
    await electronApi.updateSampleRecords({ uuid: "r-1" } as any);
    await electronApi.deleteSampleRecords([{ uuid: "r-1" }] as any);
    await electronApi.batchEnqueueEvaluationJobs({
      instituteName: "A",
      records: [{ sampleId: "S1" }] as any
    } as any);
    await electronApi.activeEvaluationJobs({ instituteName: "A" });
    await electronApi.evaluationJobStatus({
      jobUuid: "11111111-1111-4111-8111-111111111111",
      instituteName: "A"
    });
    await electronApi.cancelEvaluationJob({
      jobUuid: "11111111-1111-4111-8111-111111111111"
    });
    await electronApi.download("template.csv");
    await electronApi.exportCsv({
      filename: "out.csv",
      content: "a,b\n1,2"
    });

    expect(callMock).toHaveBeenCalledWith(
      "fetchSampleRecords",
      expect.objectContaining({ page: 1 })
    );
    expect(callMock).toHaveBeenCalledWith("createSampleRecords", [{ id: "001" }]);
    expect(callMock).toHaveBeenCalledWith("updateSampleRecords", { uuid: "r-1" });
    expect(callMock).toHaveBeenCalledWith("deleteSampleRecords", [{ uuid: "r-1" }]);
    expect(callMock).toHaveBeenCalledWith(
      "batchEnqueueEvaluationJobs",
      expect.objectContaining({ instituteName: "A" })
    );
    expect(callMock).toHaveBeenCalledWith("activeEvaluationJobs", { instituteName: "A" });
    expect(callMock).toHaveBeenCalledWith(
      "evaluationJobStatus",
      expect.objectContaining({ instituteName: "A" })
    );
    expect(callMock).toHaveBeenCalledWith(
      "cancelEvaluationJob",
      expect.objectContaining({ jobUuid: "11111111-1111-4111-8111-111111111111" })
    );
    expect(callMock).toHaveBeenCalledWith("download", "template.csv");
    expect(callMock).toHaveBeenCalledWith(
      "exportCsv",
      expect.objectContaining({ filename: "out.csv" })
    );
  });

  it("delegates institute/admin/runtime APIs", async () => {
    callMock.mockResolvedValue({ code: 0, payload: [] });
    const { electronApi } = await import("../electronApi");

    await electronApi.userList({ instituteName: "A" });
    await electronApi.userCreate({
      instituteName: "A",
      username: "u",
      email: "u@example.com",
      password: "Password1",
      userRole: "admin"
    } as any);
    await electronApi.userDelete([{ uuid: "u1" }]);
    await electronApi.instituteList({ keyword: "A" } as any);
    await electronApi.instituteCreate({ instituteName: "A" } as any);
    await electronApi.instituteRegister({
      instituteName: "A",
      username: "u",
      email: "u@example.com",
      password: "Password1"
    } as any);
    await electronApi.fetchInstituteCredential({ instituteName: "A" });
    await electronApi.userLogout();
    await electronApi.isBootstrapRequired();
    await electronApi.getModelConfig();
    await electronApi.getRuntimeProfile();

    expect(callMock).toHaveBeenCalledWith("userList", { instituteName: "A" });
    expect(callMock).toHaveBeenCalledWith(
      "userCreate",
      expect.objectContaining({ username: "u" })
    );
    expect(callMock).toHaveBeenCalledWith("userDelete", [{ uuid: "u1" }]);
    expect(callMock).toHaveBeenCalledWith("instituteList", { keyword: "A" });
    expect(callMock).toHaveBeenCalledWith("instituteCreate", {
      instituteName: "A"
    });
    expect(callMock).toHaveBeenCalledWith(
      "instituteRegister",
      expect.objectContaining({ email: "u@example.com" })
    );
    expect(callMock).toHaveBeenCalledWith("getInstituteCredential", {
      instituteName: "A"
    });
    expect(callMock).toHaveBeenCalledWith("userLogout", undefined);
    expect(callMock).toHaveBeenCalledWith("isBootstrapRequired", undefined);
    expect(callMock).toHaveBeenCalledWith("getModelConfig", undefined);
    expect(callMock).toHaveBeenCalledWith("getRuntimeProfile", undefined);
  });
});
