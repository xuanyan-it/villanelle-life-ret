import { createSlice } from "@reduxjs/toolkit";
import { RequestStatus } from "../../types";
import {
  abortTestQueue,
  setCurrentPage,
  setDeletedOnly,
  setSearchKeyword,
  setPageSize,
  setSelectedRows,
  setTestQueueLength,
  unselectRows,
  updateTestQueue,
} from "./actions";
import { initialState } from "./state";
import {
  batchCreateSampleRecordsAsync,
  createSampleRecordAsync,
  deleteSampleRecordAsync,
  fetchSampleRecordAsync,
} from "./thunks";
const recordSlice = createSlice({
  name: "record",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(setCurrentPage, (state, action) => {
        state.currentPage = action.payload;
      })
      .addCase(setPageSize, (state) => {
        // keep behavior unchanged for now
      })
      .addCase(setSelectedRows, (state, action) => {
        if (
          !state.selectedRowsByPage.some(
            (item) => item.page === action.payload.page
          )
        ) {
          state.selectedRowsByPage = [...state.selectedRowsByPage, action.payload];
          return;
        }
        state.selectedRowsByPage = state.selectedRowsByPage.map((item) =>
          item.page === action.payload.page ? action.payload : item
        );
      })
      .addCase(setDeletedOnly, (state, action) => {
        state.deletedOnly = action.payload;
      })
      .addCase(setSearchKeyword, (state, action) => {
        state.searchKeyword = action.payload;
      })
      .addCase(unselectRows, (state) => {
        state.selectedRowsByPage = [];
      })
      .addCase(updateTestQueue, (state, action) => {
        state.testQueue = [...action.payload];
      })
      .addCase(setTestQueueLength, (state, action) => {
        state.testQueueLength = action.payload;
      })
      .addCase(abortTestQueue, (state) => {
        state.testQueueLength = 0;
        state.testQueue = [];
      })
      .addCase(fetchSampleRecordAsync.pending, (state, action) => {
        state.activeFetchRequestId = action.meta.requestId;
        state.status = RequestStatus.Pending;
      })
      .addCase(fetchSampleRecordAsync.rejected, (state, action) => {
        if (state.activeFetchRequestId !== action.meta.requestId) {
          return;
        }
        state.activeFetchRequestId = undefined;
        state.status = RequestStatus.Error;
      })
      .addCase(fetchSampleRecordAsync.fulfilled, (state, action) => {
        if (state.activeFetchRequestId !== action.meta.requestId) {
          return;
        }
        state.activeFetchRequestId = undefined;
        const payload = action.payload;
        state.recordList = payload.result;
        state.total = payload.total;
        state.status = RequestStatus.Success;
      })
      .addCase(createSampleRecordAsync.rejected, (state) => {
        state.status = RequestStatus.Error;
      })
      .addCase(createSampleRecordAsync.fulfilled, (state) => {
        state.status = RequestStatus.Success;
      })
      .addCase(batchCreateSampleRecordsAsync.rejected, (state) => {
        state.status = RequestStatus.Error;
      })
      .addCase(batchCreateSampleRecordsAsync.fulfilled, (state) => {
        state.status = RequestStatus.Success;
      })
      .addCase(deleteSampleRecordAsync.fulfilled, (state, action) => {
        const uuidSet = new Set(action.payload.map((record) => record.uuid));
        state.recordList = state.recordList.filter(
          (record) => !uuidSet.has(record.uuid)
        );
        state.selectedRowsByPage = [];
      });
  },
});
export default recordSlice.reducer;
