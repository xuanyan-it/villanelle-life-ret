import fs from "node:fs";
import path from "node:path";

import { BaseModelConfigSchema, type BaseRuntimeProfile } from "@villanelle/ret-shared/contracts/base";

import { resolveServerModelDir } from "./model-config";

const getServerStorageDescriptor = (databaseUrl?: string) => {
  if (!databaseUrl) {
    return "postgres://unconfigured";
  }
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname || "localhost";
    const port = parsed.port ? `:${parsed.port}` : "";
    const databaseName = parsed.pathname.replace(/^\/+/, "") || "postgres";
    return `postgres://${host}${port}/${databaseName}`;
  } catch {
    return "postgres://invalid-url";
  }
};

const getServerModelConfigStatus = (
  modelRoot?: string,
  nodeEnv = process.env.NODE_ENV
): BaseRuntimeProfile["modelConfigStatus"] => {
  const modelDir = resolveServerModelDir(modelRoot, nodeEnv);
  const configPath = path.join(modelDir, "model.config.json");
  if (!fs.existsSync(configPath)) {
    return "missing";
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
    return BaseModelConfigSchema.safeParse(parsed).success ? "validated-file" : "invalid";
  } catch {
    return "invalid";
  }
};

export const buildServerRuntimeProfile = (
  databaseUrl?: string,
  modelRoot?: string,
  nodeEnv = process.env.NODE_ENV
): BaseRuntimeProfile => {
  const modelDir = resolveServerModelDir(modelRoot, nodeEnv);
  return {
    runtimeKind: "server",
    storageBackend: "postgres",
    storageMode: "centralized-service",
    consistencyModel: "centralized-multi-client",
    schemaManagement: "migration-managed",
    modelRuntime: "python-worker",
    modelDeployment: "service-shared-worker",
    storageDescriptor: getServerStorageDescriptor(databaseUrl),
    modelDir,
    modelConfigStatus: getServerModelConfigStatus(modelRoot, nodeEnv)
  };
};
