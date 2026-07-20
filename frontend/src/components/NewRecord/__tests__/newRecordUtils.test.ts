import { SampleType } from "../../../types";
import {
  getSampleIdPrefix,
  isNotAvailableValue,
  mergeSampleId,
} from "../newRecordUtils";
describe("newRecordUtils", () => {
  test("getSampleIdPrefix returns expected prefixes", () => {
    expect(getSampleIdPrefix(SampleType.Regular, "positive")).toBe("TT-");
    expect(getSampleIdPrefix(SampleType.QualityContral, "positive")).toBe("PQ-");
    expect(getSampleIdPrefix(SampleType.QualityContral, "negative")).toBe("NQ-");
  });
  test("mergeSampleId normalizes prefixes", () => {
    expect(
      mergeSampleId("123", SampleType.Regular, "positive")
    ).toBe("TT-123");
    expect(
      mergeSampleId("TT-456", SampleType.Regular, "positive")
    ).toBe("TT-456");
    expect(
      mergeSampleId("PQ-789", SampleType.QualityContral, "negative")
    ).toBe("NQ-789");
    expect(
      mergeSampleId("123   ", SampleType.Regular, "positive")
    ).toBe("TT-123   ");
  });
  test("isNotAvailableValue detects n/a case-insensitively", () => {
    expect(isNotAvailableValue("n/a")).toBe(true);
    expect(isNotAvailableValue("N/A")).toBe(true);
    expect(isNotAvailableValue("na")).toBe(false);
    expect(isNotAvailableValue(null)).toBe(false);
  });
});
