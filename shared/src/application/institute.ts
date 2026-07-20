import { ensure, type Institute,type QueryResult } from "../domain";

export interface InstituteCredential extends Institute {
  token: string;
}

export interface InstituteCredentialRepositoryPort {
  list(filters: {
    uuid?: string;
    instituteName?: string;
    token?: string;
  }): Promise<QueryResult<InstituteCredential>>;
  create(instituteName: string): Promise<InstituteCredential>;
  verifyToken(token: string): Promise<QueryResult<InstituteCredential>>;
}

export const listInstitutes = async (
  filters: {
    uuid?: string;
    instituteName?: string;
    token?: string;
  },
  repository: Pick<InstituteCredentialRepositoryPort, "list">
): Promise<QueryResult<InstituteCredential>> => repository.list(filters);

export const createInstitute = async (
  instituteName: string,
  repository: Pick<InstituteCredentialRepositoryPort, "create">
): Promise<InstituteCredential> => {
  ensure(Boolean(instituteName), "instituteName is required");
  return repository.create(instituteName);
};

export const verifyInstituteToken = async (
  token: string,
  repository: Pick<InstituteCredentialRepositoryPort, "verifyToken">
): Promise<QueryResult<InstituteCredential>> => {
  ensure(Boolean(token), "token is required");
  return repository.verifyToken(token);
};

