import type { InstituteCredential, InstituteCredentialRepositoryPort } from "@villanelle/ret-shared/application";
import type {
  QueryResult,
  RecordDraft,
  RecordUpdate,
  RecordRepositoryPort,
  SampleRecord,
  User,
  UserRepositoryPort
} from "@villanelle/ret-shared/domain";

export type UserFilters = Parameters<UserRepositoryPort["list"]>[0];
export type UserCreateInput = Parameters<UserRepositoryPort["create"]>[0];
export type InstituteFilters = Parameters<InstituteCredentialRepositoryPort["list"]>[0];
export type RecordListParams = Parameters<RecordRepositoryPort["list"]>[0];
export type RecordCreatePayload = RecordDraft;
export type RecordUpdatePayload = RecordUpdate;

export type PersistenceConflictField = "email" | "username" | "instituteName" | "token";

export class PersistenceConflictError extends Error {
  constructor(public readonly field: PersistenceConflictField) {
    super(`persistence conflict: ${field}`);
    this.name = "PersistenceConflictError";
  }
}

export interface PersistenceRepository {
  listUsers(filters: UserFilters): Promise<QueryResult<User>>;
  findUserByEmail(email: string): Promise<User | undefined>;
  findUserByUsername(username: string): Promise<User | undefined>;
  loginUser(email: string, password: string): Promise<User | undefined>;
  createUser(input: UserCreateInput): Promise<User>;
  deleteUsers(uuids: string[]): Promise<boolean>;
  listInstitutes(filters: InstituteFilters): Promise<QueryResult<InstituteCredential>>;
  createInstitute(instituteName: string): Promise<InstituteCredential>;
  verifyToken(token: string): Promise<QueryResult<InstituteCredential>>;
  listRecords(params: RecordListParams): Promise<QueryResult<SampleRecord>>;
  createRecord(payload: RecordCreatePayload, result: string): Promise<SampleRecord>;
  updateRecord(payload: RecordUpdatePayload): Promise<boolean>;
  deleteRecords(uuids: string[]): Promise<boolean>;
  close?(): Promise<void>;
}
