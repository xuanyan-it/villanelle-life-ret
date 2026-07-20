import { BadRequestException, HttpException, HttpStatus } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AllExceptionsFilter } from "../filters/all-exceptions.filter";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

const createHost = () => {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    headersSent: false,
  };
  const request = {
    method: "POST",
    url: "/api/demo",
    requestId: "req-1",
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as any;
  return { host, response };
};

describe("AllExceptionsFilter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps HttpException to response envelope", () => {
    const { host, response } = createHost();
    new AllExceptionsFilter().catch(new BadRequestException("bad payload"), host);
    expect(response.status).toHaveBeenCalledWith(400);
    const body = response.json.mock.calls[0][0];
    expect(body.code).toBe(1);
    expect(body.message).toBe("bad payload");
  });

  it("maps unknown errors to 500 envelope", () => {
    const { host, response } = createHost();
    new AllExceptionsFilter().catch(new Error("boom"), host);
    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.code).toBe(1);
    expect(body.message).toBe("boom");
  });

  it("sanitizes 500 error message in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { host, response } = createHost();
    new AllExceptionsFilter().catch(new Error("db password leaked"), host);
    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.code).toBe(1);
    expect(body.message).toBe("internal server error");
  });

  it("sanitizes unknown 400 message in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { host, response } = createHost();
    new AllExceptionsFilter().catch(new BadRequestException("db password leaked"), host);
    expect(response.status).toHaveBeenCalledWith(400);
    const body = response.json.mock.calls[0][0];
    expect(body.code).toBe(1);
    expect(body.message).toBe("invalid request");
  });

  it("keeps allowlisted 401 message in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { host, response } = createHost();
    new AllExceptionsFilter().catch(new BadRequestException("invalid payload"), host);
    expect(response.status).toHaveBeenCalledWith(400);
    const body = response.json.mock.calls[0][0];
    expect(body.code).toBe(1);
    expect(body.message).toBe("invalid payload");
  });

  it("keeps detailed 500 error message in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { host, response } = createHost();
    new AllExceptionsFilter().catch(new Error("boom"), host);
    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.code).toBe(1);
    expect(body.message).toBe("boom");
  });

  it("does not write response when headers are already sent", () => {
    const { host, response } = createHost();
    response.headersSent = true;

    new AllExceptionsFilter().catch(new Error("boom"), host);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("maps HttpException payload object.message (string) in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { host, response } = createHost();

    new AllExceptionsFilter().catch(
      new HttpException({ message: "obj-message" }, HttpStatus.BAD_REQUEST),
      host
    );

    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe("obj-message");
  });

  it("maps HttpException payload object.message (string array) in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { host, response } = createHost();

    new AllExceptionsFilter().catch(
      new HttpException({ message: ["arr-message"] }, HttpStatus.BAD_REQUEST),
      host
    );

    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe("arr-message");
  });

  it("falls back to exception.message when HttpException payload.message is not string", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { host, response } = createHost();

    new AllExceptionsFilter().catch(
      new HttpException({ message: [123] }, HttpStatus.BAD_REQUEST),
      host
    );

    const body = response.json.mock.calls[0][0];
    expect(body.message).toBeTruthy();
  });

  it("maps non-Error non-HttpException exceptions to internal server error", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { host, response } = createHost();

    new AllExceptionsFilter().catch("nope" as any, host);

    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe(SharedClientErrorMessage.internalServerError);
  });

  it("maps empty Error.message to internal server error in resolveMessage", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { host, response } = createHost();

    new AllExceptionsFilter().catch(new Error(""), host);

    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe(SharedClientErrorMessage.internalServerError);
  });

  it("uses production client message mapping for 401/403/404/409/default", () => {
    vi.stubEnv("NODE_ENV", " PRODUCTION ");
    const cases: Array<[number, string]> = [
      [HttpStatus.UNAUTHORIZED, "case-unauthorized"],
      [HttpStatus.FORBIDDEN, "case-forbidden"],
      [HttpStatus.NOT_FOUND, "case-not-found"],
      [HttpStatus.CONFLICT, "case-conflict"],
      [422, "case-unexpected"],
    ];

    for (const [status, raw] of cases) {
      const { host, response } = createHost();
      new AllExceptionsFilter().catch(new HttpException(raw, status), host);
      const body = response.json.mock.calls[0][0];

      if (status === HttpStatus.UNAUTHORIZED) {
        expect(body.message).toBe(SharedClientErrorMessage.unauthorized);
      } else if (status === HttpStatus.FORBIDDEN) {
        expect(body.message).toBe(SharedClientErrorMessage.forbidden);
      } else if (status === HttpStatus.NOT_FOUND) {
        expect(body.message).toBe(SharedClientErrorMessage.notFound);
      } else if (status === HttpStatus.CONFLICT) {
        expect(body.message).toBe(SharedClientErrorMessage.conflict);
      } else {
        expect(body.message).toBe(SharedClientErrorMessage.requestFailed);
      }
    }
  });

  it("sanitizes client message when request has missing method and requestId", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { host, response } = createHost();
    // overwrite request fields to hit ?? / fallback paths in catch()
    const req = host.switchToHttp().getRequest();
    (req as any).method = undefined;
    (req as any).requestId = undefined;
    // Keep at least one of url/originalUrl non-empty to satisfy audit schema
    (req as any).url = "/api/demo";
    (req as any).originalUrl = undefined;

    new AllExceptionsFilter().catch(new BadRequestException("db password leaked"), host);

    expect(response.status).toHaveBeenCalledWith(400);
    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe(SharedClientErrorMessage.invalidRequest);
  });
});
