import { beforeEach, describe, expect, test, vi } from "vitest";

const mockExposeInMainWorld = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();
const mockInvoke = vi.fn();

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld,
  },
  ipcRenderer: {
    on: mockOn,
    removeListener: mockRemoveListener,
    invoke: mockInvoke,
  },
}));

const loadExposedApi = async () => {
  vi.resetModules();
  await import("../preload");
  const calls = mockExposeInMainWorld.mock.calls;
  return calls.find((c) => c[0] === "electronAPI")?.[1];
};

describe("preload electronAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("subscribers return unsubscribe function", async () => {
    const api = await loadExposedApi();
    const cb = vi.fn();

    const unsubscribe = api.shellOutput(cb);

    expect(typeof unsubscribe).toBe("function");
    expect(mockOn).toHaveBeenCalledWith("shellOutput", expect.any(Function));

    unsubscribe();

    const listener = mockOn.mock.calls[0][1];
    expect(mockRemoveListener).toHaveBeenCalledWith("shellOutput", listener);
  });

  test("call/download/exportCsv proxy to ipcRenderer.invoke", async () => {
    mockInvoke.mockResolvedValueOnce("ok");
    const api = await loadExposedApi();

    await api.call("routeA", { x: 1 });
    await api.download("a.csv");
    await api.exportCsv({ filename: "b.csv", content: "1,2" });

    expect(mockInvoke).toHaveBeenNthCalledWith(1, "routeA", { x: 1 });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "download", "a.csv");
    expect(mockInvoke).toHaveBeenNthCalledWith(3, "exportCsv", {
      filename: "b.csv",
      content: "1,2",
    });
  });
});
