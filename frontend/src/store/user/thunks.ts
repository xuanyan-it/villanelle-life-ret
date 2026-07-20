import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../api";
import type { LoginRequestPayload, RegisterRequestPayload } from "../../types";
import { userThunkTypes } from "./actions";
import { USER_ERROR_CODES } from "./errors";
type UserErrorCode = (typeof USER_ERROR_CODES)[keyof typeof USER_ERROR_CODES];
type UserCreateParams = RegisterRequestPayload & { bootstrap?: boolean };

const resolveUserCreateErrorCode = (message: unknown): UserErrorCode | undefined => {
  if (typeof message !== "string") {
    return undefined;
  }

  const normalized = message.trim().toLowerCase();

  switch (normalized) {
    case "institute exists":
      return USER_ERROR_CODES.CREATE_FAILED_INSTITUTE_EXISTS;
    case "email exists":
      return USER_ERROR_CODES.CREATE_FAILED_EMAIL_EXISTS;
    case "username exists":
      return USER_ERROR_CODES.CREATE_FAILED_USERNAME_EXISTS;
    default:
      return undefined;
  }
};

export const verifyRegisterTokenAsync = createAsyncThunk(
  userThunkTypes.verifyToken,
  async (params: { token: string }, { rejectWithValue }) => {
    try {
      const { token } = params;
      const ret = await api.verifyToken(token);
      if (ret.code) {
        return rejectWithValue(USER_ERROR_CODES.VERIFY_TOKEN_INVALID);
      }
      return ret.payload[0];
    } catch (error) {
      return rejectWithValue(USER_ERROR_CODES.VERIFY_TOKEN_FAILED_INTERNAL);
    }
  }
);
export const userCreateAsync = createAsyncThunk(
  userThunkTypes.userCreate,
  async (params: UserCreateParams, { rejectWithValue }) => {
    try {
      const { email, password, instituteName, username, userRole, bootstrap } = params;
      const ret = bootstrap
        ? await api.instituteRegister({
            email,
            password,
            instituteName,
            username,
          })
        : await api.userCreate({
            email,
            password,
            instituteName,
            username,
            userRole,
          });
      if (ret.code) {
        const rejectKey =
          resolveUserCreateErrorCode(ret.message) ?? USER_ERROR_CODES.CREATE_FAILED;
        return rejectWithValue(rejectKey);
      }
      return ret.payload;
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        (error as any)?.message ??
        undefined;
      const rejectKey = resolveUserCreateErrorCode(message) ?? USER_ERROR_CODES.CREATE_FAILED;
      return rejectWithValue(rejectKey);
    }
  }
);
export const userLoginAsync = createAsyncThunk(
  userThunkTypes.userLogin,
  async (params: LoginRequestPayload, { rejectWithValue }) => {
    try {
      const { email, password } = params;
      const ret = await api.userLogin({ email, password });
      if (ret.code) {
        return rejectWithValue(USER_ERROR_CODES.LOGIN_FAILED);
      }
      return ret.payload;
    } catch (error) {
      return rejectWithValue(USER_ERROR_CODES.LOGIN_FAILED);
    }
  }
);
export const userLogoutAsync = createAsyncThunk(
  userThunkTypes.userLogout,
  async () => {
    try {
      await api.userLogout();
    } catch {
      // Keep local logout path available when network is unavailable.
    }
    return;
  }
);
