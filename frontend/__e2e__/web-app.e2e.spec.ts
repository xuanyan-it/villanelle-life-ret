import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type SeededAccount = {
  instituteName: string;
  username: string;
  email: string;
  password: string;
};

const serverBaseUrl = process.env.E2E_SERVER_BASE_URL ?? "http://127.0.0.1:7001";

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
  const body = (await response.json()) as { code?: number; message?: string };
  expect(body.code).toBe(0);
  return account;
};

const loginByUI = async (page: Page, account: SeededAccount): Promise<void> => {
  await page.route("**/api/model/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "",
        payload: [
          {
            modelVersion: "LNM-1.0",
            resultPositiveThreshold: 0.62
          }
        ]
      })
    });
  });

  await page.goto("/");
  await page.getByTestId("login-email-input").fill(account.email);
  await page.getByTestId("login-password-input").fill(account.password);

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/user/login") &&
      response.request().method() === "POST"
  );

  await page.getByTestId("login-submit").click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok()).toBeTruthy();
  const loginBody = (await loginResponse.json()) as { code?: number; message?: string };
  expect(loginBody.code).toBe(0);

  await expect(page.getByTestId("new-record-open")).toBeVisible();
};

test.describe("web app e2e", () => {
  test("can login and load main workspace", async ({ page, request }) => {
    const account = await seedAccount(request);
    await loginByUI(page, account);
    await expect(page.getByTestId("new-record-open")).toBeEnabled();
  });

  test("can download csv template from import dialog", async ({ page, request }) => {
    const account = await seedAccount(request);
    await loginByUI(page, account);

    await page.getByTestId("new-record-open").click();
    await page.getByTestId("new-record-import-many").click();
    await expect(page.getByTestId("download-template-link")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("download-template-link").click()
    ]);

    expect(download.suggestedFilename()).toContain("template_");
    expect(download.suggestedFilename().endsWith(".csv")).toBeTruthy();
  });

  test("auto protects workspace after configured idle timeout", async ({ page, request }) => {
    const account = await seedAccount(request);
    await page.addInitScript(() => {
      window.localStorage.setItem("ret.alof.timeoutSeconds", "2");
    });

    await loginByUI(page, account);
    await expect(page.getByTestId("new-record-open")).toBeVisible();

    await page.waitForTimeout(7000);
    await expect(page.getByTestId("login-email-input")).toBeVisible();
    await expect(page.getByTestId("new-record-open")).toHaveCount(0);
  });
});
