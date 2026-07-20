import { describe, expect, it, vi } from "vitest";

import { PersistenceLifecycle } from "../persistence.lifecycle";

describe("PersistenceLifecycle", () => {
  it("closes repository on application shutdown", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const lifecycle = new PersistenceLifecycle({ close } as any);

    await lifecycle.onApplicationShutdown();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
