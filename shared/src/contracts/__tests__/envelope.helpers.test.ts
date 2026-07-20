import { describe, expect, it } from "vitest";

import { toErrorEnvelope, toSuccessEnvelope } from "../envelope.helpers";

describe("envelope helpers", () => {
  it("builds success envelope", () => {
    const envelope = toSuccessEnvelope([{ ok: true }], { requestId: "req-1" }, "");
    expect(envelope).toMatchObject({
      code: 0,
      status: "success",
      payload: [{ ok: true }],
      meta: { requestId: "req-1" }
    });
  });

  it("builds error envelope", () => {
    const envelope = toErrorEnvelope("failed", []);
    expect(envelope).toMatchObject({
      code: 1,
      status: "error",
      payload: [],
      message: "failed"
    });
  });
});
