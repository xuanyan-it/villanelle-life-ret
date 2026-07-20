import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const asFloat = (value: string): number => Number.parseFloat(value);

export const computeDET = (PKHD1L1: string, RPS4Y1: string, CRABP1: string, GAPDH: string) => ({
  DET_PKHD1L1: asFloat(PKHD1L1) - asFloat(GAPDH),
  DET_RPS4Y1: asFloat(RPS4Y1) - asFloat(GAPDH),
  DET_CRABP1: asFloat(CRABP1) - asFloat(GAPDH)
});

export type EvaluationRuntimeOptions = {
  modelRoot?: string;
  scriptPath?: string;
  pythonCmd?: string;
};

export const evaluateRecord = (
  PKHD1L1: string,
  RPS4Y1: string,
  CRABP1: string,
  GAPDH: string,
  runtime?: EvaluationRuntimeOptions
): string => {
  const det = computeDET(PKHD1L1, RPS4Y1, CRABP1, GAPDH);

  const modelRoot = runtime?.modelRoot;
  const scriptFromEnv = runtime?.scriptPath;
  const scriptPath =
    scriptFromEnv ??
    (modelRoot ? path.resolve(modelRoot, "evaluation.py") : "");
  if (scriptPath && existsSync(scriptPath)) {
    const pythonCmd = runtime?.pythonCmd ?? "python";
    const result = spawnSync(
      pythonCmd,
      [scriptPath, String(det.DET_PKHD1L1), String(det.DET_RPS4Y1), String(det.DET_CRABP1)],
      { encoding: "utf8" }
    );
    if (result.status === 0) {
      const output = result.stdout.trim();
      if (output === "0" || output === "1" || output === "2") {
        return output;
      }
    }
  }

  if (Number.isNaN(det.DET_PKHD1L1) || Number.isNaN(det.DET_RPS4Y1) || Number.isNaN(det.DET_CRABP1)) {
    return "process error";
  }
  if (det.DET_PKHD1L1 >= 2.2 || det.DET_RPS4Y1 >= 2.2 || det.DET_CRABP1 >= 2.2) {
    return "2";
  }
  if (det.DET_PKHD1L1 >= 1.2 || det.DET_RPS4Y1 >= 1.2 || det.DET_CRABP1 >= 1.2) {
    return "1";
  }
  return "0";
};

