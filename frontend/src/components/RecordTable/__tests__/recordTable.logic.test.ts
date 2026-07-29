import { describe, expect, it } from "vitest";
import {
  filterVisibleRecords,
  formatCt,
  getResultKind,
  getResultLabelKey,
  getResultTagColor,
  isNonMetastasisResult,
} from "../recordTable.logic";
describe("recordTable.logic", () => {
  it("formats ct value with fixed precision", () => {
    expect(formatCt(undefined)).toBe("");
    expect(formatCt("")).toBe("");
    expect(formatCt("1.236")).toBe("1.24");
    expect(formatCt("n/a")).toBe("n/a");
  });
  it("filters records by deleted flag", () => {
    const records = [
      { uuid: "1", isDeleted: false },
      { uuid: "2", isDeleted: true },
      { uuid: "3", isDeleted: false },
    ] as any[];
    expect(filterVisibleRecords(records, false).map((item) => item.uuid)).toEqual([
      "1",
      "3",
    ]);
    expect(filterVisibleRecords(records, true).map((item) => item.uuid)).toEqual([
      "2",
    ]);
  });
  it("judges non-metastasis from threshold", () => {
    const threshold = 0.3108;
    expect(isNonMetastasisResult("0.3108", threshold)).toBe(true);
    expect(isNonMetastasisResult("0.2", threshold)).toBe(true);
    expect(isNonMetastasisResult("0.9", threshold)).toBe(false);
  });
  it("maps raw worker classes without exposing probability", () => {
    const negative = "class=0(N) prob=0.8730";
    const positive = "class=1(P) prob=0.9123";
    expect(getResultKind(negative)).toBe("negative");
    expect(getResultLabelKey(negative)).toBe(
      "recordTable_geneInfo_evaluationResult_non_metastasis",
    );
    expect(getResultTagColor(negative)).toBe("success");
    expect(getResultKind(positive)).toBe("positive");
    expect(getResultLabelKey(positive)).toBe(
      "recordTable_geneInfo_evaluationResult_metastasis",
    );
    expect(getResultTagColor(positive)).toBe("volcano");
  });
});
