import type { ModelConfigPayload } from "../types";
import { api } from "../api";
const PLACEHOLDER_MODEL_CONFIG: ModelConfigPayload = {
  modelVersion: "LNM-0.0",
  resultPositiveThreshold: 0.5
};
let currentModelConfig: ModelConfigPayload = { ...PLACEHOLDER_MODEL_CONFIG };
let loadingPromise: Promise<void> | null = null;
let modelConfigLoaded = false;
export const getResultPositiveThreshold = () => currentModelConfig.resultPositiveThreshold;
export const getModelVersion = () => currentModelConfig.modelVersion;
export const getModelConfigSnapshot = () => ({ ...currentModelConfig });
export const isModelConfigLoaded = () => modelConfigLoaded;
const MODEL_VERSION_PATTERN = /^LNM-\d+\.\d+$/;
const assertModelConfig = (value: unknown): ModelConfigPayload => {
  if (typeof value !== "object" || value === null) {
    throw new Error("invalid model config payload");
  }
  const modelVersion = (value as { modelVersion?: unknown }).modelVersion;
  const resultPositiveThreshold = (value as { resultPositiveThreshold?: unknown }).resultPositiveThreshold;
  if (typeof modelVersion !== "string" || !MODEL_VERSION_PATTERN.test(modelVersion)) {
    throw new Error("invalid model version");
  }
  if (
    typeof resultPositiveThreshold !== "number" ||
    !Number.isFinite(resultPositiveThreshold) ||
    resultPositiveThreshold <= 0 ||
    resultPositiveThreshold >= 1
  ) {
    throw new Error("invalid result positive threshold");
  }
  return {
    modelVersion,
    resultPositiveThreshold,
  };
};
export const applyModelConfig = (next: Partial<ModelConfigPayload>) => {
  if (typeof next.modelVersion === "string" && next.modelVersion.trim()) {
    currentModelConfig = {
      ...currentModelConfig,
      modelVersion: next.modelVersion
    };
  }
  const threshold = next.resultPositiveThreshold;
  if (typeof threshold === "number" && Number.isFinite(threshold)) {
    currentModelConfig = {
      ...currentModelConfig,
      resultPositiveThreshold: threshold
    };
  }
};
export const ensureModelConfigLoaded = async () => {
  if (!loadingPromise) {
    loadingPromise = api
      .getModelConfig()
      .then((config) => {
        const validated = assertModelConfig(config);
        applyModelConfig(validated);
        modelConfigLoaded = true;
      })
      .catch((error) => {
        modelConfigLoaded = false;
        throw error;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  await loadingPromise;
};
