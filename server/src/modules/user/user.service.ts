import { Inject, Injectable } from "@nestjs/common";

import { deleteUsers, listUsers } from "@villanelle/ret-shared/application";
import type { UserRepositoryPort } from "@villanelle/ret-shared/domain";

import { PERSISTENCE_REPOSITORY_TOKEN } from "../../common/di/tokens";
import type { PersistenceRepository } from "../persistence/persistence.repository";
import { createUserRepositoryPort } from "../persistence/ports";

@Injectable()
export class UserService {
  private readonly userPort: UserRepositoryPort;

  constructor(@Inject(PERSISTENCE_REPOSITORY_TOKEN) repository: PersistenceRepository) {
    this.userPort = createUserRepositoryPort(repository);
  }

  async listUsers(filters: Parameters<UserRepositoryPort["list"]>[0]) {
    return listUsers(filters, this.userPort);
  }

  async deleteUsers(uuids: string[]) {
    return deleteUsers(uuids, this.userPort);
  }
}
