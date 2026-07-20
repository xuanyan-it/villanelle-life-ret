import { configureStore } from "@reduxjs/toolkit";
import {
  ADMIN_ERROR_CODES,
  deleteUserAsync,
  fetchInstituteCredentialAsync,
  fetchUserListAsync,
} from "../../admin";
import notificationReducer from "../../notification/slice";
import {
  batchCreateSampleRecordsAsync,
  createSampleRecordAsync,
  deleteSampleRecordAsync,
  RECORD_ERROR_CODES,
} from "../../record";
import {
  USER_ERROR_CODES,
  userCreateAsync,
  userLoginAsync,
  verifyRegisterTokenAsync,
} from "../../user";
import { notificationListenerMiddleware } from "../notificationListener";
const setup = () =>
  configureStore({
    reducer: {
      notification: notificationReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(notificationListenerMiddleware.middleware),
  });
describe("notification listener", () => {
  test("handles user login success", () => {
    const store = setup();
    store.dispatch(
      userLoginAsync.fulfilled(
        [{ username: "alice", email: "a@b.com" }] as any,
        "req-1",
        { email: "a@b.com", password: "x" }
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_login_success_message"
    );
  });
  test("handles user create email exists", () => {
    const store = setup();
    store.dispatch(
      userCreateAsync.rejected(
        null,
        "req-2",
        {
          email: "a@b.com",
          password: "x",
          instituteName: "Institute",
          username: "alice",
          userRole: "operator" as any,
        },
        USER_ERROR_CODES.CREATE_FAILED_EMAIL_EXISTS
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_register_email_exists_message"
    );
  });

  test("handles user create username exists", () => {
    const store = setup();
    store.dispatch(
      userCreateAsync.rejected(
        null,
        "req-2b",
        {
          email: "a@b.com",
          password: "x",
          instituteName: "Institute",
          username: "alice",
          userRole: "operator" as any,
        },
        USER_ERROR_CODES.CREATE_FAILED_USERNAME_EXISTS
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_register_username_exists_message"
    );
  });

  test("handles user create institute exists", () => {
    const store = setup();
    store.dispatch(
      userCreateAsync.rejected(
        null,
        "req-2c",
        {
          email: "a@b.com",
          password: "x",
          instituteName: "Institute",
          username: "alice",
          userRole: "administrator" as any,
        },
        USER_ERROR_CODES.CREATE_FAILED_INSTITUTE_EXISTS
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_register_institute_exists_message"
    );
  });
  test("handles user list rejected", () => {
    const store = setup();
    store.dispatch(
      fetchUserListAsync.rejected(
        null,
        "req-3",
        { instituteName: "Institute" },
        ADMIN_ERROR_CODES.LIST_USERS_FAILED
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_fetchUserList_error_message"
    );
  });
  test("handles verify token rejected (invalid token)", () => {
    const store = setup();
    store.dispatch(
      verifyRegisterTokenAsync.rejected(
        null,
        "req-4",
        { token: "invalid-token" },
        USER_ERROR_CODES.VERIFY_TOKEN_INVALID
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_tokenVerification_error_message"
    );
  });
  test("handles batch create success", () => {
    const store = setup();
    store.dispatch(batchCreateSampleRecordsAsync.fulfilled(undefined, "req-5", []));
    expect(store.getState().notification.message).toBe(
      "notification_recordCreate_success_message"
    );
  });
  test("handles single create success", () => {
    const store = setup();
    store.dispatch(
      createSampleRecordAsync.fulfilled({} as any, "req-5b", {} as any)
    );
    expect(store.getState().notification.message).toBe(
      "notification_recordCreate_success_message"
    );
  });
  test("ignores batch create rejected notification", () => {
    const store = setup();
    store.dispatch(
      batchCreateSampleRecordsAsync.rejected(
        null,
        "req-7",
        [] as any,
        RECORD_ERROR_CODES.BATCH_CREATE_FAILED_INTERNAL
      )
    );
    expect(store.getState().notification.message).toBe("");
  });
  test("ignores single create rejected notification", () => {
    const store = setup();
    store.dispatch(
      createSampleRecordAsync.rejected(
        null,
        "req-8",
        {} as any,
        RECORD_ERROR_CODES.CREATE_FAILED
      )
    );
    expect(store.getState().notification.message).toBe("");
  });
  test("handles delete record success", () => {
    const store = setup();
    store.dispatch(
      deleteSampleRecordAsync.fulfilled(
        [{ uuid: "1" }] as any,
        "req-6",
        { selectedRows: [{ uuid: "1" }] as any }
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_recordDelete_success_message"
    );
  });

  test("falls back to internal error when token verify fails with unknown reason", () => {
    const store = setup();
    store.dispatch(
      verifyRegisterTokenAsync.rejected(
        null,
        "req-9",
        { token: "t" },
        USER_ERROR_CODES.VERIFY_TOKEN_FAILED_INTERNAL
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_serverInternalError_message"
    );
  });

  test("does not notify when fetch user list rejected with unrelated reason", () => {
    const store = setup();
    store.dispatch(
      fetchUserListAsync.rejected(
        null,
        "req-10",
        { instituteName: "Institute" },
        "OTHER_ERROR" as any
      )
    );
    expect(store.getState().notification.message).toBe("");
  });

  test("handles fetch credential failure with server error notification", () => {
    const store = setup();
    store.dispatch(
      fetchInstituteCredentialAsync.rejected(
        null,
        "req-11",
        { instituteName: "Institute" },
        ADMIN_ERROR_CODES.FETCH_CREDENTIAL_FAILED
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_serverInternalError_message"
    );
  });

  test("does not notify when delete user rejected with unrelated reason", () => {
    const store = setup();
    store.dispatch(
      deleteUserAsync.rejected(
        null,
        "req-12",
        [{ uuid: "u1" }],
        "UNRELATED" as any
      )
    );
    expect(store.getState().notification.message).toBe("");
  });

  test("handles delete record rejected with known error", () => {
    const store = setup();
    store.dispatch(
      deleteSampleRecordAsync.rejected(
        null,
        "req-13",
        { selectedRows: [{ uuid: "1" }] as any },
        RECORD_ERROR_CODES.DELETE_FAILED
      )
    );
    expect(store.getState().notification.message).toBe(
      "notification_recordDelete_error_message"
    );
  });
});
