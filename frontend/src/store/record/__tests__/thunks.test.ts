import { vi, type Mock, type Mocked } from "vitest";
import { api } from "../../../api";
import { Gender, SampleType } from "../../../types";
import { RECORD_ERROR_CODES } from "../errors";
import {
  batchCreateSampleRecordsAsync,
  createSampleRecordAsync,
  deleteSampleRecordAsync,
  fetchSampleRecordAsync,
} from "../thunks";
vi.mock("../../../api", () => ({
  api: {
    fetchSampleRecords: vi.fn(),
    createSampleRecords: vi.fn(),
    deleteSampleRecords: vi.fn(),
  },
}));
const mockedApi = api as Mocked<typeof api>;
const makeRequestPayload = (id: string) => ({
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
});
const makeResponsePayload = (id: string) => ({
  ...makeRequestPayload(id),
  uuid: id,
  result: "",
  isDeleted: 0,
  reviewerName: "",
});
const makeState = (overrides: Partial<any> = {}) =>
  ({
    record: {
      total: 20,
      currentPage: 2,
      pageSize: 15,
      deletedOnly: false,
      searchKeyword: "",
      ...overrides.record,
    },
    user: {
      instituteName: "Institute",
      ...overrides.user,
    },
    ...overrides,
  }) as any;
describe("record thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("fetchSampleRecordAsync calls api and updates current page", async () => {
    mockedApi.fetchSampleRecords.mockResolvedValue({
      code: 0,
      status: "success",
      payload: [{ result: [makeResponsePayload("1")], total: 1 }],
      meta: {},
    } as any);
    const dispatch = vi.fn();
    const getState = vi.fn(() => makeState());
    const action = await fetchSampleRecordAsync({ page: 3 })(dispatch, getState, undefined);
    expect(mockedApi.fetchSampleRecords).toHaveBeenCalledWith({
      instituteName: "Institute",
      page: 3,
      pageSize: 15,
      deletedOnly: false,
      searchKeyword: "",
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "record/setCurrentPage", payload: 3 })
    );
    expect(action.type).toBe("recordTable/fetch/fulfilled");
    expect(action.payload).toEqual({
      result: [makeResponsePayload("1")],
      total: 1,
    });
  });
  test("createSampleRecordAsync resolves on success", async () => {
    mockedApi.createSampleRecords.mockResolvedValue(makeResponsePayload("1") as any);
    const dispatch = vi.fn();
    const action = await createSampleRecordAsync(makeRequestPayload("1"))(
      dispatch,
      vi.fn(),
      undefined
    );
    expect(mockedApi.createSampleRecords).toHaveBeenCalledTimes(1);
    expect(action.type).toBe("recordTable/create/fulfilled");
  });
  test("batchCreateSampleRecordsAsync updates queue and refreshes list", async () => {
    mockedApi.createSampleRecords.mockResolvedValue(makeResponsePayload("1") as any);
    const payloads = [makeRequestPayload("1"), makeRequestPayload("2")];
    const dispatch = vi.fn();
    const getState = vi.fn(() => makeState({ record: { currentPage: 4 } }));
    const action = await batchCreateSampleRecordsAsync(payloads)(
      dispatch,
      getState,
      undefined
    );
    expect(mockedApi.createSampleRecords).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "record/updateTestQueue" })
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "record/setTestQueueLength", payload: 2 })
    );
    expect(dispatch.mock.calls.some(([action]) => typeof action === "function")).toBe(
      true
    );
    expect(action.type).toBe("recordTable/batchCreate/fulfilled");
  });
  test("deleteSampleRecordAsync computes next page and dispatches fetch", async () => {
    mockedApi.deleteSampleRecords.mockResolvedValue({
      code: 0,
      status: "success",
      payload: [],
      meta: {},
    } as any);
    mockedApi.fetchSampleRecords.mockResolvedValue({
      code: 0,
      status: "success",
      payload: [{ result: [], total: 0 }],
      meta: {},
    } as any);
    const selectedRows = [makeResponsePayload("1"), makeResponsePayload("2")];
    const dispatch = vi.fn();
    const getState = vi.fn(() =>
      makeState({
        record: { total: 16, pageSize: 15, currentPage: 2 },
      })
    );
    const action = await deleteSampleRecordAsync({ selectedRows })(
      dispatch,
      getState,
      undefined
    );
    expect(mockedApi.deleteSampleRecords).toHaveBeenCalledWith([
      { uuid: "1" },
      { uuid: "2" }
    ]);
    const fetchThunkCall = dispatch.mock.calls.find(
      ([action]) => typeof action === "function"
    );
    expect(fetchThunkCall).toBeDefined();
    const fetchThunk = fetchThunkCall?.[0] as any;
    await fetchThunk(vi.fn(), getState, undefined);
    expect(mockedApi.fetchSampleRecords).toHaveBeenCalledWith({
      instituteName: "Institute",
      page: 1,
      pageSize: 15,
      deletedOnly: undefined,
    });
    expect(action.type).toBe("recordTable/delete/fulfilled");
    expect(action.payload).toEqual(selectedRows);
  });
  test("fetchSampleRecordAsync returns rejected action on api error", async () => {
    mockedApi.fetchSampleRecords.mockRejectedValue(new Error("network"));
    const dispatch = vi.fn();
    const getState = vi.fn(() => makeState());
    const action = await fetchSampleRecordAsync({ page: 1 })(dispatch, getState, undefined);
    expect(action.type).toBe("recordTable/fetch/rejected");
    expect(action.payload).toBe(RECORD_ERROR_CODES.FETCH_FAILED);
  });

  test("fetchSampleRecordAsync honors explicit deletedOnly param", async () => {
    mockedApi.fetchSampleRecords.mockResolvedValue({
      code: 0,
      status: "success",
      payload: [{ result: [], total: 0 }],
      meta: {},
    } as any);
    const dispatch = vi.fn();
    const getState = vi.fn(() => makeState({ record: { deletedOnly: false } }));
    await fetchSampleRecordAsync({ page: 2, deletedOnly: true })(
      dispatch,
      getState,
      undefined
    );
    expect(mockedApi.fetchSampleRecords).toHaveBeenCalledWith(
      expect.objectContaining({ deletedOnly: true })
    );
  });

  test("fetchSampleRecordAsync honors explicit searchKeyword param", async () => {
    mockedApi.fetchSampleRecords.mockResolvedValue({
      code: 0,
      status: "success",
      payload: [{ result: [], total: 0 }],
      meta: {},
    } as any);
    const dispatch = vi.fn();
    const getState = vi.fn(() => makeState({ record: { searchKeyword: "old" } }));
    await fetchSampleRecordAsync({ page: 2, searchKeyword: "S-001" })(
      dispatch,
      getState,
      undefined
    );
    expect(mockedApi.fetchSampleRecords).toHaveBeenCalledWith(
      expect.objectContaining({ searchKeyword: "S-001" })
    );
  });

  test("createSampleRecordAsync rejected when api returns falsy", async () => {
    mockedApi.createSampleRecords.mockResolvedValue(undefined as any);
    const action = await createSampleRecordAsync(makeRequestPayload("x"))(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("recordTable/create/rejected");
    expect(action.payload).toBe(RECORD_ERROR_CODES.CREATE_FAILED);
  });

  test("createSampleRecordAsync rejected when api throws", async () => {
    mockedApi.createSampleRecords.mockRejectedValue(new Error("network"));
    const action = await createSampleRecordAsync(makeRequestPayload("x"))(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("recordTable/create/rejected");
    expect(action.payload).toBe(RECORD_ERROR_CODES.CREATE_FAILED);
  });

  test("batchCreateSampleRecordsAsync fills missing hospitalName from instituteName", async () => {
    mockedApi.createSampleRecords.mockResolvedValue(makeResponsePayload("1") as any);
    const payloadWithoutHospital = { ...makeRequestPayload("1"), hospitalName: "" };
    await batchCreateSampleRecordsAsync([payloadWithoutHospital])(
      vi.fn(),
      vi.fn(() => makeState()),
      undefined
    );
    expect(mockedApi.createSampleRecords).toHaveBeenCalledWith(
      expect.objectContaining({ hospitalName: "Institute" })
    );
  });

  test("batchCreateSampleRecordsAsync rejected on falsy api return", async () => {
    mockedApi.createSampleRecords.mockResolvedValue(undefined as any);
    const action = await batchCreateSampleRecordsAsync([makeRequestPayload("1")])(
      vi.fn(),
      vi.fn(() => makeState()),
      undefined
    );
    expect(action.type).toBe("recordTable/batchCreate/rejected");
    expect(action.payload).toBe(RECORD_ERROR_CODES.BATCH_CREATE_FAILED);
  });

  test("batchCreateSampleRecordsAsync rejected on thrown error", async () => {
    mockedApi.createSampleRecords.mockRejectedValue(new Error("network"));
    const action = await batchCreateSampleRecordsAsync([makeRequestPayload("1")])(
      vi.fn(),
      vi.fn(() => makeState()),
      undefined
    );
    expect(action.type).toBe("recordTable/batchCreate/rejected");
    expect(action.payload).toBe(RECORD_ERROR_CODES.BATCH_CREATE_FAILED_INTERNAL);
  });

  test("deleteSampleRecordAsync rejected on falsy api result", async () => {
    mockedApi.deleteSampleRecords.mockResolvedValue(undefined as any);
    const action = await deleteSampleRecordAsync({
      selectedRows: [makeResponsePayload("1")],
    })(vi.fn(), vi.fn(() => makeState()), undefined);
    expect(action.type).toBe("recordTable/delete/rejected");
    expect(action.payload).toBe(RECORD_ERROR_CODES.DELETE_FAILED);
  });

  test("deleteSampleRecordAsync rejected on thrown error", async () => {
    mockedApi.deleteSampleRecords.mockRejectedValue(new Error("network"));
    const action = await deleteSampleRecordAsync({
      selectedRows: [makeResponsePayload("1")],
    })(vi.fn(), vi.fn(() => makeState()), undefined);
    expect(action.type).toBe("recordTable/delete/rejected");
    expect(action.payload).toBe(RECORD_ERROR_CODES.DELETE_FAILED);
  });
});
