import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createErrorEnvelopeSchema,
  createSuccessEnvelopeSchema,
  EnvelopeSchema} from "../envelope.schemas";

describe("response contracts", () => {
  it("accepts standard success envelope", () => {
    expect(() =>
      EnvelopeSchema.parse({
        code: 0,
        status: "success",
        payload: [{ ok: true }],
        meta: {},
        message: ""
      })
    ).not.toThrow();
  });

  it("accepts typed success envelope", () => {
    const schema = createSuccessEnvelopeSchema(z.object({ id: z.string() }));
    expect(() =>
      schema.parse({
        code: 0,
        status: "success",
        payload: [{ id: "1" }],
        meta: {},
        message: ""
      })
    ).not.toThrow();
  });

  it("rejects bad typed error payload", () => {
    const schema = createErrorEnvelopeSchema(z.object({ id: z.string() }));
    expect(() =>
      schema.parse({
        code: 1,
        status: "error",
        payload: [{ id: 1 }],
        meta: {},
        message: "failed"
      })
    ).toThrow();
  });

  it("accepts default error envelope schema without item type", () => {
    const schema = createErrorEnvelopeSchema();
    expect(() =>
      schema.parse({
        code: 1,
        status: "error",
        payload: [{ any: "shape" }, "text", 1],
        meta: {},
        message: "failed"
      })
    ).not.toThrow();
  });
});

