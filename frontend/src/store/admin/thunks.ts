import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api";
import type { UserQueryRequestPayload } from "../../types";
import type { RootState } from "../index";
import { adminThunkTypes } from "./actions";
import { ADMIN_ERROR_CODES } from "./errors";
export const fetchInstituteCredentialAsync = createAsyncThunk(
  adminThunkTypes.fetchCredential,
  async (params: { instituteName: string }, { rejectWithValue }) => {
    try {
      const { instituteName } = params;
      if (!instituteName) throw new Error();
      const ret = await api.fetchInstituteCredential({ instituteName });
      if (ret.code) {
        return rejectWithValue(ADMIN_ERROR_CODES.FETCH_CREDENTIAL_FAILED);
      }
      return ret.payload[0];
    } catch (error) {
      return rejectWithValue(ADMIN_ERROR_CODES.FETCH_CREDENTIAL_FAILED);
    }
  }
);
export const fetchUserListAsync = createAsyncThunk(
  adminThunkTypes.listUsers,
  async (
    params: UserQueryRequestPayload,
    { rejectWithValue }
  ) => {
    try {
      const { instituteName } = params;
      if (!instituteName) throw new Error();
      const ret = await api.userList({ instituteName });
      if (!ret.payload.length) {
        return rejectWithValue(ADMIN_ERROR_CODES.LIST_USERS_FAILED);
      }
      return ret.payload[0];
    } catch (error) {
      return rejectWithValue(ADMIN_ERROR_CODES.LIST_USERS_FAILED);
    }
  }
);
export const deleteUserAsync = createAsyncThunk(
  adminThunkTypes.deleteUser,
  async (uuid: string, { getState, dispatch, rejectWithValue }) => {
    try {
      const ret = await api.userDelete([{ uuid }]);
      if (ret.code) {
        return rejectWithValue(ADMIN_ERROR_CODES.DELETE_USER_FAILED);
      }
      const current = getState() as RootState;
      dispatch(fetchUserListAsync({ instituteName: current.user.instituteName }));
      return true;
    } catch (error) {
      return rejectWithValue(ADMIN_ERROR_CODES.DELETE_USER_FAILED);
    }
  }
);
