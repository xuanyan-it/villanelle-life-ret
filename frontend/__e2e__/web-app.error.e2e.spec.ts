import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type SeededAccount = {
  instituteName: string;
  username: string;
  email: string;
  password: string;
};

const serverBaseUrl = process.env.E2E_SERVER_BASE_URL ?? "http://127.0.0.1:7001";

const LOGIN_ERROR_TEXT = /登录失败|Login Error/;
const LOGIN_ERROR_DESC = /请检查邮箱和登录密码|Please check your email address and password/;
const FETCH_USER_LIST_ERROR = /获取用户列表失败|Fetch user list failed/;
const DOWNLOAD_ERROR_TEXT = /下载失败|Download failed/;
const SERVER_INTERNAL_ERROR = /服务器内部错误，请联系管理员|Server Internal Error/;
const MODEL_LOADING_ERROR = /模型加载失败|Model load failed/;

const seedAccount = async (request: APIRequestContext): Promise<SeededAccount> => {
  const seed = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
  const shortSeed = seed.slice(-6);
  const account: SeededAccount = {
    instituteName: `e2e-inst-${shortSeed}`,
    username: `u${shortSeed}`,
    email: `e2e${shortSeed}@demo.com`,
    password: "Aa123456"
  };

  const response = await request.post(`${serverBaseUrl}/api/institute/register`, {
    data: {
      instituteName: account.instituteName,
      email: account.email,
      username: account.username,
      password: account.password
    }
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { code?: number };
  expect(body.code).toBe(0);
  return account;
};

const stubModelConfigReady = async (page: Page): Promise<void> => {
  await page.route("**/api/model/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "",
        payload: [{ modelVersion: "LNM-1.0", resultPositiveThreshold: 0.62 }]
      })
    });
  });
};

const loginByUI = async (page: Page, account: SeededAccount): Promise<void> => {
  await page.goto("/");
  await page.getByTestId("login-email-input").fill(account.email);
  await page.getByTestId("login-password-input").fill(account.password);
  await page.getByTestId("login-submit").click();
};

const expectNotification = async (page: Page, pattern: RegExp): Promise<void> => {
  await expect(page.locator(".ant-notification-notice").filter({ hasText: pattern }).first()).toBeVisible();
};

test.describe("web app error e2e", () => {
  test("shows backend unavailable state when /health fails", async ({ page }) => {
    await page.route("**/health", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false })
      });
    });

    await page.goto("/");

    await expect(page.getByText(/后端服务不可用|Backend service is unavailable/)).toBeVisible();
    await expect(page.getByText(/请启动 web-server 后重试|Please start the web-server and try again/)).toBeVisible();
    await expect(page.getByTestId("login-submit")).toHaveCount(0);
  });

  test("shows login error notification when /api/user/login returns 401", async ({ page }) => {
    await page.route("**/api/user/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: 1, message: "unauthorized", payload: [] })
      });
    });

    await page.goto("/");
    await page.getByTestId("login-email-input").fill("bad@demo.com");
    await page.getByTestId("login-password-input").fill("Aa123456");
    await page.getByTestId("login-submit").click();

    await expectNotification(page, LOGIN_ERROR_TEXT);
    await expectNotification(page, LOGIN_ERROR_DESC);
    await expect(page.getByTestId("login-submit")).toBeVisible();
    await expect(page.getByTestId("new-record-open")).toHaveCount(0);
  });

  test("shows login error notification when /api/user/login returns 500", async ({ page }) => {
    await page.route("**/api/user/login", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: 1, message: "server error", payload: [] })
      });
    });

    await page.goto("/");
    await page.getByTestId("login-email-input").fill("bad@demo.com");
    await page.getByTestId("login-password-input").fill("Aa123456");
    await page.getByTestId("login-submit").click();

    await expectNotification(page, LOGIN_ERROR_TEXT);
    await expect(page.getByTestId("login-submit")).toBeVisible();
    await expect(page.getByTestId("new-record-open")).toHaveCount(0);
  });

  test("shows user list error notification when /api/user/list returns 401 after login", async ({
    page,
    request
  }) => {
    const account = await seedAccount(request);
    await stubModelConfigReady(page);
    await page.route("**/api/user/list", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: 1, message: "missing access token", payload: [] })
      });
    });

    await loginByUI(page, account);
    await expect(page.getByTestId("new-record-open")).toBeVisible();
    await expectNotification(page, FETCH_USER_LIST_ERROR);
  });

  test("shows server error notification when /api/record/list returns 500", async ({ page, request }) => {
    const account = await seedAccount(request);
    await stubModelConfigReady(page);
    await page.route("**/api/record/list", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: 1, message: "boom", payload: [] })
      });
    });

    await loginByUI(page, account);
    await expect(page.getByTestId("new-record-open")).toBeVisible();
    await expectNotification(page, SERVER_INTERNAL_ERROR);
  });

  test("shows model loading failure when /api/model/config returns 500", async ({ page, request }) => {
    const account = await seedAccount(request);
    await page.route("**/api/model/config", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: 1, message: "model config error", payload: [] })
      });
    });

    await loginByUI(page, account);
    await expect(page.getByText(MODEL_LOADING_ERROR)).toBeVisible();
    await expect(page.getByTestId("new-record-open")).toHaveCount(0);
  });

  test("shows download error notification and no download when /api/download returns 500", async ({
    page,
    request
  }) => {
    const account = await seedAccount(request);
    await stubModelConfigReady(page);
    await loginByUI(page, account);

    await page.route("**/api/download**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: 1, message: "download failed", payload: [] })
      });
    });

    await page.getByTestId("new-record-open").click();
    await page.getByTestId("new-record-import-many").click();
    await expect(page.getByTestId("download-template-link")).toBeVisible();

    await page.getByTestId("download-template-link").click();
    const didDownload = await page
      .waitForEvent("download", { timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    expect(didDownload).toBeFalsy();
    await expectNotification(page, DOWNLOAD_ERROR_TEXT);
  });

  test("shows download error notification and no download when /api/download returns 404", async ({
    page,
    request
  }) => {
    const account = await seedAccount(request);
    await stubModelConfigReady(page);
    await loginByUI(page, account);

    await page.route("**/api/download**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: 1, message: "template not found", payload: [] })
      });
    });

    await page.getByTestId("new-record-open").click();
    await page.getByTestId("new-record-import-many").click();
    await expect(page.getByTestId("download-template-link")).toBeVisible();

    await page.getByTestId("download-template-link").click();
    const didDownload = await page
      .waitForEvent("download", { timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    expect(didDownload).toBeFalsy();
    await expectNotification(page, DOWNLOAD_ERROR_TEXT);
  });
});
