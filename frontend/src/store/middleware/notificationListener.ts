import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  ADMIN_ERROR_CODES,
  deleteUserAsync,
  fetchInstituteCredentialAsync,
  fetchUserListAsync,
} from "../admin";
import { pushNotification } from "../notification";
import {
  batchCreateSampleRecordsAsync,
  createSampleRecordAsync,
  deleteSampleRecordAsync,
  fetchSampleRecordAsync,
  RECORD_ERROR_CODES,
} from "../record";
import {
  USER_ERROR_CODES,
  userCreateAsync,
  userLoginAsync,
  verifyRegisterTokenAsync,
} from "../user";
export const notificationListenerMiddleware = createListenerMiddleware();
notificationListenerMiddleware.startListening({
  matcher: isAnyOf(
    userLoginAsync.fulfilled,
    userCreateAsync.fulfilled,
    createSampleRecordAsync.fulfilled,
    batchCreateSampleRecordsAsync.fulfilled,
    deleteSampleRecordAsync.fulfilled
  ),
  effect: async (action, listenerApi) => {
    if (userLoginAsync.fulfilled.match(action)) {
      listenerApi.dispatch(
        pushNotification({
          type: "success",
          message: "notification_login_success_message",
          description: "",
        })
      );
      return;
    }
    if (userCreateAsync.fulfilled.match(action)) {
      listenerApi.dispatch(
        pushNotification({
          type: "success",
          message: "notification_register_success_message",
          description: "",
        })
      );
      return;
    }
    if (
      createSampleRecordAsync.fulfilled.match(action) ||
      batchCreateSampleRecordsAsync.fulfilled.match(action)
    ) {
      listenerApi.dispatch(
        pushNotification({
          type: "success",
          message: "notification_recordCreate_success_message",
          description: "",
        })
      );
      return;
    }
    if (deleteSampleRecordAsync.fulfilled.match(action)) {
      listenerApi.dispatch(
        pushNotification({
          type: "success",
          message: "notification_recordDelete_success_message",
          description: "",
        })
      );
      return;
    }
  },
});
notificationListenerMiddleware.startListening({
  matcher: isAnyOf(
    verifyRegisterTokenAsync.rejected,
    userLoginAsync.rejected,
    userCreateAsync.rejected,
    fetchInstituteCredentialAsync.rejected,
    fetchUserListAsync.rejected,
    deleteUserAsync.rejected,
    fetchSampleRecordAsync.rejected,
    deleteSampleRecordAsync.rejected
  ),
  effect: async (action, listenerApi) => {
    if (verifyRegisterTokenAsync.rejected.match(action)) {
      const reason = String(action.payload ?? "");
      if (reason === USER_ERROR_CODES.VERIFY_TOKEN_INVALID) {
        listenerApi.dispatch(
          pushNotification({
            type: "error",
            message: "notification_tokenVerification_error_message",
            description: "notification_tokenVerification_error_description",
          })
        );
        return;
      }
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_serverInternalError_message",
          description: "",
        })
      );
      return;
    }
    if (userLoginAsync.rejected.match(action)) {
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_login_error_message",
          description: "notification_login_error_description",
        })
      );
      return;
    }
    if (userCreateAsync.rejected.match(action)) {
      const reason = String(action.payload ?? "");
      if (reason === USER_ERROR_CODES.CREATE_FAILED_INSTITUTE_EXISTS) {
        listenerApi.dispatch(
          pushNotification({
            type: "error",
            message: "notification_register_institute_exists_message",
            description: "",
          })
        );
        return;
      }
      if (reason === USER_ERROR_CODES.CREATE_FAILED_EMAIL_EXISTS) {
        listenerApi.dispatch(
          pushNotification({
            type: "error",
            message: "notification_register_email_exists_message",
            description: "",
          })
        );
        return;
      }
      if (reason === USER_ERROR_CODES.CREATE_FAILED_USERNAME_EXISTS) {
        listenerApi.dispatch(
          pushNotification({
            type: "error",
            message: "notification_register_username_exists_message",
            description: "",
          })
        );
        return;
      }
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_register_error_message",
          description: "notification_register_error_description",
        })
      );
      return;
    }
    if (fetchInstituteCredentialAsync.rejected.match(action)) {
      const reason = String(action.payload ?? "");
      if (reason !== ADMIN_ERROR_CODES.FETCH_CREDENTIAL_FAILED) {
        return;
      }
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_serverInternalError_message",
          description: "",
        })
      );
      return;
    }
    if (fetchUserListAsync.rejected.match(action)) {
      const reason = String(action.payload ?? "");
      if (reason !== ADMIN_ERROR_CODES.LIST_USERS_FAILED) {
        return;
      }
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_fetchUserList_error_message",
          description: "notification_fetchUserList_error_description",
        })
      );
      return;
    }
    if (deleteUserAsync.rejected.match(action)) {
      const reason = String(action.payload ?? "");
      if (reason !== ADMIN_ERROR_CODES.DELETE_USER_FAILED) {
        return;
      }
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_serverInternalError_message",
          description: "",
        })
      );
      return;
    }
    if (fetchSampleRecordAsync.rejected.match(action)) {
      const reason = String(action.payload ?? "");
      if (reason !== RECORD_ERROR_CODES.FETCH_FAILED) {
        return;
      }
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_serverInternalError_message",
          description: "",
        })
      );
      return;
    }
    if (deleteSampleRecordAsync.rejected.match(action)) {
      const reason = String(action.payload ?? "");
      if (reason !== RECORD_ERROR_CODES.DELETE_FAILED) {
        return;
      }
      listenerApi.dispatch(
        pushNotification({
          type: "error",
          message: "notification_recordDelete_error_message",
          description: "notification_recordDelete_error_description",
        })
      );
    }
  },
});
