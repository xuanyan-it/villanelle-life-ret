import path from "node:path";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ThrowingRepo = {
  loginUser: ReturnType<typeof vi.fn>;
  listUsers: ReturnType<typeof vi.fn>;
};

const repoState = vi.hoisted<{ repo: ThrowingRepo | null }>(() => ({
  repo: null
}));
const serverRoot = path.resolve(__dirname, "..", "..");
const workspaceRoot = path.resolve(serverRoot, "..");

describe("production exception redaction", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-access-secret-123456";
    process.env.JWT_EXPIRES_IN = "24h";
    process.env.AUTH_COOKIE_NAME = "ret_at";
    process.env.CORS_ORIGINS = "https://127.0.0.1:5173";
    process.env.MODEL_ROOT = path.resolve(workspaceRoot, "assets", "models");
    process.env.TEMPLATE_DIR = path.resolve(workspaceRoot, "assets", "templates");
    repoState.repo = {
      loginUser: vi.fn().mockResolvedValue({
        id: 1,
        uuid: "u-1",
        instituteName: "Demo Institute",
        userRole: "administrator",
        email: "admin@demo.com",
        username: "admin",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        lastLoginAt: "2025-01-01T00:00:00.000Z",
        isActivated: true
      }),
      listUsers: vi.fn().mockRejectedValue(new Error("db password leaked"))
    };
    vi.doMock("../modules/persistence/persistence.repository", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../modules/persistence/persistence.repository")>();
      return {
        ...actual,
        createPersistenceRepository: () => repoState.repo
      };
    });
  });

  afterEach(() => {
    repoState.repo = null;
    vi.doUnmock("../modules/persistence/persistence.repository");
    vi.unstubAllEnvs();
  });

  it("does not leak internal 500 details to http clients in production", async () => {
    const { createApp } = await import("../app.factory");
    const app = await createApp();
    const agent = request.agent(app.getHttpServer());

    const login = await agent.post("/api/user/login").send({
      email: "admin@demo.com",
      password: "Aa123456"
    }).set("x-forwarded-proto", "https");
    expect(login.statusCode).toBe(200);
    expect(login.body.code).toBe(0);
    const cookie = login.headers["set-cookie"];
    expect(cookie).toBeDefined();

    const userList = await request(app.getHttpServer())
      .post("/api/user/list")
      .set("x-forwarded-proto", "https")
      .set("Cookie", cookie)
      .send({ instituteName: "Demo Institute" });
    expect(userList.statusCode).toBe(500);
    expect(userList.body.code).toBe(1);
    expect(userList.body.message).toBe("internal server error");
    expect(JSON.stringify(userList.body)).not.toContain("db password leaked");

    await app.close();
  });
});
