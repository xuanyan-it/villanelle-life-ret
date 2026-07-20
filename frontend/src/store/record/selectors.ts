import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../index";
export const getRecordTableStatus = (state: RootState) => state.record.status;
export const getRecordList = (state: RootState) => state.record.recordList;
export const getTotalRecords = (state: RootState) => state.record.total;
export const getCurrentPage = (state: RootState) => state.record.currentPage;
export const getPageSize = (state: RootState) => state.record.pageSize;
export const getDeletedOnly = (state: RootState) => state.record.deletedOnly;
export const getSearchKeyword = (state: RootState) => state.record.searchKeyword;
const getSelectedRowsByPage = (state: RootState) =>
  state.record.selectedRowsByPage;
export const getSelectedRows = createSelector(
  getSelectedRowsByPage,
  (selected) => selected.flatMap((item) => item.rows)
);
export const getSelectedRowKeys = createSelector(
  getSelectedRowsByPage,
  (selected) => selected.flatMap((item) => item.rowKeys)
);
export const getTestQueue = (state: RootState) => state.record.testQueue;
export const getTestQueueLength = (state: RootState) =>
  state.record.testQueueLength;
export const selectBatchPendingCount = createSelector(
  getTestQueue,
  (testQueue) => testQueue.length
);
export const selectBatchTotalCount = getTestQueueLength;
export const selectBatchCompletedCount = createSelector(
  selectBatchTotalCount,
  selectBatchPendingCount,
  (total, pending) => (total ? total - pending : 0)
);
export const selectBatchProgressPercent = createSelector(
  selectBatchTotalCount,
  selectBatchPendingCount,
  (total, pending) => {
    if (!total) {
      return 0;
    }
    if (pending === 0) {
      return 100;
    }
    return (1 - pending / total) * 100;
  }
);
export const selectIsBatchBusy = createSelector(
  selectBatchTotalCount,
  selectBatchPendingCount,
  (total, pending) => Boolean(total && pending > 0)
);
export const selectIsBatchCompleted = createSelector(
  selectBatchTotalCount,
  selectBatchPendingCount,
  (total, pending) => Boolean(total && pending === 0)
);
export const selectBatchProgressState = createSelector(
  selectBatchTotalCount,
  selectBatchPendingCount,
  selectBatchCompletedCount,
  selectBatchProgressPercent,
  selectIsBatchBusy,
  selectIsBatchCompleted,
  (
    totalCount,
    pendingCount,
    completedCount,
    progressPercent,
    isBusy,
    isCompleted
  ) => ({
    totalCount,
    pendingCount,
    completedCount,
    progressPercent,
    isBusy,
    isCompleted,
  })
);
