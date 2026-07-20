import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { LoggingInterceptor } from "../interceptors/logging.interceptor";

describe("LoggingInterceptor", () => {
  it("sets x-response-time header on successful response", async () => {
    const setHeader = vi.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "GET",
          originalUrl: "/health",
          requestId: "req-1",
        }),
        getResponse: () => ({
          setHeader,
          statusCode: 200,
        }),
      }),
    } as any;
    const next = {
      handle: () => of({ ok: true }),
    } as any;

    const interceptor = new LoggingInterceptor();
    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(context, next).subscribe({
        next: () => undefined,
        error: reject,
        complete: resolve,
      });
    });

    expect(setHeader).toHaveBeenCalledWith("x-response-time", expect.stringMatching(/^\d+ms$/));
  });

  it("does not set header when response is already sent", async () => {
    const setHeader = vi.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "GET",
          originalUrl: "/api/download",
          requestId: "req-2",
        }),
        getResponse: () => ({
          setHeader,
          statusCode: 200,
          headersSent: true,
        }),
      }),
    } as any;
    const next = {
      handle: () => of({ ok: true }),
    } as any;

    const interceptor = new LoggingInterceptor();
    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(context, next).subscribe({
        next: () => undefined,
        error: reject,
        complete: resolve,
      });
    });

    expect(setHeader).not.toHaveBeenCalled();
  });

  it("uses fallback values when request/response fields are missing", async () => {
    const setHeader = vi.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          // method/originalUrl/requestId intentionally missing to hit fallbacks
          originalUrl: "/health",
          headers: {}
        }),
        getResponse: () => ({
          setHeader,
          headersSent: false,
          // statusCode intentionally missing to hit fallback
          statusCode: undefined,
        }),
      }),
    } as any;
    const next = {
      handle: () => of({ ok: true }),
    } as any;

    const interceptor = new LoggingInterceptor();
    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(context, next).subscribe({
        next: () => undefined,
        error: reject,
        complete: resolve,
      });
    });

    // We mainly care that we can execute the full branch path without audit schema errors.
    expect(setHeader).toHaveBeenCalledWith("x-response-time", expect.stringMatching(/^\d+ms$/));
  });
});
