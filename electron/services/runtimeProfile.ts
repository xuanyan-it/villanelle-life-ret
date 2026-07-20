import fs from "node:fs";
import path from "node:path";

import { BaseModelConfigSchema, type BaseRuntimeProfile } from "@villanelle/ret-shared/contracts/base";

import { getDBPath } from "../database";

const getElectronModelConfigStatus = (modelDir?: string): BaseRuntimeProfile["modelConfigStatus"] => {
  if (!modelDir) {
    return "fallback-default";
  }
  const configPath = path.join(modelDir, "model.config.json");
  if (!fs.existsSync(configPath)) {
    return "fallback-default";
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
    return BaseModelConfigSchema.safeParse(parsed).success ? "validated-file" : "fallback-default";
  } catch {
    return "fallback-default";
  }
};

export const buildElectronRuntimeProfile = (modelDir?: string): BaseRuntimeProfile => ({
  runtimeKind: "electron",
  storageBackend: "sqlite",
  storageMode: "local-file",
  consistencyModel: "single-node-local",
  schemaManagement: "runtime-bootstrap",
  modelRuntime: "python-worker",
  modelDeployment: "desktop-local-worker",
  storageDescriptor: `sqlite://${getDBPath()}`,
  modelDir: modelDir ?? "",
  modelConfigStatus: getElectronModelConfigStatus(modelDir)
});
