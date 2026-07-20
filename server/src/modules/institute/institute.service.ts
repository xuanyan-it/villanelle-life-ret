import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import type { InstituteCredentialRepositoryPort } from "@villanelle/ret-shared/application";
import { createInstitute, createUser, listInstitutes, verifyInstituteToken } from "@villanelle/ret-shared/application";
import type { UserRole } from "@villanelle/ret-shared/domain";

import { PERSISTENCE_REPOSITORY_TOKEN } from "../../common/di/tokens";
import type { PersistenceRepository } from "../persistence/persistence.repository";
import { createInstituteRepositoryPort, createTokenPort, createUserRepositoryPort } from "../persistence/ports";
import { PersistenceConflictError } from "../persistence/persistence.repository.types";

@Injectable()
export class InstituteService {
  private readonly institutePort: InstituteCredentialRepositoryPort;
  private readonly userPort;
  private readonly tokenPort;

  constructor(
    @Inject(PERSISTENCE_REPOSITORY_TOKEN) repository: PersistenceRepository,
    @Inject(ConfigService) configService: ConfigService
  ) {
    this.institutePort = createInstituteRepositoryPort(repository);
    this.userPort = createUserRepositoryPort(repository);
    this.tokenPort = createTokenPort(
      configService.get<string>("JWT_SECRET", "dev-change-me"),
      configService.get<string>("JWT_EXPIRES_IN", "24h")
    );
  }

  async listInstitutes(filters: {
    uuid?: string;
    instituteName?: string;
    token?: string;
  }) {
    return listInstitutes(filters, this.institutePort);
  }

  async getInstituteCredential(instituteName: string) {
    return listInstitutes({ instituteName }, this.institutePort);
  }

  async createInstitute(instituteName: string) {
    try {
      return await createInstitute(instituteName, this.institutePort);
    } catch (error) {
      if (error instanceof PersistenceConflictError && error.field === "instituteName") {
        return { error: SharedClientErrorMessage.instituteExists };
      }
      throw error;
    }
  }

  async registerInstitute(params: {
    instituteName: string;
    email: string;
    username: string;
    password: string;
  }): Promise<
    {
      error:
        | typeof SharedClientErrorMessage.instituteExists
        | typeof SharedClientErrorMessage.emailExists
        | typeof SharedClientErrorMessage.usernameExists;
    } | { data: globalThis.Record<string, unknown> }
  > {
    const current = await this.institutePort.list({ instituteName: params.instituteName });
    if (current.total > 0) {
      return { error: SharedClientErrorMessage.instituteExists };
    }

    let result;
    try {
      result = await createUser(
        {
          instituteName: params.instituteName,
          email: params.email,
          username: params.username,
          password: params.password,
          userRole: "administrator" as UserRole
        },
        this.userPort,
        this.tokenPort,
        this.institutePort
      );
    } catch (error) {
      if (error instanceof PersistenceConflictError) {
        if (error.field === "instituteName") {
          return { error: SharedClientErrorMessage.instituteExists };
        }
        if (error.field === "email") {
          return { error: SharedClientErrorMessage.emailExists };
        }
        if (error.field === "username") {
          return { error: SharedClientErrorMessage.usernameExists };
        }
      }
      throw error;
    }

    if ("error" in result) {
      return result;
    }
    return { data: result.data as globalThis.Record<string, unknown> };
  }

  async verifyInstituteToken(token: string) {
    return verifyInstituteToken(token, this.institutePort);
  }
}
