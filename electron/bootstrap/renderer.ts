import type { BrowserWindow } from "electron";

import { getElectronLogger } from "../infrastructure/logger";
import type { WorkerManager } from "../services/workerManager";

type RendererBootstrapOptions = {
  mainWindow: BrowserWindow;
  nowMs: () => number;
  appStartMs: number;
  emitShellOutput: (payload: unknown) => void;
  workerManager: WorkerManager;
  envLabel: "dev" | "prod";
  rootDir: string;
  pythonExePath: string;
  dbPath: string;
  createDataTable: () => Promise<unknown>;
  initAuthTables: () => Promise<void>;
};

export const attachRendererBootstrap = ({
  mainWindow,
  nowMs,
  appStartMs,
  emitShellOutput,
  workerManager,
  envLabel,
  rootDir,
  pythonExePath,
  dbPath,
  createDataTable,
  initAuthTables,
}: RendererBootstrapOptions) => {
  const logger = getElectronLogger();
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
    logger.info("[boot] mainWindow ready-to-show", { elapsedMs: nowMs() - appStartMs });
  });

  mainWindow.webContents.on("did-finish-load", async () => {
    logger.info("[boot] renderer did-finish-load", { elapsedMs: nowMs() - appStartMs });
    setTimeout(async () => {
      logger.info("[boot] init tables start", { elapsedMs: nowMs() - appStartMs });
      emitShellOutput(await createDataTable());
      await initAuthTables();
      logger.info("[boot] init tables done", { elapsedMs: nowMs() - appStartMs });
    }, 0);

    const workerReadyMessage = workerManager.getReadyMessage();
    if (workerReadyMessage) {
      mainWindow.webContents.send("workerReady", workerReadyMessage);
    } else {
      mainWindow.webContents.send("workerReady", {
        type: "ready",
        ok: false,
        pending: true,
      });
      emitShellOutput("[worker] pending");
    }

    emitShellOutput(`[paths:${envLabel}] DB_PATH: ${dbPath}`);
    emitShellOutput(`[paths:${envLabel}] rootDir: ${rootDir}`);
    emitShellOutput(`[paths:${envLabel}] pythonExePath: ${pythonExePath}`);
    emitShellOutput(
      `[paths:${envLabel}] PORTABLE_EXECUTABLE_DIR: ${
        process.env.PORTABLE_EXECUTABLE_DIR || ""
      }`,
    );
  });
};
