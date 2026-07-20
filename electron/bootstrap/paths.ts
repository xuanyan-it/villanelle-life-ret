import { app } from "electron";
import fs from "fs";
import path from "path";

import { parseElectronEnv } from "../config/env";

export type RuntimePaths = {
  envLabel: "dev" | "prod";
  rootDir: string;
  modelDir: string;
  pythonExePath: string;
  workerScriptPath: string;
  hasRuntimePython: boolean;
};

export const resolveRuntimePaths = (nodeEnv?: string): RuntimePaths => {
  const env = parseElectronEnv(process.env);
  const isDev = nodeEnv === "development";
  const envLabel: RuntimePaths["envLabel"] = isDev ? "dev" : "prod";
  const rootDir = isDev
    ? process.cwd()
    : env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe"));
  const modelDir = env.MODEL_DIR || path.join(rootDir, "assets", "models");

  const pythonExePath =
    process.platform === "win32"
      ? path.join(modelDir, "venv-LMN-1.0", "Scripts", "python.exe")
      : path.join(modelDir, "venv-LMN-1.0", "bin", "python");
  const workerScriptPath = path.join(modelDir, "worker.py");
  const hasRuntimePython = fs.existsSync(pythonExePath);

  return {
    envLabel,
    rootDir,
    modelDir,
    pythonExePath,
    workerScriptPath,
    hasRuntimePython,
  };
};
