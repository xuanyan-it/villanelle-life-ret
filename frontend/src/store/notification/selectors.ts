import type { RootState } from "../index";
export const getNotificationState = (state: RootState) => state.notification;
export const getNotificationType = (state: RootState) =>
  state.notification.type;
export const getNotificationMessage = (state: RootState) =>
  state.notification.message;
export const getNotificationDescription = (state: RootState) =>
  state.notification.description;
