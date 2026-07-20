import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.factory";

import { installE2eHooks } from "./e2e-harness";

describe("route baseline", () => {
  installE2eHooks();

  it("exposes capability baseline routes", async () => {
    const app = await createApp();
    const server = app.getHttpServer();
    const checks: Array<{ path: string; body?: Record<string, unknown> | Array<Record<string, unknown>> }> = [
      { path: "/api/user/login", body: {} },
      { path: "/api/user/create", body: {} },
      { path: "/api/user/logout", body: {} },
      { path: "/api/user/delete", body: [] },
      { path: "/api/user/list", body: {} },
      { path: "/api/institute/list", body: {} },
      { path: "/api/institute/credential/get", body: {} },
      { path: "/api/institute/create", body: {} },
      { path: "/api/institute/register", body: {} },
      { path: "/api/institute/verify", body: {} },
      { path: "/api/record/list", body: {} },
      { path: "/api/record/create", body: {} },
      { path: "/api/record/delete", body: [] }
    ];

    for (const check of checks) {
      const response = await request(server).post(check.path).send(check.body);
      expect(response.statusCode, check.path).not.toBe(404);
    }
    const modelConfigResponse = await request(server).get("/api/model/config");
    expect(modelConfigResponse.statusCode, "/api/model/config").not.toBe(404);

    await app.close();
  });
});
