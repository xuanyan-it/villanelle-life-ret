import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import type { NotificationState } from "../../types";
const initialState: NotificationState = {
  message: "",
  description: "",
  type: "info",
};
const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    pushNotification: (state, action: PayloadAction<NotificationState>) => {
      const nextState = {
        ...state,
        type: action.payload.type,
        message: action.payload.message,
        description: action.payload.description,
      };
      return nextState;
    },
    resetNotification: () => {
      return { ...initialState };
    },
  },
});
export default notificationSlice.reducer;
export const { pushNotification, resetNotification } = notificationSlice.actions;
