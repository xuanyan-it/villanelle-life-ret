import type { ConfigService } from "@nestjs/config";
import { createSanitizedLogger } from "../../common/logging/sanitized-logger";

import { PostgresPersistenceRepository } from "./persistence.repository.postgres";
import type { PersistenceRepository } from "./persistence.repository.types";

export type {
  InstituteFilters,
  PersistenceRepository,
  RecordCreatePayload,
  UserFilters
} from "./persistence.repository.types";

const repositoryLogger = createSanitizedLogger("PersistenceRepository");

export const createPersistenceRepository = (configService: ConfigService): PersistenceRepository => {
  const databaseUrl = configService.get<string>("DATABASE_URL");
  repositoryLogger.log(`backend=postgres, databaseUrl=${databaseUrl ? "set" : "unset"}`);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for persistence");
  }

  return new PostgresPersistenceRepository(databaseUrl);
};
