import { beforeEach, describe, expect, it, vi } from "vitest";

import { createIdleProtector, resolveIdleTimeoutMs } from "../alof";

describe("createIdleProtector", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  it("triggers protect callback after timeout", () => {
    vi.useFakeTimers();
    const onProtect = vi.fn();
    const listeners = new Map<string, EventListener>();
    const protector = createIdleProtector({
      timeoutMs: 1000,
      onProtect,
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type) => {
        listeners.delete(type);
      }
    });

    protector.start();
    vi.advanceTimersByTime(1001);
    expect(onProtect).toHaveBeenCalledTimes(1);
    protector.stop();
    vi.useRealTimers();
  });

  it("resets timer when activity occurs", () => {
    vi.useFakeTimers();
    const onProtect = vi.fn();
    const listeners = new Map<string, EventListener>();
    const protector = createIdleProtector({
      timeoutMs: 1000,
      onProtect,
      addEventListener: (type, listener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type) => {
        listeners.delete(type);
      }
    });

    protector.start();
    vi.advanceTimersByTime(600);
    listeners.get("mousemove")?.(new Event("mousemove"));
    vi.advanceTimersByTime(600);
    expect(onProtect).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(500);
    expect(onProtect).toHaveBeenCalledTimes(1);
    protector.stop();
    vi.useRealTimers();
  });
});

describe("resolveIdleTimeoutMs", () => {
  it("uses local override when present", () => {
    window.localStorage.setItem("ret.alof.timeoutSeconds", "2");
    expect(resolveIdleTimeoutMs()).toBe(2000);
  });

  it("falls back to default when override is invalid", () => {
    window.localStorage.setItem("ret.alof.timeoutSeconds", "oops");
    expect(resolveIdleTimeoutMs()).toBe(86400000);
  });
});
