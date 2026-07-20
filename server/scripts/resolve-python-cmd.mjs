#!/usr/bin/env node

import { accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const isExecutable = (filePath) => {
  if (!filePath) return false;
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const run = (cmd, args) =>
  spawnSync(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

const resolveFromPath = (name) => {
  const finder = os.platform() === "win32" ? "where" : "which";
  const probe = run(finder, [name]);
  if (probe.status !== 0) return "";
  const first = probe.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first ?? "";
};

const fail = (message) => {
  console.error(`[python-gate] ${message}`);
  process.exit(1);
};

const emit = (pythonPath) => {
  console.log(`[python-gate] SERVICE_PYTHON_CMD=${pythonPath}`);
  if (process.env.GITHUB_ENV) {
    const sep = os.EOL;
    const line = `SERVICE_PYTHON_CMD=${pythonPath}${sep}`;
    try {
      accessSync(process.env.GITHUB_ENV, constants.F_OK);
    } catch {
      // GitHub Actions will create this file for us; ignore if absent in local runtime.
    }
    const write = run(
      process.execPath,
      [
        "-e",
        `require('fs').appendFileSync(process.env.GITHUB_ENV, ${JSON.stringify(line)});`,
      ],
    );
    if (write.status !== 0) fail(`failed to write GITHUB_ENV: ${write.stderr.trim()}`);
  }
};

const explicit = process.env.SERVICE_PYTHON_CMD?.trim() ?? "";
const modelRoot = process.env.MODEL_ROOT?.trim() || path.resolve(process.cwd(), "..", "assets", "models");
const venvCandidates =
  os.platform() === "win32"
    ? [
        path.resolve(modelRoot, "venv-LMN-1.0", "Scripts", "python.exe"),
        path.resolve(modelRoot, "venv.portable.Ret", "python.exe"),
      ]
    : [
        path.resolve(modelRoot, "venv-LMN-1.0", "bin", "python"),
        path.resolve(modelRoot, "venv.portable.Ret", "bin", "python"),
      ];
const candidates = explicit
  ? [explicit]
  : [...venvCandidates, resolveFromPath("python3"), resolveFromPath("python")].filter(Boolean);

if (!candidates.length) {
  fail("python not found. set SERVICE_PYTHON_CMD or install python3/python in PATH");
}

const pythonPath = candidates.find((candidate) => isExecutable(candidate)) ?? "";
if (!pythonPath) {
  fail(`no executable python candidate found: ${candidates.join(", ")}`);
}

const check = run(pythonPath, ["-c", "import autogluon; print('ok')"]);
if (check.status !== 0) {
  fail(`autogluon import failed for ${pythonPath}: ${check.stderr.trim() || check.stdout.trim()}`);
}

emit(pythonPath);
