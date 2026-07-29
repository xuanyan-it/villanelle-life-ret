import type { BrowserWindow } from "electron";

import type { WorkerManager } from "../services/workerManager";
import type { LocalUploadStore } from "../services/localUploadStore";
import type { AuthSession } from "./authSession";

export type IpcContext = {
  mainWindow: BrowserWindow;
  nodeEnv?: string;
  modelDir?: string;
  workerManager: WorkerManager;
  localUploadStore: LocalUploadStore;
  authSession: AuthSession;
  workerCommand: string;
  workerArgs: string[];
  emitShellOutput: (payload: unknown) => void;
  onLoginSuccess?: () => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
};
