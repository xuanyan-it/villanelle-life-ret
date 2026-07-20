import { createSlice } from "@reduxjs/toolkit";
import { RequestStatus } from "../../types";
import { initialState } from "./state";
import {
  deleteUserAsync,
  fetchInstituteCredentialAsync,
  fetchUserListAsync,
} from "./thunks";
const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInstituteCredentialAsync.pending, (state) => {
        state.status = RequestStatus.Pending;
      })
      .addCase(fetchInstituteCredentialAsync.rejected, (state) => {
        state.status = RequestStatus.Error;
      })
      .addCase(fetchInstituteCredentialAsync.fulfilled, (state, action) => {
        const data = action.payload.result[0];
        state.token = data.token;
        state.status = RequestStatus.Success;
      })
      .addCase(fetchUserListAsync.pending, (state) => {
        state.status = RequestStatus.Pending;
      })
      .addCase(fetchUserListAsync.rejected, (state) => {
        state.status = RequestStatus.Error;
      })
      .addCase(fetchUserListAsync.fulfilled, (state, action) => {
        state.total = action.payload.total;
        state.userList = action.payload.result;
        state.status = RequestStatus.Success;
      })
      .addCase(deleteUserAsync.pending, (state) => {
        state.status = RequestStatus.Pending;
      })
      .addCase(deleteUserAsync.rejected, (state) => {
        state.status = RequestStatus.Error;
      })
      .addCase(deleteUserAsync.fulfilled, (state) => {
        state.status = RequestStatus.Success;
      });
  },
});
export default adminSlice.reducer;
