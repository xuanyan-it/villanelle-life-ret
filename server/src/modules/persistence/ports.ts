import type { InstituteCredentialRepositoryPort } from "@villanelle/ret-shared/application";
import type { AuthTokenPort, RecordRepositoryPort, UserRepositoryPort } from "@villanelle/ret-shared/domain";

import { issueAccessJwt } from "../../common/auth/jwt";

import type { PersistenceRepository } from "./persistence.repository";

export const createTokenPort = (jwtSecret: string, jwtExpiresIn: string): AuthTokenPort => ({
  issueToken: (input) =>
    issueAccessJwt({
      payload: input,
      secret: jwtSecret,
      expiresIn: jwtExpiresIn
    })
});

export const createUserRepositoryPort = (repository: PersistenceRepository): UserRepositoryPort => ({
  findByEmail: (email) => repository.findUserByEmail(email),
  findByUsername: (username) => repository.findUserByUsername(username),
  login: (email, password) => repository.loginUser(email, password),
  create: (input) => repository.createUser(input),
  list: (filters) => repository.listUsers(filters),
  deleteByUuids: (uuids) => repository.deleteUsers(uuids)
});

export const createRecordRepositoryPort = (repository: PersistenceRepository): RecordRepositoryPort => ({
  list: (params) => repository.listRecords(params),
  create: (payload, result) => repository.createRecord(payload, result),
  update: (payload) => repository.updateRecord(payload),
  deleteByUuids: (uuids) => repository.deleteRecords(uuids)
});

export const createInstituteRepositoryPort = (repository: PersistenceRepository): InstituteCredentialRepositoryPort => ({
  list: (filters) => repository.listInstitutes(filters),
  create: (instituteName) => repository.createInstitute(instituteName),
  verifyToken: (token) => repository.verifyToken(token)
});
