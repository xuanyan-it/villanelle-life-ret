import fs from "node:fs";
import path from "node:path";

import { BaseModelConfigSchema, type BaseModelConfig } from "@villanelle/ret-shared/contracts/base";

const serverRoot = path.resolve(__dirname, "..", "..", "..");
const workspaceRoot = path.resolve(serverRoot, "..");

const resolveServerAssetDir = (
  kind: "models" | "templates",
  overridePath?: string,
  nodeEnv = process.env.NODE_ENV
) => {
  const runtimeEnv = (nodeEnv ?? "").trim().toLowerCase();
  if (overridePath && overridePath.trim().length > 0) {
    return path.resolve(overridePath);
  }
  if (runtimeEnv === "production") {
    return path.resolve(serverRoot, "assets", kind);
  }
  return path.resolve(workspaceRoot, "assets", kind);
};

export const resolveServerModelDir = (modelRoot?: string, nodeEnv = process.env.NODE_ENV) => {
  return resolveServerAssetDir("models", modelRoot, nodeEnv);
};

export const resolveServerTemplateDir = (templateDir?: string, nodeEnv = process.env.NODE_ENV) =>
  resolveServerAssetDir("templates", templateDir, nodeEnv);

export const loadServerModelConfig = (
  modelRoot?: string,
  nodeEnv = process.env.NODE_ENV
): BaseModelConfig => {
  const modelDir = resolveServerModelDir(modelRoot, nodeEnv);
  const configPath = path.join(modelDir, "model.config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`model config not found: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`model config is not valid JSON: ${configPath}`);
  }

  const validated = BaseModelConfigSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`model config schema validation failed: ${configPath}`);
  }

  return validated.data;
};
