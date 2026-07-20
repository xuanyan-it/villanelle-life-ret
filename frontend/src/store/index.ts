import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { adminReducer } from "./admin";
import { localeReducer } from "./locale";
import { notificationListenerMiddleware } from "./middleware";
import { notificationReducer } from "./notification";
import { recordReducer } from "./record";
import { reportPreviewerReducer } from "./reportPreviewer";
import { userReducer } from "./user";
const rootReducer = combineReducers({
  record: recordReducer,
  reportPreviewer: reportPreviewerReducer,
  user: userReducer,
  locale: localeReducer,
  notification: notificationReducer,
  admin: adminReducer,
});
const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(notificationListenerMiddleware.middleware),
});
export const setupStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(notificationListenerMiddleware.middleware),
  });
};
export default store;
export type AppStore = ReturnType<typeof setupStore>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
