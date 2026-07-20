import { describe, expect, test, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  appOn: vi.fn(),
  appQuit: vi.fn(),
  globalRegister: vi.fn(),
  globalUnregisterAll: vi.fn(),
  setApplicationMenu: vi.fn(),
  getAllWindows: vi.fn(() => [])
}));

vi.mock("electron", () => ({
  app: { on: mocks.appOn, quit: mocks.appQuit },
  globalShortcut: {
    register: mocks.globalRegister,
    unregisterAll: mocks.globalUnregisterAll
  },
  Menu: { setApplicationMenu: mocks.setApplicationMenu },
  BrowserWindow: { getAllWindows: mocks.getAllWindows }
}));

describe("registerAppLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("registers expected app event listeners", async () => {
    const { registerAppLifecycle } = await import("../lifecycle");
    registerAppLifecycle({
      nodeEnv: "development",
      createWindow: vi.fn(),
      getMainWindow: vi.fn(),
      onBeforeQuit: vi.fn()
    });

    expect(mocks.appOn).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(mocks.appOn).toHaveBeenCalledWith("window-all-closed", expect.any(Function));
    expect(mocks.appOn).toHaveBeenCalledWith("activate", expect.any(Function));
    expect(mocks.appOn).toHaveBeenCalledWith("before-quit", expect.any(Function));
  });

  test("ready handler registers devtools shortcuts and creates window", async () => {
    const handlers = new Map<string, (...args: any[]) => void>();
    mocks.appOn.mockImplementation((event: string, cb: (...args: any[]) => void) => {
      handlers.set(event, cb);
      return undefined as any;
    });

    const createWindow = vi.fn();
    const { registerAppLifecycle } = await import("../lifecycle");
    registerAppLifecycle({
      nodeEnv: "development",
      createWindow,
      getMainWindow: vi.fn(() => undefined)
    });

    await Promise.resolve(handlers.get("ready")?.());

    expect(mocks.globalRegister).toHaveBeenCalledWith("CommandOrControl+Shift+I", expect.any(Function));
    expect(mocks.globalRegister).toHaveBeenCalledWith("CommandOrControl+Alt+I", expect.any(Function));
    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(mocks.setApplicationMenu).not.toHaveBeenCalled();
  });
});
