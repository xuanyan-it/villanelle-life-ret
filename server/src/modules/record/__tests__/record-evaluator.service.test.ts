import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import { computeDetForWorker, mapGenderForWorker, mapSampleTypeForWorker } from "@villanelle/ret-shared/application";

const resolveServerModelDirMock = vi.fn();
const loadServerModelConfigMock = vi.fn();

vi.mock("../../model/model-config", () => ({
  resolveServerModelDir: (...args: unknown[]) => resolveServerModelDirMock(...args),
  loadServerModelConfig: (...args: unknown[]) => loadServerModelConfigMock(...args),
}));

import { PythonRecordEvaluator } from "../record-evaluator";

describe("record evaluator helpers", () => {
  it("maps gender and sample type for worker payload", () => {
    expect(mapGenderForWorker("f")).toBe("0");
    expect(mapGenderForWorker("m")).toBe("1");
    expect(mapSampleTypeForWorker("r", "sample-id   ")).toBe("f");
    expect(mapSampleTypeForWorker("r", "sample-id")).toBe("r");
    expect(mapSampleTypeForWorker("x", "sample-id   ")).toBe("x");
  });

  it("computes DET values as strings", () => {
    expect(computeDetForWorker("3", "5", "7", "1")).toEqual({
      DET_PKHD1L1: "2",
      DET_RPS4Y1: "4",
      DET_CRABP1: "6",
    });
  });
});

describe("PythonRecordEvaluator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveServerModelDirMock.mockReturnValue("C:\\models");
    loadServerModelConfigMock.mockReturnValue({
      modelVersion: "LNM-1.0",
      resultPositiveThreshold: 0.3108,
    });
  });

  it("starts python worker with -u and returns numeric result", async () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === "SERVICE_PYTHON_CMD") return "python3";
        return undefined;
      }),
    } as any;
    const evaluator = new PythonRecordEvaluator(config);
    const start = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue(2);
    const stop = vi.fn();
    (evaluator as any).workerClient = { start, request, stop };

    const result = await evaluator.evaluate("3", "4", "5", "1", {
      patientGender: "f",
      sampleType: "r",
      sampleId: "demo   ",
      instituteName: "Demo",
      hospitalName: "",
      doctorName: "",
      patientName: "",
      patientAge: "",
      samplingDate: "",
      receptionDate: "",
      testDate: "",
      RPS4Y1: "4",
      PKHD1L1: "3",
      CRABP1: "5",
      GAPDH: "1",
      testerName: "",
      otherInfo: "",
    });

    expect(start).toHaveBeenCalledWith("python3", ["-u", expect.stringContaining("worker.py")]);
    expect(request).toHaveBeenCalledWith({
      DET_PKHD1L1: "2",
      DET_RPS4Y1: "3",
      DET_CRABP1: "4",
      Gender: "0",
      sampleType: "f",
    });
    expect(result).toBe("2");
  });

  it("uses non-python command without -u and sanitizes non-finite result", async () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === "SERVICE_PYTHON_CMD") return "worker.exe";
        if (key === "SERVICE_EVAL_SCRIPT") return "C:\\runtime\\worker.py";
        return undefined;
      }),
    } as any;
    const evaluator = new PythonRecordEvaluator(config);
    const start = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue(Number.POSITIVE_INFINITY);
    const stop = vi.fn();
    (evaluator as any).workerClient = { start, request, stop };

    const result = await evaluator.evaluate("2", "2", "2", "1", {
      patientGender: "m",
      sampleType: "r",
      sampleId: "demo",
      instituteName: "Demo",
      hospitalName: "",
      doctorName: "",
      patientName: "",
      patientAge: "",
      samplingDate: "",
      receptionDate: "",
      testDate: "",
      RPS4Y1: "2",
      PKHD1L1: "2",
      CRABP1: "2",
      GAPDH: "1",
      testerName: "",
      otherInfo: "",
    });

    expect(start).toHaveBeenCalledWith("worker.exe", ["C:\\runtime\\worker.py"]);
    expect(result).toBe("");
    evaluator.onModuleDestroy();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("maps worker failures to stable worker-not-ready error", async () => {
    const config = {
      get: vi.fn(() => undefined),
    } as any;
    const evaluator = new PythonRecordEvaluator(config);
    const start = vi.fn().mockRejectedValue(new Error("spawn EACCES"));
    const request = vi.fn();
    const stop = vi.fn();
    (evaluator as any).workerClient = { start, request, stop };

    await expect(
      evaluator.evaluate("2", "2", "2", "1", {
        patientGender: "m",
        sampleType: "r",
        sampleId: "demo",
        instituteName: "Demo",
        hospitalName: "",
        doctorName: "",
        patientName: "",
        patientAge: "",
        samplingDate: "",
        receptionDate: "",
        testDate: "",
        RPS4Y1: "2",
        PKHD1L1: "2",
        CRABP1: "2",
        GAPDH: "1",
        testerName: "",
        otherInfo: "",
      })
    ).rejects.toThrow(SharedClientErrorMessage.workerNotReady);
  });
});
