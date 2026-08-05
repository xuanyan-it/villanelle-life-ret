import { app } from "electron";
import fs from "fs";
import path from "path";

import { parseElectronEnv } from "../config/env";

export type RuntimePaths = {
  envLabel: "dev" | "prod";
  rootDir: string;
  /** Directory containing worker.py / python-runtime / venv / weights. */
  modelDir: string;
  /** Runtime data root holding logs/ and uploads/ (model/). */
  modelRoot: string;
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

  // model/ is always external — next to the .exe (portable USB) or
  // at a configured location.  It is NEVER bundled in app.asar or resources/.
  const rootDir = isPackaged
    ? (env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath("exe")))
    : resolveDevelopmentRoot();

  // Runtime data root — logs/ and uploads/ live here (model/logs, model/uploads).
  // Only used in production/portable; dev keeps rootDir/data/uploads.
  const modelRoot = path.join(rootDir, "model");

  let modelDir: string;
  if (isPackaged) {
    // Production/portable layout:
    //   model/artificial/models/  ← current portable deployment
    //   model/                    ← previous portable deployment
    const artificialModels = path.join(modelRoot, "artificial", "models");
    modelDir =
      env.MODEL_DIR ||
      (fs.existsSync(path.join(artificialModels, "worker.py"))
        ? artificialModels
        : fs.existsSync(path.join(modelRoot, "worker.py"))
          ? modelRoot
          : artificialModels);
  } else {
    // Development layout (unchanged):
    //   model/ (if present at repo root) else assets/models/
    modelDir =
      env.MODEL_DIR ||
      (fs.existsSync(path.join(rootDir, "model", "worker.py"))
        ? path.join(rootDir, "model")
        : path.join(rootDir, "assets", "models"));
  }

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
    modelRoot,
    pythonExePath,
    workerScriptPath,
    hasRuntimePython,
  };
};
