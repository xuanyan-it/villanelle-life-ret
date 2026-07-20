import { Gender, SampleType } from "../../../types";
import reducer, { closeReportPreviewer, openReportPreviewer } from "../slice";
const makeRecord = (id: string) => ({
  uuid: id,
  hospitalName: "Hospital",
  patientGender: Gender.Female,
  sampleId: `S-${id}`,
  sampleType: SampleType.Regular,
  samplingDate: "2026-01-01",
  receptionDate: "2026-01-01",
  testDate: "2026-01-01",
  RPS4Y1: "1",
  PKHD1L1: "1",
  CRABP1: "1",
  GAPDH: "1",
  testerName: "Tester",
  instituteName: "Institute",
  result: "",
  isDeleted: 0,
  reviewerName: "",
});
describe("reportPreviewer store", () => {
  test("returns initial state", () => {
    expect(reducer(undefined, { type: "unknown" })).toEqual({
      open: false,
      record: null,
    });
  });
  test("open/close previewer", () => {
    const opened = reducer(
      undefined,
      openReportPreviewer({ record: makeRecord("1") })
    );
    expect(opened.open).toBe(true);
    expect(opened.record?.uuid).toBe("1");
    const closed = reducer(opened, closeReportPreviewer());
    expect(closed).toEqual({ open: false, record: null });
  });
});
