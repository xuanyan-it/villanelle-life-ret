import { describe, expect, test } from "vitest";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import { errorResponse, okResponse, toClientErrorMessage } from "../responses";

describe("ipc responses", () => {
  test("okResponse returns success envelope", () => {
    const payload = [{ total: 1, result: [{ id: "1" }] }];
    const ret = okResponse(payload);

    expect(ret.code).toBe(0);
    expect(ret.status).toBe("success");
    expect(ret.payload).toEqual(payload);
    expect(ret.message).toBe("");
    expect(ret.meta).toEqual({});
  });

  test("okResponse keeps request metadata", () => {
    const ret = okResponse([{ ok: true }], { requestId: "req-1" });

    expect(ret.meta).toEqual({ requestId: "req-1" });
  });

  test("errorResponse returns error envelope", () => {
    const ret = errorResponse("failed");

    expect(ret.code).toBe(1);
    expect(ret.status).toBe("error");
    expect(ret.payload).toEqual([]);
    expect(ret.message).toBe("failed");
    expect(ret.meta).toEqual({});
  });

  test("toClientErrorMessage only passes allowlisted messages", () => {
    expect(toClientErrorMessage(new Error(SharedClientErrorMessage.emailExists), SharedClientErrorMessage.requestFailed)).toBe(
      SharedClientErrorMessage.emailExists
    );
    expect(toClientErrorMessage(new Error("sqlite busy"), SharedClientErrorMessage.requestFailed)).toBe(
      SharedClientErrorMessage.requestFailed
    );
  });
});
