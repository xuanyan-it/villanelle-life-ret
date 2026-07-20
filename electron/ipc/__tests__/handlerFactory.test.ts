import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: mocks.handleMock
  }
}));

import { createIpcHandlerFactory } from "../handlerFactory";

describe("createIpcHandlerFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("returns a uniform error envelope for auth and schema failures", async () => {
    const factory = createIpcHandlerFactory({
      authSession: createAuthSession(false)
    } as never);

    factory.registerEnvelope(
      "secured",
      {
        schema: z.object({ name: z.string().min(1) }),
        requireAuth: true,
        fallbackMessage: SharedClientErrorMessage.requestFailed
      },
      async () => [{ ok: true }]
    );

    const handler = mocks.handleMock.mock.calls[0][1] as (...args: unknown[]) => Promise<unknown>;
    await expect(handler({}, { name: "demo" })).resolves.toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.unauthorized,
      meta: {
        requestId: expect.any(String)
      }
    });
  });

  it("applies shared schema validation before invoking the handler", async () => {
    const invoked = vi.fn();
    const factory = createIpcHandlerFactory({
      authSession: createAuthSession(true)
    } as never);

    factory.registerEnvelope(
      "validated",
      {
        schema: z.object({ name: z.string().min(1) }),
        fallbackMessage: SharedClientErrorMessage.requestFailed
      },
      async (payload) => {
        invoked(payload);
        return [{ ok: true }];
      }
    );

    const handler = mocks.handleMock.mock.calls[0][1] as (...args: unknown[]) => Promise<unknown>;
    await expect(handler({}, { name: "" })).resolves.toMatchObject({
      code: 1,
      status: "error",
      message: SharedClientErrorMessage.invalidPayload
    });
    expect(invoked).not.toHaveBeenCalled();
  });
});
