import fs from "node:fs";
import path from "node:path";

import { BaseModelConfigSchema, type BaseModelConfig } from "@villanelle/ret-shared/contracts/base";

const DEFAULT_MODEL_CONFIG: BaseModelConfig = {
  modelVersion: "LNM-1.0",
  resultPositiveThreshold: 0.3108
};

export const loadElectronModelConfig = (modelDir?: string): BaseModelConfig => {
  if (!modelDir) {
    return DEFAULT_MODEL_CONFIG;
  }
  const configPath = path.join(modelDir, "model.config.json");
  try {
    if (!fs.existsSync(configPath)) {
      return DEFAULT_MODEL_CONFIG;
    }
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const validated = BaseModelConfigSchema.safeParse(parsed);
    return validated.success ? validated.data : DEFAULT_MODEL_CONFIG;
  } catch {
    return DEFAULT_MODEL_CONFIG;
  }
};
