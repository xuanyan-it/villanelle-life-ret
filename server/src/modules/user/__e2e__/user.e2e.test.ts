import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../../app.factory";

import { installE2eHooks, setupAuthSession } from "../../../__e2e__/e2e-harness";

describe("user capability", () => {
  installE2eHooks();

  it("supports user management", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const { instituteName, email } = await setupAuthSession(agent);

    const now = Date.now();
    const createOperator = await agent.post("/api/user/create").send({
      instituteName,
      email: `operator-${now}@demo.com`,
      username: `operator-${now}`,
      password: "Aa123456",
      userRole: "operator"
    });
    expect(createOperator.statusCode).toBe(200);
    expect(createOperator.body.code).toBe(0);
    const operatorEmail = `operator-${now}@demo.com`;

    const loginWithWrongPassword = await agent
      .post("/api/user/login")
      .send({ email: operatorEmail, password: "wrong-password" });
    expect(loginWithWrongPassword.statusCode).toBe(401);
    expect(loginWithWrongPassword.body.code).toBe(1);
    expect(loginWithWrongPassword.body.message).toBe("login failed");

    const loginWithCorrectPassword = await agent
      .post("/api/user/login")
      .send({ email: operatorEmail, password: "Aa123456" });
    expect(loginWithCorrectPassword.statusCode).toBe(200);
    expect(loginWithCorrectPassword.body.code).toBe(0);

    const userList = await agent
      .post("/api/user/list")
      .send({ instituteName });
    expect(userList.statusCode).toBe(200);
    expect(userList.body.code).toBe(0);
    expect(userList.body.payload[0].total).toBe(2);

    const target = userList.body.payload[0].result.find(
      (user: { email: string; uuid: string }) => user.email !== email
    ) as { uuid: string };

    const userDelete = await agent
      .post("/api/user/delete")
      .send([{ uuid: target.uuid }]);
    expect(userDelete.statusCode).toBe(200);
    expect(userDelete.body.code).toBe(0);

    await app.close();
  });
});
