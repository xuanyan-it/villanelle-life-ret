import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
  quitMock: vi.fn(),
  loadElectronModelConfigMock: vi.fn(),
  buildElectronRuntimeProfileMock: vi.fn()
}));

vi.mock("electron", () => ({
  app: {
    quit: mocks.quitMock
  },
  ipcMain: {
    handle: mocks.handleMock
  }
}));

vi.mock("../../services/modelConfig", () => ({
  loadElectronModelConfig: mocks.loadElectronModelConfigMock
}));

vi.mock("../../services/runtimeProfile", () => ({
  buildElectronRuntimeProfile: mocks.buildElectronRuntimeProfileMock
}));

import { registerSystemHandlers } from "../systemHandlers";

describe("system handlers", () => {
  const createAuthSession = (authenticated = true) => ({
    isAuthenticated: vi.fn(() => authenticated),
    markAuthenticated: vi.fn(),
    getPrincipal: vi.fn(() => ({ username: "alice", instituteName: "Demo" })),
    clear: vi.fn(),
    requireAuthenticated: vi.fn(() => {
      if (!authenticated) {
        throw new Error(SharedClientErrorMessage.unauthorized);
      }
    })
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks getModelConfig when not authenticated", async () => {
    registerSystemHandlers({
      authSession: createAuthSession(false)
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("getModelConfig")?.({})).rejects.toThrow(SharedClientErrorMessage.unauthorized);
  });

  it("loads model config when authenticated", async () => {
    mocks.loadElectronModelConfigMock.mockResolvedValue({ modelVersion: "LNM-1.0" });
    registerSystemHandlers({
      authSession: createAuthSession(true),
      modelDir: "models"
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("getModelConfig")?.({})).resolves.toMatchObject({ modelVersion: "LNM-1.0" });
    expect(mocks.loadElectronModelConfigMock).toHaveBeenCalledWith("models");
  });

  it("loads runtime profile when authenticated", async () => {
    mocks.buildElectronRuntimeProfileMock.mockReturnValue({
      runtimeKind: "electron",
      storageBackend: "sqlite"
    });
    registerSystemHandlers({
      authSession: createAuthSession(true),
      modelDir: "models"
    } as never);

    const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
    for (const call of mocks.handleMock.mock.calls) {
      handlers.set(call[0] as string, call[1] as (...args: unknown[]) => Promise<unknown>);
    }

    await expect(handlers.get("getRuntimeProfile")?.({})).resolves.toMatchObject({
      runtimeKind: "electron",
      storageBackend: "sqlite"
    });
    expect(mocks.buildElectronRuntimeProfileMock).toHaveBeenCalledWith("models");
  });
});
