import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { RequestStatus } from "./types";
const {
  mockDispatch,
  mockUseSelector,
  mockNotifyOpen,
  mockChangeLanguage,
  mockIsElectronRuntime,
  mockBindWindowDropGuard,
  mockSubscribeShellOutput,
  mockEnsureModelConfigLoaded,
  mockHealth,
} = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockUseSelector: vi.fn(),
  mockNotifyOpen: vi.fn(),
  mockChangeLanguage: vi.fn(),
  mockIsElectronRuntime: vi.fn(() => false),
  mockBindWindowDropGuard: vi.fn(() => vi.fn()),
  mockSubscribeShellOutput: vi.fn(() => vi.fn()),
  mockEnsureModelConfigLoaded: vi.fn(() => Promise.resolve()),
  mockHealth: vi.fn(() => Promise.resolve({ ok: true })),
}));
const apiMock = vi.hoisted(() => ({
  health: () => mockHealth(),
}));
vi.mock("react-redux", () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) => mockUseSelector(selector),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: mockChangeLanguage },
  }),
}));
vi.mock("antd", () => ({
  Flex: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  notification: {
    useNotification: () => [{ open: mockNotifyOpen }, <div key="holder">holder</div>],
  },
}));
vi.mock("./platform/runtime", () => ({
  isElectronRuntime: () => mockIsElectronRuntime(),
  bindWindowDropGuard: () => mockBindWindowDropGuard(),
  subscribeShellOutput: (handler: (data: string) => void) => mockSubscribeShellOutput(handler),
}));
vi.mock("./runtime/modelConfig", () => ({
  ensureModelConfigLoaded: () => mockEnsureModelConfigLoaded(),
}));
vi.mock("./api", () => ({ api: apiMock }));
vi.mock("./components/Footer", () => ({ default: () => <div>Footer</div> }));
vi.mock("./components/RecordTable", () => ({ default: () => <div>RecordTable</div> }));
vi.mock("./components/LoginPanel", () => ({ default: () => <div>LoginPanel</div> }));
vi.mock("./components/Header", () => ({ default: () => <div>Header</div> }));
vi.mock("./components/ReportPreviewer", () => ({ default: () => <div>ReportPreviewer</div> }));
const setupSelectors = (options?: {
  locale?: string;
  loginStatus?: RequestStatus;
  notificationState?: { message: string; type: string; description: string };
  isReportPreviewerOpen?: boolean;
}) => {
  const {
    locale = "en-US",
    loginStatus = RequestStatus.None,
    notificationState = { message: "", type: "info", description: "" },
    isReportPreviewerOpen = false,
  } = options ?? {};
  const state = {
    locale,
    user: { status: loginStatus },
    notification: notificationState,
    reportPreviewer: { open: isReportPreviewerOpen },
  };
  mockUseSelector.mockImplementation((selector: (s: typeof state) => unknown) => selector(state));
};
describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    mockIsElectronRuntime.mockReturnValue(false);
    mockHealth.mockResolvedValue({ ok: true });
    setupSelectors();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const renderApp = async () => {
    const { default: App } = await import("./App");
    return render(<App />);
  };
  test("renders login view when user is not logged in", async () => {
    await renderApp();
    expect(screen.getByText("serviceHealth_checking_title")).toBeInTheDocument();
    expect(screen.queryByText("LoginPanel")).not.toBeInTheDocument();
  });
  test("shows login view after service health check passes", async () => {
    await renderApp();
    expect(await screen.findByText("LoginPanel")).toBeInTheDocument();
  });
  test("renders main view when user is logged in", async () => {
    setupSelectors({
      loginStatus: RequestStatus.Success,
      isReportPreviewerOpen: true,
    });
    await renderApp();
    await waitFor(() => {
      expect(screen.getByText("Header")).toBeInTheDocument();
      expect(screen.getByText("RecordTable")).toBeInTheDocument();
    });
    expect(await screen.findByText("ReportPreviewer")).toBeInTheDocument();
  });
  test("blocks main view when model config loading fails", async () => {
    mockEnsureModelConfigLoaded.mockRejectedValueOnce(new Error("load failed"));
    setupSelectors({
      loginStatus: RequestStatus.Success,
    });
    await renderApp();
    expect(await screen.findByText("modelLoading_failed_title")).toBeInTheDocument();
    expect(screen.queryByText("Header")).not.toBeInTheDocument();
    expect(screen.queryByText("RecordTable")).not.toBeInTheDocument();
  });
  test("switches i18n language using locale from store", async () => {
    setupSelectors({ locale: "zh-CN" });
    await renderApp();
    expect(mockChangeLanguage).toHaveBeenCalledWith("zh-CN");
  });
  test("opens notification and dispatches reset action", async () => {
    setupSelectors({
      notificationState: {
        type: "error",
        message: "notification_error_message",
        description: "notification_error_description",
      },
    });
    await renderApp();
    expect(mockNotifyOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "notification_error_message",
        description: "notification_error_description",
        placement: "bottomRight",
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "notification/resetNotification" }),
    );
  });
  test("registers electron side effects only in electron runtime", async () => {
    mockIsElectronRuntime.mockReturnValue(true);
    await renderApp();
    expect(mockBindWindowDropGuard).toHaveBeenCalledTimes(1);
    expect(mockSubscribeShellOutput).toHaveBeenCalledTimes(1);
  });

  test("polls backend health continuously in web runtime", async () => {
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation((() => 1 as unknown as number) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const view = await renderApp();
    await waitFor(() => {
      expect(mockHealth).toHaveBeenCalledTimes(1);
    });
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
    const pollHandler = setIntervalSpy.mock.calls[0]?.[0] as (() => void) | undefined;
    pollHandler?.();
    expect(mockHealth).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(1);
  });
});
