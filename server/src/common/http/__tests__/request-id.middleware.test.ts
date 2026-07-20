import { describe, expect, it, vi } from "vitest";

import { RequestIdMiddleware } from "../middlewares/request-id.middleware";

describe("RequestIdMiddleware", () => {
  it("keeps incoming x-request-id", () => {
    const middleware = new RequestIdMiddleware();
    const req: any = {
      headers: { "x-request-id": "req-123" },
      method: "GET",
      originalUrl: "/demo",
    };
    const setHeader = vi.fn();
    const res: any = { setHeader };
    const next = vi.fn();

    middleware.use(req, res, next);
    expect(req.requestId).toBe("req-123");
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "req-123");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("generates request id when missing", () => {
    const middleware = new RequestIdMiddleware();
    const req: any = {
      headers: {},
      method: "POST",
      originalUrl: "/demo",
    };
    const setHeader = vi.fn();
    const res: any = { setHeader };
    const next = vi.fn();

    middleware.use(req, res, next);
    expect(typeof req.requestId).toBe("string");
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(setHeader).toHaveBeenCalledWith("x-request-id", req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

