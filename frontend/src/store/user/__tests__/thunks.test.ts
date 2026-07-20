import { beforeEach, describe, expect, test, vi, type Mock, type Mocked } from "vitest";
import { api } from "../../../api";
import { UserRole } from "../../../types";
import { USER_ERROR_CODES } from "../errors";
import {
  userCreateAsync,
  userLoginAsync,
  userLogoutAsync,
  verifyRegisterTokenAsync,
} from "../thunks";
vi.mock("../../../api", () => ({
  api: {
    verifyToken: vi.fn(),
    userCreate: vi.fn(),
    instituteRegister: vi.fn(),
    userLogin: vi.fn(),
    userLogout: vi.fn(),
  },
}));
const mockedApi = api as Mocked<typeof api>;
describe("user thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("verifyRegisterTokenAsync success", async () => {
    mockedApi.verifyToken.mockResolvedValue({
      code: 0,
      payload: [{ result: [{ instituteName: "Institute" }] }],
    } as any);
    const dispatch = vi.fn();
    const action = await verifyRegisterTokenAsync({ token: "token" })(
      dispatch,
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("user/verifyToken/fulfilled");
    expect(mockedApi.verifyToken).toHaveBeenCalledWith("token");
  });
  test("userCreateAsync handles business error", async () => {
    mockedApi.userCreate.mockResolvedValue({
      code: 1,
      message: "email exists",
      payload: [],
    } as any);
    const dispatch = vi.fn();
    const action = await userCreateAsync({
      email: "a@b.com",
      password: "Passw0rd",
      instituteName: "Institute",
      username: "alice",
      userRole: UserRole.Operator,
    })(dispatch, vi.fn(), undefined);
    expect(action.type).toBe("user/create/rejected");
    expect(action.payload).toBe(USER_ERROR_CODES.CREATE_FAILED_EMAIL_EXISTS);
  });

  test("userCreateAsync maps axios conflict error (email exists)", async () => {
    mockedApi.userCreate.mockRejectedValue({
      response: {
        data: {
          message: "email exists",
        },
      },
    });

    const dispatch = vi.fn();
    const action = await userCreateAsync({
      email: "a@b.com",
      password: "Passw0rd",
      instituteName: "Institute",
      username: "alice",
      userRole: UserRole.Operator,
    })(dispatch, vi.fn(), undefined);

    expect(action.type).toBe("user/create/rejected");
    expect(action.payload).toBe(USER_ERROR_CODES.CREATE_FAILED_EMAIL_EXISTS);
  });

  test("userCreateAsync maps axios conflict error (institute exists)", async () => {
    mockedApi.instituteRegister.mockRejectedValue({
      response: {
        data: {
          message: "institute exists",
        },
      },
    });

    const dispatch = vi.fn();
    const action = await userCreateAsync({
      email: "a@b.com",
      password: "Passw0rd",
      instituteName: "Institute",
      username: "alice",
      userRole: UserRole.Operator,
      bootstrap: true,
    })(dispatch, vi.fn(), undefined);

    expect(action.type).toBe("user/create/rejected");
    expect(action.payload).toBe(USER_ERROR_CODES.CREATE_FAILED_INSTITUTE_EXISTS);
  });

  test("userCreateAsync maps axios conflict error (username exists)", async () => {
    mockedApi.userCreate.mockRejectedValue({
      response: {
        data: {
          message: "username exists",
        },
      },
    });

    const dispatch = vi.fn();
    const action = await userCreateAsync({
      email: "a@b.com",
      password: "Passw0rd",
      instituteName: "Institute",
      username: "alice",
      userRole: UserRole.Operator,
    })(dispatch, vi.fn(), undefined);

    expect(action.type).toBe("user/create/rejected");
    expect(action.payload).toBe(USER_ERROR_CODES.CREATE_FAILED_USERNAME_EXISTS);
  });
  test("userLoginAsync success", async () => {
    mockedApi.userLogin.mockResolvedValue({
      code: 0,
      payload: [{ username: "alice", email: "a@b.com" }],
    } as any);
    const dispatch = vi.fn();
    const action = await userLoginAsync({ email: "a@b.com", password: "x" })(
      dispatch,
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("user/login/fulfilled");
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  test("verifyRegisterTokenAsync rejected when business code is non-zero", async () => {
    mockedApi.verifyToken.mockResolvedValue({
      code: 1,
      payload: [],
    } as any);
    const action = await verifyRegisterTokenAsync({ token: "bad-token" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("user/verifyToken/rejected");
    expect(action.payload).toBe(USER_ERROR_CODES.VERIFY_TOKEN_INVALID);
  });

  test("verifyRegisterTokenAsync rejected when request throws", async () => {
    mockedApi.verifyToken.mockRejectedValue(new Error("network"));
    const action = await verifyRegisterTokenAsync({ token: "bad-token" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("user/verifyToken/rejected");
    expect(action.payload).toBe(USER_ERROR_CODES.VERIFY_TOKEN_FAILED_INTERNAL);
  });

  test("userCreateAsync uses bootstrap route and resolves payload", async () => {
    mockedApi.instituteRegister.mockResolvedValue({
      code: 0,
      payload: [{ username: "bootstrap-user" }],
    } as any);
    const action = await userCreateAsync({
      email: "a@b.com",
      password: "Passw0rd",
      instituteName: "Institute",
      username: "alice",
      userRole: UserRole.Operator,
      bootstrap: true,
    })(vi.fn(), vi.fn(), undefined);
    expect(action.type).toBe("user/create/fulfilled");
    expect(mockedApi.instituteRegister).toHaveBeenCalledTimes(1);
  });

  test("userCreateAsync falls back to generic error for unknown message", async () => {
    mockedApi.userCreate.mockRejectedValue(new Error("timeout"));
    const action = await userCreateAsync({
      email: "a@b.com",
      password: "Passw0rd",
      instituteName: "Institute",
      username: "alice",
      userRole: UserRole.Operator,
    })(vi.fn(), vi.fn(), undefined);
    expect(action.type).toBe("user/create/rejected");
    expect(action.payload).toBe(USER_ERROR_CODES.CREATE_FAILED);
  });

  test("userLoginAsync rejected for business error and throw", async () => {
    mockedApi.userLogin.mockResolvedValue({ code: 1, payload: [] } as any);
    const actionBusiness = await userLoginAsync({ email: "a@b.com", password: "x" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(actionBusiness.type).toBe("user/login/rejected");
    expect(actionBusiness.payload).toBe(USER_ERROR_CODES.LOGIN_FAILED);

    mockedApi.userLogin.mockRejectedValue(new Error("network"));
    const actionThrow = await userLoginAsync({ email: "a@b.com", password: "x" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(actionThrow.type).toBe("user/login/rejected");
    expect(actionThrow.payload).toBe(USER_ERROR_CODES.LOGIN_FAILED);
  });

  test("userLogoutAsync resolves even when api fails", async () => {
    mockedApi.userLogout.mockRejectedValue(new Error("network"));
    const action = await userLogoutAsync()(vi.fn(), vi.fn(), undefined);
    expect(action.type).toBe("user/logout/fulfilled");
  });
});
