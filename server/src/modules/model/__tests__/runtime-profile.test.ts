import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildServerRuntimeProfile } from "../runtime-profile";

const tempDirs: string[] = [];

const createTempModelDir = (configContent: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "Ret-server-runtime-"));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, "model.config.json"), configContent, "utf8");
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("buildServerRuntimeProfile", () => {
  it("returns centralized postgres runtime metadata", () => {
    const modelDir = createTempModelDir(JSON.stringify({
      modelVersion: "LNM-1.0",
      resultPositiveThreshold: 0.3108
    }));

    const profile = buildServerRuntimeProfile(
      "postgres://Ret:secret@db.internal:5432/ret_service",
      modelDir,
      "production"
    );

    expect(profile).toMatchObject({
      runtimeKind: "server",
      storageBackend: "postgres",
      storageMode: "centralized-service",
      consistencyModel: "centralized-multi-client",
      schemaManagement: "migration-managed",
      modelDeployment: "service-shared-worker",
      storageDescriptor: "postgres://db.internal:5432/ret_service",
      modelDir,
      modelConfigStatus: "validated-file"
    });
  });

  it("marks missing model config explicitly", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "Ret-server-runtime-"));
    tempDirs.push(dir);

    const profile = buildServerRuntimeProfile(undefined, dir, "production");

    expect(profile.storageDescriptor).toBe("postgres://unconfigured");
    expect(profile.modelConfigStatus).toBe("missing");
  });
});
