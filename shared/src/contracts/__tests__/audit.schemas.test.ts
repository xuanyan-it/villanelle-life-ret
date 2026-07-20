import { describe, expect, it } from "vitest";

import { AuditEventSchema, buildAuditEvent } from "../audit.schemas";

describe("AuditEventSchema", () => {
  it("accepts a complete audit event", () => {
    const event = buildAuditEvent({
      eventID: "594af95a-2c8a-449e-a2ec-f53c0f8b6ca8",
      eventTime: "2026-03-16T00:00:00.000Z",
      eventName: "http.request",
      eventType: "Management",
      eventSource: "Ret.server.http",
      eventVersion: "1.0",
      requestID: "req-1",
      status: "Success",
      sourceIPAddress: "127.0.0.1",
      userAgent: "vitest",
      requestParameters: { path: "/health" },
      responseElements: { statusCode: 200 }
    });

    expect(AuditEventSchema.parse(event)).toEqual(event);
  });

  it("rejects invalid status", () => {
    expect(() =>
      AuditEventSchema.parse({
        eventID: "594af95a-2c8a-449e-a2ec-f53c0f8b6ca8",
        eventTime: "2026-03-16T00:00:00.000Z",
        eventName: "http.request",
        eventType: "Management",
        eventSource: "Ret.server.http",
        eventVersion: "1.0",
        status: "OK"
      })
    ).toThrow();
  });
});
