import { Gender, SampleType } from "../../../types";
import {
  getSelectedRowKeys,
  getSelectedRows,
  selectBatchCompletedCount,
  selectBatchPendingCount,
  selectBatchProgressPercent,
  selectBatchProgressState,
} from "../selectors";
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
const makeState = (overrides: Partial<any> = {}) =>
  ({
    record: {
      status: "none",
      total: 0,
      currentPage: 1,
      pageSize: 15,
      deletedOnly: false,
      recordList: [],
      selectedRowsByPage: [],
      testQueueLength: 0,
      testQueue: [],
      ...overrides,
    },
  }) as any;
describe("record selectors", () => {
  test("flattens selected rows and row keys across pages", () => {
    const state = makeState({
      selectedRowsByPage: [
        { page: 1, rows: [makeRecord("1")], rowKeys: ["1"] },
        { page: 2, rows: [makeRecord("2"), makeRecord("3")], rowKeys: ["2", "3"] },
      ],
    });
    expect(getSelectedRows(state).map((row) => row.uuid)).toEqual(["1", "2", "3"]);
    expect(getSelectedRowKeys(state)).toEqual(["1", "2", "3"]);
  });
  test("computes batch progress values", () => {
    const state = makeState({
      testQueueLength: 5,
      testQueue: [{}, {}],
    });
    expect(selectBatchPendingCount(state)).toBe(2);
    expect(selectBatchCompletedCount(state)).toBe(3);
    expect(selectBatchProgressPercent(state)).toBe(60);
  });
  test("uses worker progress while an evaluation is running", () => {
    const state = makeState({
      testQueueLength: 1,
      testQueue: [{}],
      evaluationProgressPercent: 40,
    });
    expect(selectBatchProgressPercent(state)).toBe(40);
    expect(selectBatchProgressState(state)).toMatchObject({
      progressPercent: 40,
      isBusy: true,
    });
  });
  test("returns idle state when queue is empty", () => {
    const state = makeState();
    expect(selectBatchProgressState(state)).toEqual({
      totalCount: 0,
      pendingCount: 0,
      completedCount: 0,
      progressPercent: 0,
      isBusy: false,
      isCompleted: false,
    });
  });
});
