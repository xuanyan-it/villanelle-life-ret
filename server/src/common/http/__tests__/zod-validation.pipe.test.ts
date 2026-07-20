import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

describe("ZodValidationPipe", () => {
  it("returns parsed payload when valid", () => {
    const pipe = new ZodValidationPipe(
      z.object({
        name: z.string(),
      }),
    );
    expect(pipe.transform({ name: "demo" })).toEqual({ name: "demo" });
  });

  it("throws BadRequestException when invalid", () => {
    const pipe = new ZodValidationPipe(
      z.object({
        count: z.number().int(),
      }),
    );
    expect(() => pipe.transform({ count: "1" })).toThrow(BadRequestException);
  });

  it("throws BadRequestException when input is null/undefined (covers value ?? {})", () => {
    const pipe = new ZodValidationPipe(
      z.object({
        count: z.number().int(),
      })
    );

    expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
    expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
  });
});

