import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  emitIpcAuditEvent: vi.fn()
}));

vi.mock("../../infrastructure/logger", () => ({
  getElectronLogger: () => mocks.logger
}));

vi.mock("../../infrastructure/audit", () => ({
  emitIpcAuditEvent: (...args: unknown[]) => mocks.emitIpcAuditEvent(...args)
}));

import { beginIpcRequest } from "../requestContext";

describe("beginIpcRequest", () => {
  it("emits started/success audit events", () => {
    const request = beginIpcRequest("userLogin");
    request.logSuccess();

    expect(mocks.emitIpcAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "userLogin", status: "Started" })
    );
    expect(mocks.emitIpcAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "userLogin", status: "Success" })
    );
  });

  it("emits failure audit event with error message", () => {
    const request = beginIpcRequest("userLogin");
    request.logError(new Error("boom"));

    expect(mocks.emitIpcAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "userLogin",
        status: "Failure",
        errorMessage: "boom"
      })
    );
  });
});
