import { z } from "zod";

export const BaseRuntimeProfileSchema = z.object({
  runtimeKind: z.enum(["server", "electron"]),
  storageBackend: z.enum(["postgres", "sqlite"]),
  storageMode: z.enum(["centralized-service", "local-file"]),
  consistencyModel: z.enum(["centralized-multi-client", "single-node-local"]),
  schemaManagement: z.enum(["migration-managed", "runtime-bootstrap"]),
  modelRuntime: z.enum(["python-worker"]),
  modelDeployment: z.enum(["service-shared-worker", "desktop-local-worker"]),
  storageDescriptor: z.string().min(1),
  modelDir: z.string().min(1),
  modelConfigStatus: z.enum(["validated-file", "fallback-default", "missing", "invalid"])
});

export type BaseRuntimeProfile = z.infer<typeof BaseRuntimeProfileSchema>;
