import { createAction } from "@reduxjs/toolkit";
import type {
  SampleRecordRequestPayload,
  SelectedRowsByPage,
} from "../../types";
export const recordThunkTypes = {
  fetch: "recordTable/fetch",
  create: "recordTable/create",
  batchCreate: "recordTable/batchCreate",
  delete: "recordTable/delete",
} as const;
export const setCurrentPage = createAction<number>("record/setCurrentPage");
export const setPageSize = createAction<number>("record/setPageSize");
export const setSelectedRows =
  createAction<SelectedRowsByPage>("record/setSelectedRows");
export const setDeletedOnly = createAction<boolean>("record/setDeletedOnly");
export const setSearchKeyword = createAction<string>("record/setSearchKeyword");
export const unselectRows = createAction("record/unselectRows");
export const updateTestQueue =
  createAction<SampleRecordRequestPayload[]>("record/updateTestQueue");
export const setTestQueueLength =
  createAction<number>("record/setTestQueueLength");
export const setEvaluationProgressPercent = createAction<number | null>(
  "record/setEvaluationProgressPercent",
);
export const abortTestQueue = createAction("record/abortTestQueue");
