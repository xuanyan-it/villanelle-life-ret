import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ModelConfigPayload } from "../../types";
const { mockGetModelConfig } = vi.hoisted(() => ({
  mockGetModelConfig: vi.fn(),
}));
vi.mock("../../api", () => ({
  api: {
    getModelConfig: () => mockGetModelConfig(),
  },
}));
describe("runtime/modelConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });
  const loadSubject = () => import("../modelConfig");
  test("loads model config from runtime api", async () => {
    const subject = await loadSubject();
    const payload: ModelConfigPayload = {
      modelVersion: "LNM-2.1",
      resultPositiveThreshold: 0.42,
    };
    mockGetModelConfig.mockResolvedValueOnce(payload);
    await subject.ensureModelConfigLoaded();
    expect(subject.isModelConfigLoaded()).toBe(true);
    expect(subject.getModelConfigSnapshot()).toEqual(payload);
  });
  test("throws when runtime api request fails", async () => {
    const subject = await loadSubject();
    mockGetModelConfig.mockRejectedValueOnce(new Error("500"));
    await expect(subject.ensureModelConfigLoaded()).rejects.toThrow();
    expect(subject.isModelConfigLoaded()).toBe(false);
    expect(subject.getModelConfigSnapshot()).toEqual({
      modelVersion: "LNM-0.0",
      resultPositiveThreshold: 0,
    });
  });
  test("throws when runtime api returns invalid payload", async () => {
    const subject = await loadSubject();
    mockGetModelConfig.mockResolvedValueOnce({
      modelVersion: "foo",
      resultPositiveThreshold: 2,
    });
    await expect(subject.ensureModelConfigLoaded()).rejects.toThrow();
    expect(subject.isModelConfigLoaded()).toBe(false);
  });
});
