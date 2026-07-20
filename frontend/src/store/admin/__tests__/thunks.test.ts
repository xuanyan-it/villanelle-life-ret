import { beforeEach, describe, expect, test, vi, type Mock, type Mocked } from "vitest";
import { api } from "../../../api";
import { ADMIN_ERROR_CODES } from "../errors";
import {
  deleteUserAsync,
  fetchInstituteCredentialAsync,
  fetchUserListAsync,
} from "../thunks";
vi.mock("../../../api", () => ({
  api: {
    fetchInstituteCredential: vi.fn(),
    userList: vi.fn(),
    userDelete: vi.fn(),
  },
}));
const mockedApi = api as Mocked<typeof api>;
describe("admin thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test("fetchInstituteCredentialAsync success", async () => {
    mockedApi.fetchInstituteCredential.mockResolvedValue({
      code: 0,
      payload: [{ result: [{ token: "TKN" }] }],
    } as any);
    const dispatch = vi.fn();
    const getState = vi.fn(() => ({
      user: { instituteName: "Institute" },
    })) as any;
    const action = await fetchInstituteCredentialAsync({ instituteName: "Institute" })(
      dispatch,
      getState,
      undefined
    );
    expect(action.type).toBe("admin/fetchCredential/fulfilled");
    expect(mockedApi.fetchInstituteCredential).toHaveBeenCalledWith({
      instituteName: "Institute",
    });
  });
  test("fetchUserListAsync rejects when user list is empty", async () => {
    mockedApi.userList.mockResolvedValue({ payload: [] } as any);
    const dispatch = vi.fn();
    const getState = vi.fn(() => ({
      user: { instituteName: "Institute" },
    })) as any;
    const action = await fetchUserListAsync({ instituteName: "Institute" })(
      dispatch,
      getState,
      undefined
    );
    expect(action.type).toBe("admin/listUsers/rejected");
    expect(
      dispatch.mock.calls.some(
        ([a]) => a && typeof a === "object" && a.type === "notification/pushNotification"
      )
    ).toBe(false);
  });
  test("deleteUserAsync dispatches follow-up fetch", async () => {
    mockedApi.userDelete.mockResolvedValue({ code: 0 } as any);
    const dispatch = vi.fn();
    const getState = vi.fn(() => ({
      user: { instituteName: "Institute" },
    })) as any;
    const action = await deleteUserAsync("user-1")(dispatch, getState, undefined);
    expect(action.type).toBe("admin/deleteUser/fulfilled");
    expect(dispatch.mock.calls.some(([a]) => typeof a === "function")).toBe(true);
  });

  test("fetchInstituteCredentialAsync rejects when instituteName is empty", async () => {
    const action = await fetchInstituteCredentialAsync({ instituteName: "" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("admin/fetchCredential/rejected");
    expect(action.payload).toBe(ADMIN_ERROR_CODES.FETCH_CREDENTIAL_FAILED);
    expect(mockedApi.fetchInstituteCredential).not.toHaveBeenCalled();
  });

  test("fetchInstituteCredentialAsync rejects when backend returns error code", async () => {
    mockedApi.fetchInstituteCredential.mockResolvedValue({
      code: 1,
      payload: [],
    } as any);
    const action = await fetchInstituteCredentialAsync({ instituteName: "Institute" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("admin/fetchCredential/rejected");
    expect(action.payload).toBe(ADMIN_ERROR_CODES.FETCH_CREDENTIAL_FAILED);
  });

  test("fetchUserListAsync rejects when instituteName is empty", async () => {
    const action = await fetchUserListAsync({ instituteName: "" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("admin/listUsers/rejected");
    expect(action.payload).toBe(ADMIN_ERROR_CODES.LIST_USERS_FAILED);
    expect(mockedApi.userList).not.toHaveBeenCalled();
  });

  test("fetchUserListAsync succeeds when payload has data", async () => {
    mockedApi.userList.mockResolvedValue({
      payload: [{ users: [{ uuid: "u1" }] }],
    } as any);
    const action = await fetchUserListAsync({ instituteName: "Institute" })(
      vi.fn(),
      vi.fn(),
      undefined
    );
    expect(action.type).toBe("admin/listUsers/fulfilled");
    expect(action.payload).toEqual({ users: [{ uuid: "u1" }] });
  });

  test("deleteUserAsync rejects when backend returns error code", async () => {
    mockedApi.userDelete.mockResolvedValue({ code: 1 } as any);
    const action = await deleteUserAsync("user-1")(
      vi.fn(),
      vi.fn(() => ({ user: { instituteName: "Institute" } })),
      undefined
    );
    expect(action.type).toBe("admin/deleteUser/rejected");
    expect(action.payload).toBe(ADMIN_ERROR_CODES.DELETE_USER_FAILED);
  });

  test("deleteUserAsync rejects when api throws", async () => {
    mockedApi.userDelete.mockRejectedValue(new Error("network"));
    const action = await deleteUserAsync("user-1")(
      vi.fn(),
      vi.fn(() => ({ user: { instituteName: "Institute" } })),
      undefined
    );
    expect(action.type).toBe("admin/deleteUser/rejected");
    expect(action.payload).toBe(ADMIN_ERROR_CODES.DELETE_USER_FAILED);
  });
});
