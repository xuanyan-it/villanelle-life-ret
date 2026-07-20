import fs from "node:fs";
import path from "node:path";

const serverRoot = path.resolve(__dirname, "..", "..");
const workspaceRoot = path.resolve(serverRoot, "..");
const envPath = path.resolve(serverRoot, ".env.development");

export type RealE2ePrerequisiteResult =
  | { ok: true }
  | { ok: false; reason: string };

export const checkRealE2ePrerequisites = (): RealE2ePrerequisiteResult => {
  if (!fs.existsSync(envPath)) {
    return { ok: false, reason: `missing env file: ${envPath}` };
  }

  const modelRoot = path.resolve(workspaceRoot, "assets", "models");
  const pythonCandidates =
    process.platform === "win32"
      ? [path.resolve(modelRoot, "venv-LMN-1.0", "Scripts", "python.exe")]
      : [path.resolve(modelRoot, "venv-LMN-1.0", "bin", "python")];
  const pythonCmd = pythonCandidates.find((candidate) => fs.existsSync(candidate));

  if (!pythonCmd) {
    return {
      ok: false,
      reason: `missing bundled python under ${path.resolve(modelRoot, "venv-LMN-1.0")}`,
    };
  }

  return { ok: true };
};

const parseEnvFile = (raw: string): Record<string, string> =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf("=");
      if (index <= 0) {
        return acc;
      }
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      acc[key] = value;
      return acc;
    }, {});

/** Called only from real-e2e.setup when Vitest is about to run real e2e tests. */
export const loadRealE2eEnvironment = (): void => {
  if (!fs.existsSync(envPath)) {
    throw new Error(`real e2e requires env file: ${envPath}`);
  }

  const fileEnv = parseEnvFile(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(fileEnv)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  const modelRoot = path.resolve(workspaceRoot, "assets", "models");
  const pythonCandidates =
    process.platform === "win32"
      ? [path.resolve(modelRoot, "venv-LMN-1.0", "Scripts", "python.exe")]
      : [path.resolve(modelRoot, "venv-LMN-1.0", "bin", "python")];
  const pythonCmd = pythonCandidates.find((candidate) => fs.existsSync(candidate));

  if (!pythonCmd) {
    throw new Error(`real e2e requires bundled python under ${path.resolve(modelRoot, "venv-LMN-1.0")}`);
  }

  process.env.NODE_ENV = "test";
  process.env.MODEL_ROOT = modelRoot;
  process.env.SERVICE_PYTHON_CMD = pythonCmd;
  process.env.SERVICE_EVAL_SCRIPT = path.resolve(modelRoot, "worker.py");
};
