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
    expect(getResultKind(negative, "2class")).toBe("nonRet");
    expect(getResultLabelKey(negative, "2class")).toBe(
      "recordTable_geneInfo_evaluationResult_nonRet",
    );
    expect(getResultTagColor(negative, "2class")).toBe("success");
    expect(getResultKind(positive, "2class")).toBe("ret");
    expect(getResultLabelKey(positive, "2class")).toBe(
      "recordTable_geneInfo_evaluationResult_ret",
    );
    expect(getResultTagColor(positive, "2class")).toBe("volcano");
  });

  it("maps every class by model type", () => {
    expect(getResultKind("class=0(Negative) prob=0.9", "3class")).toBe("negative");
    expect(getResultKind("class=1(RET) prob=0.9", "3class")).toBe("ret");
    expect(getResultKind("class=2(BRAFV600E) prob=0.9", "3class")).toBe("brafv600e");

    expect(getResultKind("class=0(Negative) prob=0.9", "5class")).toBe("negative");
    expect(getResultKind("class=1(RET) prob=0.9", "5class")).toBe("ret");
    expect(getResultKind("class=2(BRAFV600E) prob=0.9", "5class")).toBe("brafv600e");
    expect(getResultKind("class=3(BRAF+TERT) prob=0.9", "5class")).toBe("brafTert");
    expect(getResultKind("class=4(RAS) prob=0.9", "5class")).toBe("ras");
    expect(getResultTagColor("class=3(BRAF+TERT)", "5class")).toBe("magenta");
    expect(getResultTagColor("class=4(RAS)", "5class")).toBe("gold");
  });
});
