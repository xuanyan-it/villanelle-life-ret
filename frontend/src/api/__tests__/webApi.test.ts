import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("axios");
vi.mock("../../platform/download", () => ({
  triggerBlobDownload: vi.fn()
}));

describe("webApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("requests backend health endpoint", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: { ok: true } })
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    const result = await webApi.health();

    expect(client.get).toHaveBeenCalledWith("/health");
    expect(result).toEqual({ ok: true });
  });

  it("requests backend runtime profile endpoint", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
          data: {
            code: 0,
            status: "success",
            payload: [
              {
                runtimeKind: "server",
                storageBackend: "postgres"
              }
            ],
            meta: {},
            message: ""
          }
        })
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    const result = await webApi.getRuntimeProfile();

    expect(client.get).toHaveBeenLastCalledWith("/api/model/runtime-profile");
    expect(result).toMatchObject({
      runtimeKind: "server",
      storageBackend: "postgres"
    });
  });

  it("posts login payload and returns response", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        data: { code: 0, payload: [{ token: "t" }] }
      })
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    const result = await webApi.userLogin({
      email: "test@example.com",
      password: "Password1"
    });

    expect(client.post).toHaveBeenCalledWith("/api/user/login", {
      email: "test@example.com",
      password: "Password1"
    });
    expect(result).toEqual({ code: 0, payload: [{ token: "t" }] });
  });

  it("throws when login request fails", async () => {
    const error = new Error("network error");
    const client = {
      get: vi.fn(),
      post: vi.fn().mockRejectedValue(error)
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    await expect(
      webApi.userLogin({
        email: "test@example.com",
        password: "Password1"
      })
    ).rejects.toBe(error);
  });

  it("creates sample records and returns first payload item", async () => {
    const payloadItem = { uuid: "r-1", recordId: "001" };
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        data: { payload: [payloadItem] }
      })
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    const result = await webApi.createSampleRecords([
      {
        id: "001",
        specimenType: "TSH",
        sampleDate: "2026-01-01"
      } as any
    ]);

    expect(client.post).toHaveBeenCalledWith("/api/record/create", [
      expect.objectContaining({ id: "001" })
    ]);
    expect(result).toEqual(payloadItem);
  });

  it("updates sample record and coerces first payload to boolean", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        data: { payload: [1] }
      })
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    const result = await webApi.updateSampleRecords({ uuid: "r-1" } as any);

    expect(client.post).toHaveBeenCalledWith("/api/record/update", { uuid: "r-1" });
    expect(result).toBe(true);
  });

  it("downloads template and triggers blob download", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: "a,b\n1,2"
      }),
      post: vi.fn()
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { triggerBlobDownload } = await import("../../platform/download");
    const { webApi } = await import("../webApi");

    const result = await webApi.download("template.csv");

    expect(client.get).toHaveBeenCalledWith("/api/download", {
      params: { file: "template.csv" },
      responseType: "blob"
    });
    expect(triggerBlobDownload).toHaveBeenCalledWith(expect.any(Blob), "template.csv");
    expect(result).toEqual({ canceled: false });
  });

  it("exports csv by creating blob and triggering download", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn()
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { triggerBlobDownload } = await import("../../platform/download");
    const { webApi } = await import("../webApi");

    const result = await webApi.exportCsv({
      filename: "records.csv",
      content: "col1,col2\nv1,v2"
    });

    expect(triggerBlobDownload).toHaveBeenCalledWith(expect.any(Blob), "records.csv");
    expect(result).toEqual({ canceled: false });
  });

  it("returns model config first payload item", async () => {
    const config = { provider: "openai", model: "gpt-4.1" };
    const client = {
      get: vi.fn().mockResolvedValue({
        data: { payload: [config] }
      }),
      post: vi.fn()
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    const result = await webApi.getModelConfig();

    expect(client.get).toHaveBeenCalledWith("/api/model/config");
    expect(result).toEqual(config);
  });

  it("throws unsupported error for bootstrap check in web runtime", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn()
    };
    const axios = await import("axios");
    (axios.default.create as any).mockReturnValue(client);
    const { webApi } = await import("../webApi");

    await expect(webApi.isBootstrapRequired()).rejects.toThrow(
      "isBootstrapRequired is not supported in web runtime"
    );
  });
});
