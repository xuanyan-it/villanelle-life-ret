import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import type { LocaleEnum } from "../../types";
const initialState: string = "zh-CN";
const localeSlice = createSlice({
  name: "locale",
  initialState,
  reducers: {
    updateLocale: (prevState, action: PayloadAction<LocaleEnum>) => {
      return action.payload ? action.payload : prevState;
    },
  },
});
export default localeSlice.reducer;
export const { updateLocale } = localeSlice.actions;
