import type { PayloadAction} from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import type {
  InstituteQueryResponsePayload} from "../../types";
import {
  RequestStatus,
} from "../../types";
import { initialState } from "./state";
import {
  userCreateAsync,
  userLoginAsync,
  userLogoutAsync,
  verifyRegisterTokenAsync,
} from "./thunks";
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(verifyRegisterTokenAsync.pending, (state) => {
        state.status = RequestStatus.Pending;
      })
      .addCase(verifyRegisterTokenAsync.rejected, (state) => {
        state.status = RequestStatus.Error;
      })
      .addCase(
        verifyRegisterTokenAsync.fulfilled,
        (state, action: PayloadAction<InstituteQueryResponsePayload>) => {
          const data = action.payload;
          state.instituteName = data.result[0].instituteName;
          state.status = RequestStatus.None;
        }
      )
      .addCase(userCreateAsync.pending, (state) => {
        state.status = RequestStatus.Pending;
      })
      .addCase(userCreateAsync.rejected, (state) => {
        return { ...initialState, status: RequestStatus.Error };
      })
      .addCase(userCreateAsync.fulfilled, (state, action) => {
        const data = action.payload[0];
        state.instituteName = data.instituteName;
        state.username = data.username;
        state.email = data.email;
        state.userRole = data.userRole;
        state.status = RequestStatus.Success;
      })
      .addCase(userLoginAsync.pending, (state) => {
        state.status = RequestStatus.Pending;
      })
      .addCase(userLoginAsync.rejected, () => {
        return { ...initialState, status: RequestStatus.Error };
      })
      .addCase(userLoginAsync.fulfilled, (state, action) => {
        const data = action.payload[0];
        state.instituteName = data.instituteName;
        state.username = data.username;
        state.email = data.email;
        state.userRole = data.userRole;
        state.status = RequestStatus.Success;
      })
      .addCase(userLogoutAsync.fulfilled, () => {
        return { ...initialState };
      });
  },
});
export default userSlice.reducer;
