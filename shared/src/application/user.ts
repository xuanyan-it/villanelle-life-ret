import type { UserRepositoryPort } from "../domain";
import { ensure,type QueryResult, type User, type UserRole } from "../domain";

export const listUsers = async (
  filters: {
    uuid?: string;
    email?: string;
    username?: string;
    instituteName?: string;
    userRole?: UserRole;
  },
  repository: Pick<UserRepositoryPort, "list">
): Promise<QueryResult<User>> => repository.list(filters);

export const deleteUsers = async (
  uuids: string[],
  repository: Pick<UserRepositoryPort, "deleteByUuids">
): Promise<boolean> => {
  ensure(uuids.length > 0, "uuids is required");
  return repository.deleteByUuids(uuids);
};

