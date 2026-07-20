import { Gender, RequestStatus, SampleType } from "../../../types";
import {
  setCurrentPage,
  setDeletedOnly,
  setSelectedRows,
  setTestQueueLength,
  unselectRows,
  updateTestQueue,
} from "../actions";
import reducer from "../slice";
import { initialState } from "../state";
import {
  createSampleRecordAsync,
  deleteSampleRecordAsync,
  fetchSampleRecordAsync,
} from "../thunks";
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
describe("record slice", () => {
  test("returns initial state", () => {
    expect(reducer(undefined, { type: "unknown" })).toEqual(initialState);
  });
  test("handles basic sync actions", () => {
    let state = reducer(initialState, setCurrentPage(3));
    state = reducer(state, setDeletedOnly(true));
    state = reducer(state, setTestQueueLength(2));
    state = reducer(
      state,
      updateTestQueue([
        {
          hospitalName: "Hospital",
          patientGender: Gender.Male,
          sampleId: "S-1",
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
        },
      ])
    );
    expect(state.currentPage).toBe(3);
    expect(state.deletedOnly).toBe(true);
    expect(state.testQueueLength).toBe(2);
    expect(state.testQueue).toHaveLength(1);
  });
  test("adds and replaces selected rows by page", () => {
    const firstSelection = {
      page: 1,
      rows: [makeRecord("1")],
      rowKeys: ["1"],
    };
    const updatedSelection = {
      page: 1,
      rows: [makeRecord("2")],
      rowKeys: ["2"],
    };
    let state = reducer(initialState, setSelectedRows(firstSelection));
    state = reducer(state, setSelectedRows(updatedSelection));
    expect(state.selectedRowsByPage).toEqual([updatedSelection]);
  });
  test("clears selected rows", () => {
    const stateWithSelection = reducer(
      initialState,
      setSelectedRows({
        page: 1,
        rows: [makeRecord("1")],
        rowKeys: ["1"],
      })
    );
    const state = reducer(stateWithSelection, unselectRows());
    expect(state.selectedRowsByPage).toEqual([]);
  });
  test("handles fetch async lifecycle", () => {
    let state = reducer(initialState, fetchSampleRecordAsync.pending("", { page: 1 }));
    expect(state.status).toBe(RequestStatus.Pending);
    state = reducer(
      state,
      fetchSampleRecordAsync.fulfilled(
        { result: [makeRecord("1")], total: 1 },
        "",
        { page: 1 }
      )
    );
    expect(state.status).toBe(RequestStatus.Success);
    expect(state.total).toBe(1);
    expect(state.recordList).toHaveLength(1);
    const pendingState = reducer(
      initialState,
      fetchSampleRecordAsync.pending("r-1", { page: 1 })
    );
    const rejectedState = reducer(
      pendingState,
      fetchSampleRecordAsync.rejected(null, "r-1", { page: 1 })
    );
    expect(rejectedState.status).toBe(RequestStatus.Error);
  });
  test("handles create rejected", () => {
    const state = reducer(
      initialState,
      createSampleRecordAsync.rejected(
        null,
        "",
        {
          hospitalName: "Hospital",
          patientGender: Gender.Female,
          sampleId: "S-1",
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
        }
      )
    );
    expect(state.status).toBe(RequestStatus.Error);
  });
  test("removes deleted records and clears selections", () => {
    const selected = [makeRecord("1"), makeRecord("3")];
    const startState = {
      ...initialState,
      recordList: [makeRecord("1"), makeRecord("2"), makeRecord("3")],
      selectedRowsByPage: [{ page: 1, rows: [makeRecord("2")], rowKeys: ["2"] }],
    };
    const state = reducer(
      startState,
      deleteSampleRecordAsync.fulfilled(selected, "", {
        selectedRows: selected,
      })
    );
    expect(state.recordList.map((item) => item.uuid)).toEqual(["2"]);
    expect(state.selectedRowsByPage).toEqual([]);
  });
});
