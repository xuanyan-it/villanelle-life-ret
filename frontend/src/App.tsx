import { Flex, notification } from "antd";
import React, { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import Footer from "./components/Footer";
import Header from "./components/Header";
import LoginPanel from "./components/LoginPanel";
import RecordTable from "./components/RecordTable";
import { api } from "./api";
import { bindWindowDropGuard, isElectronRuntime, subscribeShellOutput } from "./platform/runtime";
import { createIdleProtector, resolveIdleTimeoutMs } from "./runtime/alof";
import { ensureModelConfigLoaded } from "./runtime/modelConfig";
import { getLocale } from "./store/locale";
import {
  getNotificationState,
  resetNotification,
} from "./store/notification";
import { getLoginStatus, userLogoutAsync } from "./store/user";
import type { AppDispatch, RootState } from "./store";
import { RequestStatus } from "./types";
const ReportPreviewer = lazy(() => import("./components/ReportPreviewer"));

type ServiceHealthStatus = "checking" | "ready" | "down";
const DEFAULT_HEALTH_POLL_MS = 30_000;

const resolveHealthPollMs = (): number => {
  const rawValue = Number(import.meta.env.VITE_HEALTH_POLL_MS ?? DEFAULT_HEALTH_POLL_MS);
  if (!Number.isFinite(rawValue)) return DEFAULT_HEALTH_POLL_MS;
  const interval = Math.trunc(rawValue);
  return interval > 0 ? interval : DEFAULT_HEALTH_POLL_MS;
};

const App = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { i18n } = useTranslation();
  const locale = useSelector((state: RootState) => getLocale(state));
  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [i18n, locale]);
  /* Login */
  const loginStatus = useSelector((state: RootState) =>
    getLoginStatus(state)
  );
  const isLoggedIn = loginStatus === RequestStatus.Success;
  const [serviceHealthStatus, setServiceHealthStatus] = useState<ServiceHealthStatus>("checking");
  const [modelConfigStatus, setModelConfigStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [notificationApi, contextHolder] = notification.useNotification();
  const [isAlofLocked, setIsAlofLocked] = useState(false);
  const notificationState = useSelector((state: RootState) =>
    getNotificationState(state)
  );
  const { t } = useTranslation();
  useEffect(() => {
    if (notificationState.message === "") {
      return;
    }
    notificationApi.open({
      type: notificationState.type,
      message: t(`${notificationState.message}`),
      description: t(`${notificationState.description}`),
      placement: "bottomRight",
    });
    dispatch(resetNotification());
  }, [dispatch, notificationApi, notificationState, t]);
  useEffect(() => {
    if (isElectronRuntime()) {
      setServiceHealthStatus("ready");
      return;
    }
    let canceled = false;
    const checkHealth = async () => {
      try {
        const result = await api.health();
        if (!canceled) {
          setServiceHealthStatus(result.ok ? "ready" : "down");
        }
      } catch {
        if (!canceled) {
          setServiceHealthStatus("down");
        }
      }
    };
    setServiceHealthStatus("checking");
    void checkHealth();
    const timer = window.setInterval(() => {
      void checkHealth();
    }, resolveHealthPollMs());
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isElectronRuntime()) {
      return;
    }
    return bindWindowDropGuard();
  }, []);
  const isReportPreviewerOpen = useSelector(
    (state: RootState) => state.reportPreviewer.open
  );
  /* electron communication */
  useEffect(() => {
    return subscribeShellOutput(() => undefined);
  }, []);
  useEffect(() => {
    if (!isLoggedIn) {
      setModelConfigStatus("idle");
      return;
    }
    let canceled = false;
    setModelConfigStatus("loading");
    void ensureModelConfigLoaded()
      .then(() => {
        if (!canceled) {
          setModelConfigStatus("ready");
        }
      })
      .catch(() => {
        if (!canceled) {
          // Model not yet integrated — proceed with placeholder, don't block UI
          console.warn("Model config unavailable, using placeholder values.");
          setModelConfigStatus("ready");
        }
      });
    return () => {
      canceled = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsAlofLocked(false);
      return;
    }
    const protector = createIdleProtector({
      timeoutMs: resolveIdleTimeoutMs(),
      onProtect: () => {
        setIsAlofLocked(true);
        dispatch(userLogoutAsync());
        notificationApi.open({
          type: "warning",
          message: t("notification_alof_lock_message"),
          description: t("notification_alof_lock_description"),
          placement: "bottomRight"
        });
      },
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window)
    });
    protector.start();

    return () => {
      protector.stop();
    };
  }, [dispatch, isLoggedIn, notificationApi, t]);

  return (
    <>
      <Flex vertical>
        {contextHolder}
        {serviceHealthStatus === "checking" && (
          <div>
            <h3>{t("serviceHealth_checking_title")}</h3>
            <p>{t("serviceHealth_checking_label")}</p>
          </div>
        )}
        {serviceHealthStatus === "down" && (
          <div>
            <h3>{t("serviceHealth_failed_title")}</h3>
            <p>{t("serviceHealth_failed_label")}</p>
          </div>
        )}
        {serviceHealthStatus === "ready" && !isLoggedIn && <LoginPanel />}
        {serviceHealthStatus === "ready" && !isLoggedIn && isAlofLocked && <div>{t("notification_alof_lock_description")}</div>}
        {serviceHealthStatus === "ready" && isLoggedIn && modelConfigStatus === "ready" && <Header />}
        {serviceHealthStatus === "ready" && isLoggedIn && modelConfigStatus === "loading" && (
          <div>
            <h3>{t("modelLoading_loading_title")}</h3>
            <p>{t("modelLoading_loading_label")}</p>
          </div>
        )}
        {serviceHealthStatus === "ready" && isLoggedIn && modelConfigStatus === "error" && (
          <div>
            <h3>{t("modelLoading_failed_title")}</h3>
            <p>{t("modelLoading_failed_label")}</p>
          </div>
        )}
        {serviceHealthStatus === "ready" && isLoggedIn && modelConfigStatus === "ready" && (
          <Suspense>
            <RecordTable />
          </Suspense>
        )}
      </Flex>
      {serviceHealthStatus === "ready" && isReportPreviewerOpen && modelConfigStatus === "ready" && (
        <Suspense fallback={null}>
          <ReportPreviewer />
        </Suspense>
      )}
      <Footer />
    </>
  );
};
export default App;
