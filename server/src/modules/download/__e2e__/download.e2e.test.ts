import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../../app.factory";
import { installE2eHooks } from "../../../__e2e__/e2e-harness";

describe("download capability", () => {
  installE2eHooks();

  it("returns csv template with attachment headers", async () => {
    const app = await createApp();
    const response = await request(app.getHttpServer()).get("/api/download?file=template_zh-CN.csv");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain('attachment; filename="template_zh-CN.csv"');
    expect(response.text).toContain("sampleId,patientGender,sampleType");

    await app.close();
  });
});
