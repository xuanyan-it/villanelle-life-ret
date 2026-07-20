import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { createUser, loginUser } from "@villanelle/ret-shared/application";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type { UserRole } from "@villanelle/ret-shared/domain";
import type { InstituteRepositoryPort } from "@villanelle/ret-shared/domain";

import { PERSISTENCE_REPOSITORY_TOKEN } from "../../common/di/tokens";
import type { PersistenceRepository } from "../persistence/persistence.repository";
import { createInstituteRepositoryPort, createTokenPort, createUserRepositoryPort } from "../persistence/ports";
import { PersistenceConflictError } from "../persistence/persistence.repository.types";

@Injectable()
export class AuthService {
  private readonly userPort;
  private readonly institutePortForAuth: Pick<InstituteRepositoryPort, "list" | "create">;
  private readonly tokenPort;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    @Inject(PERSISTENCE_REPOSITORY_TOKEN) repository: PersistenceRepository,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {
    this.userPort = createUserRepositoryPort(repository);
    const institutePort = createInstituteRepositoryPort(repository);
    this.institutePortForAuth = {
      list: (filters) => institutePort.list(filters),
      create: (instituteName) => institutePort.create(instituteName)
    };
    this.jwtSecret = this.configService.get<string>("JWT_SECRET", "dev-change-me");
    this.jwtExpiresIn = this.configService.get<string>("JWT_EXPIRES_IN", "24h");
    this.tokenPort = createTokenPort(this.jwtSecret, this.jwtExpiresIn);
  }

  async userLogin(params: { email: string; password: string }) {
    return loginUser(params, this.userPort, this.tokenPort);
  }

  async userCreate(params: {
    instituteName: string;
    email: string;
    username: string;
    password: string;
    userRole: UserRole;
  }): Promise<
    {
      error: typeof SharedClientErrorMessage.emailExists | typeof SharedClientErrorMessage.usernameExists;
    } | { data: globalThis.Record<string, unknown> }
  > {
    try {
      return await createUser(params, this.userPort, this.tokenPort, this.institutePortForAuth);
    } catch (error) {
      if (error instanceof PersistenceConflictError) {
        if (error.field === "email") {
          return { error: SharedClientErrorMessage.emailExists };
        }
        if (error.field === "username") {
          return { error: SharedClientErrorMessage.usernameExists };
        }
      }
      throw error;
    }
  }
}
