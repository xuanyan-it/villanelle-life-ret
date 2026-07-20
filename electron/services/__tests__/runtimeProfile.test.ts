import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDBPathMock: vi.fn()
}));

vi.mock("../../database", () => ({
  getDBPath: mocks.getDBPathMock
}));

const tempDirs: string[] = [];

const createTempModelDir = (configContent?: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ret-electron-runtime-"));
  tempDirs.push(dir);
  if (typeof configContent === "string") {
    fs.writeFileSync(path.join(dir, "model.config.json"), configContent, "utf8");
  }
  return dir;
};

describe("buildElectronRuntimeProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDBPathMock.mockReturnValue("C:\\portable\\db.db");
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test("returns local sqlite runtime metadata", async () => {
    const modelDir = createTempModelDir(JSON.stringify({
      modelVersion: "LNM-1.0",
      resultPositiveThreshold: 0.3108
    }));
    const { buildElectronRuntimeProfile } = await import("../runtimeProfile");

    const profile = buildElectronRuntimeProfile(modelDir);

    expect(profile).toMatchObject({
      runtimeKind: "electron",
      storageBackend: "sqlite",
      storageMode: "local-file",
      consistencyModel: "single-node-local",
      schemaManagement: "runtime-bootstrap",
      modelDeployment: "desktop-local-worker",
      storageDescriptor: "sqlite://C:\\portable\\db.db",
      modelDir,
      modelConfigStatus: "validated-file"
    });
  });

  test("marks fallback default when model config is absent", async () => {
    const modelDir = createTempModelDir();
    const { buildElectronRuntimeProfile } = await import("../runtimeProfile");

    const profile = buildElectronRuntimeProfile(modelDir);

    expect(profile.modelConfigStatus).toBe("fallback-default");
  });
});
