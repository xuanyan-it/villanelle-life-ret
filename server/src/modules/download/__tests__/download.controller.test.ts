import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import { DownloadController } from "../download.controller";

const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
}));

describe("DownloadController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws not found when configured template file does not exist", () => {
    existsSyncMock.mockReturnValue(false);
    const controller = new DownloadController({
      get: vi.fn((key: string) => {
        if (key === "TEMPLATE_DIR") return "assets/templates";
        if (key === "TEMPLATE_FILENAME") return "template_zh-CN.csv";
        return undefined;
      }),
    } as any);
    const reply = {
      setHeader: vi.fn(),
      send: vi.fn((content: string) => content),
    };

    expect(() => controller.download(reply as any, undefined)).toThrow(
      new NotFoundException(SharedClientErrorMessage.templateNotFound)
    );
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it("uses configured filename and returns file content", () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue("a,b,c\n");
    const controller = new DownloadController({
      get: vi.fn((key: string) => {
        if (key === "TEMPLATE_DIR") return "assets/templates";
        if (key === "TEMPLATE_FILENAME") return "template_zh-CN.csv";
        return undefined;
      }),
    } as any);
    const reply = {
      setHeader: vi.fn(),
      send: vi.fn((content: string) => content),
    };

    const sent = controller.download(reply as any, undefined);

    expect(readFileSyncMock).toHaveBeenCalledTimes(1);
    expect(reply.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="template_zh-CN.csv"',
    );
    expect(sent).toBe("a,b,c\n");
  });

  it("normalizes alias filename from query string", () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue("a,b,c\n");
    const controller = new DownloadController({ get: vi.fn(() => undefined) } as any);
    const reply = {
      setHeader: vi.fn(),
      send: vi.fn((content: string) => content),
    };

    const sent = controller.download(reply as any, "template_zhCN.csv");
    expect(reply.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="template_zh-CN.csv"',
    );
    expect(sent).toBe("a,b,c\n");
  });

  it("rejects unsupported template filename", () => {
    const controller = new DownloadController({ get: vi.fn(() => undefined) } as any);
    const reply = {
      setHeader: vi.fn(),
      send: vi.fn((content: string) => content),
    };

    expect(() => controller.download(reply as any, "template_en-US.csv")).toThrow(
      new BadRequestException(SharedClientErrorMessage.invalidTemplateFilename)
    );
  });
});
