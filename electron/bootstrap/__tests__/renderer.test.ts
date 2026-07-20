import { describe, expect, test, vi } from "vitest";

import { attachRendererBootstrap } from "../renderer";

const createMainWindowMock = () => {
  const windowEvents: Record<string, (...args: any[]) => void> = {};
  const webContentsEvents: Record<string, (...args: any[]) => void> = {};

  const mainWindow = {
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      windowEvents[event] = handler;
      return mainWindow;
    }),
    show: vi.fn(),
    focus: vi.fn(),
    webContents: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        webContentsEvents[event] = handler;
      }),
      send: vi.fn(),
    },
  } as any;

  return { mainWindow, windowEvents, webContentsEvents };
};

describe("attachRendererBootstrap", () => {
  test("shows and focuses window on ready-to-show", () => {
    const { mainWindow, windowEvents } = createMainWindowMock();

    attachRendererBootstrap({
      mainWindow,
      nowMs: () => 1000,
      appStartMs: 0,
      emitShellOutput: vi.fn(),
      workerManager: { getReadyMessage: () => null } as any,
      envLabel: "dev",
      rootDir: "C:\\repo",
      pythonExePath: "python.exe",
      dbPath: "db.sqlite",
      createDataTable: vi.fn().mockResolvedValue("ok"),
      initAuthTables: vi.fn().mockResolvedValue(undefined),
    });

    windowEvents["ready-to-show"]();

    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
  });

  test("emits pending worker status and initializes tables after load", async () => {
    const { mainWindow, webContentsEvents } = createMainWindowMock();
    const emitShellOutput = vi.fn();
    const createDataTable = vi.fn().mockResolvedValue("created");
    const initAuthTables = vi.fn().mockResolvedValue(undefined);

    attachRendererBootstrap({
      mainWindow,
      nowMs: () => 2000,
      appStartMs: 0,
      emitShellOutput,
      workerManager: { getReadyMessage: () => null } as any,
      envLabel: "dev",
      rootDir: "C:\\repo",
      pythonExePath: "python.exe",
      dbPath: "db.sqlite",
      createDataTable,
      initAuthTables,
    });

    await webContentsEvents["did-finish-load"]();

    expect(mainWindow.webContents.send).toHaveBeenCalledWith("workerReady", {
      type: "ready",
      ok: false,
      pending: true,
    });
    expect(emitShellOutput).toHaveBeenCalledWith("[worker] pending");

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(createDataTable).toHaveBeenCalledTimes(1);
    expect(initAuthTables).toHaveBeenCalledTimes(1);
    expect(emitShellOutput).toHaveBeenCalledWith("created");
  });

  test("sends existing worker ready state when already available", async () => {
    const { mainWindow, webContentsEvents } = createMainWindowMock();
    const ready = { type: "ready", ok: true };
    const emitShellOutput = vi.fn();

    attachRendererBootstrap({
      mainWindow,
      nowMs: () => 3000,
      appStartMs: 0,
      emitShellOutput,
      workerManager: { getReadyMessage: () => ready } as any,
      envLabel: "prod",
      rootDir: "C:\\app",
      pythonExePath: "python.exe",
      dbPath: "db.sqlite",
      createDataTable: vi.fn().mockResolvedValue("created"),
      initAuthTables: vi.fn().mockResolvedValue(undefined),
    });

    await webContentsEvents["did-finish-load"]();

    expect(mainWindow.webContents.send).toHaveBeenCalledWith("workerReady", ready);
    expect(emitShellOutput).not.toHaveBeenCalledWith("[worker] pending");
  });
});
