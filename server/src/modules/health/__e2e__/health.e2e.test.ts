import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../../app.factory";

import { installE2eHooks } from "../../../__e2e__/e2e-harness";

describe("health capability", () => {
  installE2eHooks();

  it("returns health", async () => {
    const app = await createApp();
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
    await app.close();
  });
});
