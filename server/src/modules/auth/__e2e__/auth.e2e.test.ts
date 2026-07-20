import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../../app.factory";

import { installE2eHooks, setupAuthSession } from "../../../__e2e__/e2e-harness";

describe("auth capability", () => {
  installE2eHooks();

  it("supports cookie auth lifecycle without refresh", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());

    const { instituteName } = await setupAuthSession(agent);

    const listWithCookie = await agent
      .post("/api/user/list")
      .send({ instituteName });
    expect(listWithCookie.statusCode).toBe(200);
    expect(listWithCookie.body.code).toBe(0);

    const logout = await agent.post("/api/user/logout").send({});
    expect(logout.statusCode).toBe(200);
    expect(logout.body.code).toBe(0);

    const listAfterLogout = await agent
      .post("/api/user/list")
      .send({ instituteName });
    expect(listAfterLogout.statusCode).toBe(401);

    const refreshRoute = await agent.post("/api/user/refresh").send({});
    expect(refreshRoute.statusCode).toBe(404);

    await app.close();
  });
});
