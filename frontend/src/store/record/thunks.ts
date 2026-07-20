import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api";
import type {
  SampleRecordDeleteRequestPayload,
  SampleRecordRequestPayload,
  SampleRecordResponsePayload,
} from "../../types";
import type { RootState } from "../index";
import {
  recordThunkTypes,
  setCurrentPage,
  setTestQueueLength,
  updateTestQueue,
} from "./actions";
import { RECORD_ERROR_CODES } from "./errors";
import { DEFAULT_PAGE_SIZE } from "./state";
export const fetchSampleRecordAsync = createAsyncThunk(
  recordThunkTypes.fetch,
  async (
    params: {
      page: number;
      deletedOnly?: boolean;
      searchKeyword?: string;
    },
    { getState, dispatch, rejectWithValue }
  ) => {
    try {
      const currentState = getState() as RootState;
      const deletedOnly =
        params.deletedOnly ?? currentState.record.deletedOnly;
      const searchKeyword =
        params.searchKeyword ?? currentState.record.searchKeyword;
      const ret = await api.fetchSampleRecords({
        instituteName: currentState.user.instituteName,
        page: params.page,
        pageSize: DEFAULT_PAGE_SIZE,
        deletedOnly,
        searchKeyword,
      });
      dispatch(setCurrentPage(params.page));
      return ret.payload[0];
    } catch (error) {
      return rejectWithValue(RECORD_ERROR_CODES.FETCH_FAILED);
    }
  }
);
export const createSampleRecordAsync = createAsyncThunk(
  recordThunkTypes.create,
  async (
    payload: SampleRecordRequestPayload,
    { rejectWithValue }
  ) => {
    try {
      const ret = await api.createSampleRecords(payload);
      if (!ret) {
        return rejectWithValue(RECORD_ERROR_CODES.CREATE_FAILED);
      }
      return ret;
    } catch (error) {
      return rejectWithValue(RECORD_ERROR_CODES.CREATE_FAILED);
    }
  }
);
export const batchCreateSampleRecordsAsync = createAsyncThunk(
  recordThunkTypes.batchCreate,
  async (
    payloadArr: SampleRecordRequestPayload[],
    { getState, dispatch, rejectWithValue }
  ) => {
    const queue = [...payloadArr];
    dispatch(updateTestQueue(queue));
    dispatch(setTestQueueLength(queue.length));
    try {
      while (queue.length > 0) {
        const payload = { ...queue[queue.length - 1] };
        if (!payload.hospitalName) {
          payload.hospitalName = payload.instituteName;
        }
        const ret = await api.createSampleRecords(payload);
        if (ret) {
          queue.pop();
          dispatch(updateTestQueue(queue));
          const current = getState() as RootState;
          dispatch(fetchSampleRecordAsync({ page: current.record.currentPage }));
        } else {
          return rejectWithValue(RECORD_ERROR_CODES.BATCH_CREATE_FAILED);
        }
      }
      return;
    } catch (error) {
      return rejectWithValue(RECORD_ERROR_CODES.BATCH_CREATE_FAILED_INTERNAL);
    }
  }
);
export const deleteSampleRecordAsync = createAsyncThunk(
  recordThunkTypes.delete,
  async (
    params: {
      selectedRows: SampleRecordResponsePayload[];
      deletedOnly?: boolean;
    },
    { getState, dispatch, rejectWithValue }
  ) => {
    try {
      const { selectedRows, deletedOnly } = params;
      const deletePayload: SampleRecordDeleteRequestPayload = selectedRows.map((row) => ({
        uuid: row.uuid
      }));
      const ret = await api.deleteSampleRecords(deletePayload);
      if (!ret) {
        return rejectWithValue(RECORD_ERROR_CODES.DELETE_FAILED);
      }
      const currentState = getState() as RootState;
      const totalBefore = currentState.record.total;
      const pageSize = currentState.record.pageSize;
      const totalAfter = Math.max(totalBefore - selectedRows.length, 0);
      const lastPage = Math.max(1, Math.ceil(totalAfter / pageSize));
      const nextPage = Math.min(currentState.record.currentPage, lastPage);
      dispatch(
        fetchSampleRecordAsync({
          page: nextPage,
          deletedOnly,
        })
      );
      return selectedRows;
    } catch (error) {
      return rejectWithValue(RECORD_ERROR_CODES.DELETE_FAILED);
    }
  }
);
