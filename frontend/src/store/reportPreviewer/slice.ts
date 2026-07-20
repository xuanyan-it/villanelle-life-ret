import type { PayloadAction} from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import type { SampleRecordResponsePayload } from "../../types";
export type ReportPreviewerStatus = {
  open: boolean;
  record: SampleRecordResponsePayload | null;
};
export type ReportPreviewerPayload = {
  record: SampleRecordResponsePayload;
};
const initialState: ReportPreviewerStatus = {
  open: false,
  record: null,
};
const reportPreviewerSlice = createSlice({
  name: "reportPreviewer",
  initialState,
  reducers: {
    openReportPreviewer: (state, action: PayloadAction<ReportPreviewerPayload>) => {
      const { record } = action.payload;
      return { ...state, open: true, record };
    },
    closeReportPreviewer: (state) => {
      return {
        ...state,
        open: false,
        record: null,
      };
    },
  },
});
export default reportPreviewerSlice.reducer;
export const { openReportPreviewer, closeReportPreviewer } =
  reportPreviewerSlice.actions;
