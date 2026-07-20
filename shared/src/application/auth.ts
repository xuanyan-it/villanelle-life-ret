import type { AuthTokenPort, InstituteRepositoryPort, UserRepositoryPort } from "../domain";
import { ensure, type UserRole } from "../domain";
import { SharedClientErrorMessage } from "../contracts/error-messages";

export type ServerLoginInput = { email: string; password: string };

export type ServerAuthOutput = {
  uuid: string;
  instituteName: string;
  username: string;
  email: string;
  accessToken: string;
  userRole: UserRole;
};

export const loginUser = async (
  input: ServerLoginInput,
  repository: Pick<UserRepositoryPort, "login">,
  tokenPort: AuthTokenPort
): Promise<ServerAuthOutput | null> => {
  const user = await repository.login(input.email, input.password);
  if (!user) {
    return null;
  }
  return {
    uuid: user.uuid,
    instituteName: user.instituteName,
    username: user.username,
    email: user.email,
    accessToken: tokenPort.issueToken({
      username: user.username,
      instituteName: user.instituteName,
      email: user.email,
      userRole: user.userRole
    }),
    userRole: user.userRole
  };
};

export const createUser = async (
  input: {
    instituteName: string;
    email: string;
    username: string;
    password: string;
    userRole: UserRole;
  },
  repository: Pick<UserRepositoryPort, "findByEmail" | "findByUsername" | "create">,
  tokenPort: AuthTokenPort,
  instituteRepository?: Pick<InstituteRepositoryPort, "list" | "create">
): Promise<
  {
    error: typeof SharedClientErrorMessage.emailExists | typeof SharedClientErrorMessage.usernameExists;
  } | { data: ServerAuthOutput }
> => {
  ensure(Boolean(input.instituteName), "instituteName is required");
  ensure(Boolean(input.email), "email is required");
  ensure(Boolean(input.username), "username is required");

  if (await repository.findByEmail(input.email)) {
    return { error: SharedClientErrorMessage.emailExists };
  }
  if (await repository.findByUsername(input.username)) {
    return { error: SharedClientErrorMessage.usernameExists };
  }

  if (instituteRepository) {
    const current = await instituteRepository.list({ instituteName: input.instituteName });
    if (current.total === 0) {
      await instituteRepository.create(input.instituteName);
    }
  }

  const created = await repository.create(input);
  return {
    data: {
      uuid: created.uuid,
      instituteName: created.instituteName,
      username: created.username,
      email: created.email,
      accessToken: tokenPort.issueToken({
        username: created.username,
        instituteName: created.instituteName,
        email: created.email,
        userRole: created.userRole
      }),
      userRole: created.userRole
    }
  };
};

