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

const resolveDevelopmentRoot = () => {
  const cwd = process.cwd();
  const appPath =
    typeof app.getAppPath === "function" ? app.getAppPath() : cwd;
  const candidates = [
    cwd,
    path.dirname(cwd),
    appPath,
    path.dirname(appPath),
    path.resolve(appPath, "..", ".."),
  ];
  return (
    candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, "assets", "models", "worker.py")),
    ) ?? cwd
  );
};

export const resolveRuntimePaths = (nodeEnv?: string): RuntimePaths => {
  const env = parseElectronEnv(process.env);
  const isPackaged = app.isPackaged;
  const envLabel: RuntimePaths["envLabel"] = isPackaged ? "prod" : "dev";
  const rootDir = isPackaged
    ? env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe"))
    : resolveDevelopmentRoot();
  const resourceRoot = isPackaged ? process.resourcesPath : rootDir;
  const modelDir =
    env.MODEL_DIR || path.join(resourceRoot, "assets", "models");

  const bundledPython =
    process.platform === "win32"
      ? path.join(modelDir, "python-runtime", "python.exe")
      : path.join(modelDir, "python-runtime", "bin", "python");
  const venvPython =
    process.platform === "win32"
      ? path.join(modelDir, "venv-LMN-1.0", "Scripts", "python.exe")
      : path.join(modelDir, "venv-LMN-1.0", "bin", "python");
  const pythonExePath = fs.existsSync(bundledPython)
    ? bundledPython
    : venvPython;
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
