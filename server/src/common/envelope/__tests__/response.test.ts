import { describe, expect, it, vi } from "vitest";

import { fail, ok } from "../response";

describe("response envelope helpers", () => {
  it("builds success envelope", () => {
    const response = ok({ id: 1 }, "done");

    expect(response).toEqual({
      code: 0,
      status: "success",
      payload: [{ id: 1 }],
      meta: {},
      message: "done",
    });
  });

  it("parses payload items when parser is provided", () => {
    const parse = vi.fn((item: { id: number }) => ({ ...item, id: item.id * 10 }));
    const response = fail("bad", [{ id: 1 }, { id: 2 }], { parse });

    expect(parse).toHaveBeenCalledTimes(2);
    expect(response.payload).toEqual([{ id: 10 }, { id: 20 }]);
    expect(response.status).toBe("error");
  });
});
