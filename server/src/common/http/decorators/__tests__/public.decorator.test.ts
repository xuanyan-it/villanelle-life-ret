import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { IS_PUBLIC_KEY, Public } from "../public.decorator";

describe("Public decorator", () => {
  it("sets metadata on method handler", () => {
    class TestController {
      @Public()
      list(): string {
        return "ok";
      }
    }

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.list)).toBe(true);
  });

  it("sets metadata on class target", () => {
    @Public()
    class TestController {}

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestController)).toBe(true);
  });
});
