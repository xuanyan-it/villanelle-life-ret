import { describe, expect, it } from "vitest";
import { computeDetForWorker, mapGenderForWorker, mapSampleTypeForWorker } from "@villanelle/ret-shared/application";

describe("record evaluator worker payload helpers", () => {
  it("maps gender to worker format", () => {
    expect(mapGenderForWorker("f")).toBe("0");
    expect(mapGenderForWorker("m")).toBe("1");
    expect(mapGenderForWorker("n/a")).toBe("1");
  });

  it("maps sampleType r+trailing-spaces marker to f", () => {
    expect(mapSampleTypeForWorker("r", "S-001   ")).toBe("f");
    expect(mapSampleTypeForWorker("r", "S-001")).toBe("r");
    expect(mapSampleTypeForWorker("q", "S-001   ")).toBe("q");
  });

  it("computes DET payload as strings", () => {
    const det = computeDetForWorker("28.4", "26.1", "27.5", "24.0");
    expect(det).toEqual({
      DET_PKHD1L1: "4.399999999999999",
      DET_RPS4Y1: "2.1000000000000014",
      DET_CRABP1: "3.5"
    });
  });
});
