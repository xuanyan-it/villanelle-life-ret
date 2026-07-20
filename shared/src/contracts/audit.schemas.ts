import { z } from "zod";

export const AuditStatusSchema = z.enum(["Started", "Success", "Failure", "Throttled"]);
export const AuditEventTypeSchema = z.enum(["Management", "Data", "Authentication", "System"]);

export const AuditUserIdentitySchema = z.object({
  type: z.string().min(1),
  principalId: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  userName: z.string().min(1).optional(),
  invokedBy: z.string().min(1).optional()
});

export const AuditResourceSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  accountId: z.string().min(1).optional()
});

export const AuditEventSchema = z.object({
  eventID: z.string().uuid(),
  eventTime: z.string().datetime({ offset: true }),
  eventName: z.string().min(1),
  eventType: AuditEventTypeSchema,
  eventSource: z.string().min(1),
  eventVersion: z.string().min(1).default("1.0"),
  requestID: z.string().min(1).optional(),
  status: AuditStatusSchema,
  userIdentity: AuditUserIdentitySchema.optional(),
  sourceIPAddress: z.string().min(1).optional(),
  userAgent: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  requestParameters: z.unknown().optional(),
  resources: z.array(AuditResourceSchema).optional(),
  responseElements: z.unknown().optional(),
  errorCode: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional()
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const buildAuditEvent = (event: AuditEvent): AuditEvent => AuditEventSchema.parse(event);
