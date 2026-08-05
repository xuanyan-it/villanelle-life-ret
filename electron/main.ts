import type { BrowserWindow} from "electron";
import { app, nativeImage, protocol } from "electron";
import fs from "fs";
import path from "path";
import { format } from "url";

import { registerAppLifecycle } from "./bootstrap/lifecycle";
import { resolveRuntimePaths } from "./bootstrap/paths";
import { attachRendererBootstrap } from "./bootstrap/renderer";
import {
  applyProductionWindowGuards,
  createMainWindow,
} from "./bootstrap/window";
import { createAuthTables,createDataTable, DB_PATH } from "./database/index";
import { createShellOutputEmitter } from "./infrastructure/shellOutput";
import { getElectronLogger, initializeElectronLogger } from "./infrastructure/logger";
import { createWorkerManager } from "./services/workerManager";
import { createLocalUploadStore } from "./services/localUploadStore";
import { registerSlideProtocolHandler } from "./services/slideProtocolHandler";
import { createAuthSession } from "./ipc/authSession";
import { registerIpcHandlers } from "./ipc";

let mainWindow: BrowserWindow;

const NODE_ENV = app.isPackaged ? "production" : "development";
const DEV_SERVER_URL = "http://localhost:5173";
const ICON_RELATIVE_PATH = path.join("assets", "app.ico");
const GPU_SWITCHES = [
  "ignore-gpu-blacklist",
  "disable-gpu",
  "disable-gpu-compositing",
] as const;
const E2E_CDP_PORT = process.env.RET_E2E_CDP_PORT?.trim();

const nowMs = () => Date.now();
const appStartMs = nowMs();
// In production/portable, keep runtime data inside model/ so the root next to
// the exe only contains the exe and db.db (logs → model/logs).
const logger = initializeElectronLogger({
  nodeEnv: NODE_ENV,
  logDir: NODE_ENV === "production" ? path.join("model", "logs") : undefined,
});

// Register the slide:// scheme as privileged BEFORE app ready.
// Required for the renderer to load slide:// URLs in <img> / fetch.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "slide",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let workerCommand = "";
let workerArgs: string[] = [];

app.setAppUserModelId("ret");

const emitShellOutput = createShellOutputEmitter(() => mainWindow);
const authSession = createAuthSession();
const workerManager = createWorkerManager({
  onReady: (message) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send("workerReady", message);
  },
  emitShellOutput,
});

const initAuthTables = async () => {
  try {
    await createAuthTables();
  } catch (error) {
    logger.error("auth table init failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const prewarmWorkerAfterLogin = async (
  hasRuntimePython: boolean,
  pythonExePath: string,
  workerScriptPath: string,
  envLabel: "dev" | "prod",
) => {
  if (!hasRuntimePython) {
    const message = `[paths:${envLabel}] runtime python not found: ${pythonExePath}`;
    logger.error(message);
    emitShellOutput(message);
    return;
  }
  if (!fs.existsSync(workerScriptPath)) {
    const message = `[paths:${envLabel}] worker.py not found: ${workerScriptPath}`;
    logger.error(message);
    emitShellOutput(message);
    return;
  }

  try {
    await workerManager.start(workerCommand, workerArgs);
    await workerManager.ensureReady(2100000);
  } catch (error) {
    logger.warn("[worker] start failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    emitShellOutput(
      `[worker] start failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const createWindow = () => {
  const t0 = nowMs();
  logger.info("[boot] createWindow start", { elapsedMs: t0 - appStartMs });

  const devIconPath = path.join(process.cwd(), ICON_RELATIVE_PATH);
  const prodIconPath = path.join(process.resourcesPath, ICON_RELATIVE_PATH);
  const iconPath = app.isPackaged ? prodIconPath : devIconPath;
  const iconImage = nativeImage.createFromPath(iconPath);

  if (iconImage.isEmpty()) {
    logger.warn("[icon] failed to load", { iconPath });
  } else {
    logger.info("[icon] loaded", { iconPath });
  }

  mainWindow = createMainWindow(iconImage);
  logger.info("[boot] mainWindow created", { elapsedMs: nowMs() - appStartMs });

  if (NODE_ENV !== "development") {
    applyProductionWindowGuards(mainWindow);
  }

  const appURL = app.isPackaged
    ? format({
        pathname: path.join(process.resourcesPath, "web", "index.html"),
        protocol: "file:",
        slashes: true,
      })
    : DEV_SERVER_URL;

  const {
    envLabel,
    rootDir,
    modelDir,
    modelRoot,
    pythonExePath,
    workerScriptPath,
    hasRuntimePython,
  } = resolveRuntimePaths(NODE_ENV);
  // Production/portable: uploads live inside model/ (model/uploads) so the root
  // next to the exe only contains the exe and db.db.
  const uploadRoot =
    envLabel === "dev"
      ? path.join(rootDir, "data", "uploads")
      : path.join(modelRoot, "uploads");
  const localUploadStore = createLocalUploadStore(uploadRoot);
  registerSlideProtocolHandler(localUploadStore, workerManager);
  const bundledSitePackages = path.join(
    modelDir,
    "venv-LMN-1.0",
    "Lib",
    "site-packages",
  );
  if (fs.existsSync(bundledSitePackages)) {
    process.env.PYTHONPATH = [
      bundledSitePackages,
      process.env.PYTHONPATH,
    ]
      .filter(Boolean)
      .join(path.delimiter);
  }

  logger.info("[paths] resolved", {
    envLabel,
    rootDir,
    pythonExePath,
    workerScriptPath,
    logPath: getElectronLogger().logPath ?? null
  });

  mainWindow.loadURL(appURL);

  workerCommand = pythonExePath;
  workerArgs = ["-u", workerScriptPath];

  attachRendererBootstrap({
    mainWindow,
    nowMs,
    appStartMs,
    emitShellOutput,
    workerManager,
    envLabel,
    rootDir,
    pythonExePath,
    dbPath: DB_PATH,
    createDataTable,
    initAuthTables,
  });

  mainWindow.on("close", () => {
    authSession.clear();
    workerManager.stop();
  });

  mainWindow.on("closed", () => {
    mainWindow.destroy();
  });

  registerIpcHandlers({
    mainWindow,
    nodeEnv: NODE_ENV,
    modelDir,
    localUploadStore,
    workerManager,
    authSession,
    workerCommand,
    workerArgs,
    emitShellOutput,
    onLogout: () => {
      authSession.clear();
    },
    onLoginSuccess: () =>
      {
        return prewarmWorkerAfterLogin(
          hasRuntimePython,
          pythonExePath,
          workerScriptPath,
          envLabel,
        );
      },
  });
};

registerAppLifecycle({
  nodeEnv: NODE_ENV,
  createWindow,
  getMainWindow: () => mainWindow,
  onBeforeQuit: () => workerManager.stop(),
});

for (const gpuSwitch of GPU_SWITCHES) {
  app.commandLine.appendSwitch(gpuSwitch);
}

if (E2E_CDP_PORT) {
  app.commandLine.appendSwitch("remote-debugging-port", E2E_CDP_PORT);
}
