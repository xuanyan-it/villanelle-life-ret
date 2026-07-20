import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../../app.factory";

import { installE2eHooks } from "../../../__e2e__/e2e-harness";

describe("institute register capability", () => {
  installE2eHooks();

  it("creates institute and admin user in one request", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = Date.now();
    const instituteName = `Institute-${seed}`;
    const email = `admin-${seed}@demo.com`;
    const username = `admin-${seed}`;

    const register = await agent.post("/api/institute/register").send({
      instituteName,
      email,
      username,
      password: "Aa123456"
    });
    expect(register.statusCode).toBe(200);
    expect(register.body.code).toBe(0);
    expect(register.body.payload[0].instituteName).toBe(instituteName);
    expect(register.body.payload[0].email).toBe(email);
    expect(register.body.payload[0].userRole).toBe("administrator");

    const verifyInstitute = await agent.post("/api/institute/list").send({ instituteName });
    expect(verifyInstitute.statusCode).toBe(200);
    expect(verifyInstitute.body.code).toBe(0);
    expect(verifyInstitute.body.payload[0].total).toBe(1);

    const login = await agent.post("/api/user/login").send({ email, password: "Aa123456" });
    expect(login.statusCode).toBe(200);
    expect(login.body.code).toBe(0);

    const instituteList = await agent
      .post("/api/institute/list")
      .send({ instituteName });
    expect(instituteList.statusCode).toBe(200);
    expect(instituteList.body.code).toBe(0);
    expect(instituteList.body.payload[0].total).toBe(1);

    await app.close();
  });

  it("fails when institute already exists", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = Date.now();
    const instituteName = `Institute-${seed}`;

    const first = await agent.post("/api/institute/register").send({
      instituteName,
      email: `admin-a-${seed}@demo.com`,
      username: `admin-a-${seed}`,
      password: "Aa123456"
    });
    expect(first.statusCode).toBe(200);
    expect(first.body.code).toBe(0);

    const second = await agent.post("/api/institute/register").send({
      instituteName,
      email: `admin-b-${seed}@demo.com`,
      username: `admin-b-${seed}`,
      password: "Aa123456"
    });
    expect(second.statusCode).toBe(409);
    expect(second.body.code).toBe(1);
    expect(second.body.message).toBe("institute exists");

    await app.close();
  });

  it("fails when email already exists", async () => {
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());
    const seed = Date.now();
    const email = `shared-${seed}@demo.com`;

    const first = await agent.post("/api/institute/register").send({
      instituteName: `Institute-A-${seed}`,
      email,
      username: `admin-a-${seed}`,
      password: "Aa123456"
    });
    expect(first.statusCode).toBe(200);
    expect(first.body.code).toBe(0);

    const second = await agent.post("/api/institute/register").send({
      instituteName: `Institute-B-${seed}`,
      email,
      username: `admin-b-${seed}`,
      password: "Aa123456"
    });
    expect(second.statusCode).toBe(409);
    expect(second.body.code).toBe(1);
    expect(second.body.message).toBe("email exists");

    await app.close();
  });
});
