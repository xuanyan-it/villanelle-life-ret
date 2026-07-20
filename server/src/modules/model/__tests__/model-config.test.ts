import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadServerModelConfig, resolveServerModelDir } from "../model-config";

const tempDirs: string[] = [];

const makeTempModelDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "Ret-model-config-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadServerModelConfig", () => {
  it("loads valid model config", () => {
    const dir = makeTempModelDir();
    fs.writeFileSync(
      path.join(dir, "model.config.json"),
      JSON.stringify({ modelVersion: "LNM-1.0", resultPositiveThreshold: 0.3108 }),
      "utf8"
    );

    const config = loadServerModelConfig(dir, "production");
    expect(config).toEqual({
      modelVersion: "LNM-1.0",
      resultPositiveThreshold: 0.3108,
    });
  });

  it("throws when model config file is missing", () => {
    const dir = makeTempModelDir();
    expect(() => loadServerModelConfig(dir, "production")).toThrow(/model config not found/);
  });

  it("throws when model config schema is invalid", () => {
    const dir = makeTempModelDir();
    fs.writeFileSync(
      path.join(dir, "model.config.json"),
      JSON.stringify({ modelVersion: "foo", resultPositiveThreshold: 2 }),
      "utf8"
    );

    expect(() => loadServerModelConfig(dir, "production")).toThrow(/schema validation failed/);
  });
});

describe("resolveServerModelDir", () => {
  it("uses explicit MODEL_ROOT in production", () => {
    const explicitDir = path.resolve("C:/tmp/explicit-model-root");
    expect(resolveServerModelDir(explicitDir, "production")).toBe(explicitDir);
  });

  it("uses explicit MODEL_ROOT in non-production when provided", () => {
    const explicitDir = path.resolve("C:/tmp/explicit-model-root");
    const resolved = resolveServerModelDir(explicitDir, "development");
    expect(resolved).toBe(explicitDir);
  });

  it("uses workspace assets path in development/test", () => {
    const devResolved = resolveServerModelDir(undefined, "development");
    const testResolved = resolveServerModelDir(undefined, "test");
    expect(devResolved).toMatch(/[\\/]assets[\\/]models$/);
    expect(testResolved).toMatch(/[\\/]assets[\\/]models$/);
    expect(devResolved).not.toMatch(/[\\/]server[\\/]assets[\\/]models$/);
    expect(testResolved).not.toMatch(/[\\/]server[\\/]assets[\\/]models$/);
  });

  it("treats empty NODE_ENV as non-production", () => {
    const resolvedEmpty = resolveServerModelDir(undefined, "");
    expect(resolvedEmpty).toMatch(/[\\/]assets[\\/]models$/);
    expect(resolvedEmpty).not.toMatch(/[\\/]server[\\/]assets[\\/]models$/);
  });

  it("uses server package assets path in production when MODEL_ROOT is absent", () => {
    const resolved = resolveServerModelDir(undefined, "production");
    expect(resolved).toMatch(/[\\/]server[\\/]assets[\\/]models$/);
  });
});
