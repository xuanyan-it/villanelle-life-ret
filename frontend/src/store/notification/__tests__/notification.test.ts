import {
  getNotificationDescription,
  getNotificationMessage,
  getNotificationState,
  getNotificationType,
} from "../selectors";
import reducer, { pushNotification, resetNotification } from "../slice";
describe("notification store", () => {
  test("pushNotification updates state", () => {
    const state = reducer(
      undefined,
      pushNotification({
        type: "error",
        message: "notification_login_error_message",
        description: "notification_login_error_description",
      })
    );
    expect(state).toEqual({
      type: "error",
      message: "notification_login_error_message",
      description: "notification_login_error_description",
    });
  });
  test("resetNotification resets state", () => {
    const next = reducer(
      {
        type: "success",
        message: "x",
        description: "y",
      },
      resetNotification()
    );
    expect(next).toEqual({
      type: "info",
      message: "",
      description: "",
    });
  });
  test("selectors return expected fields", () => {
    const rootState = {
      notification: {
        type: "warning",
        message: "m",
        description: "d",
      },
    } as any;
    expect(getNotificationState(rootState)).toEqual(rootState.notification);
    expect(getNotificationType(rootState)).toBe("warning");
    expect(getNotificationMessage(rootState)).toBe("m");
    expect(getNotificationDescription(rootState)).toBe("d");
  });
});
