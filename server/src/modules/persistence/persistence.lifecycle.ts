import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";

import { PERSISTENCE_REPOSITORY_TOKEN } from "../../common/di/tokens";

import type { PersistenceRepository } from "./persistence.repository";

@Injectable()
export class PersistenceLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(PERSISTENCE_REPOSITORY_TOKEN)
    private readonly repository: PersistenceRepository
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.repository.close?.();
  }
}
