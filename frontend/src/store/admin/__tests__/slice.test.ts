import { RequestStatus } from "../../../types";
import reducer from "../slice";
import { initialState } from "../state";
import {
  deleteUserAsync,
  fetchInstituteCredentialAsync,
  fetchUserListAsync,
} from "../thunks";
describe("admin slice", () => {
  test("returns initial state", () => {
    expect(reducer(undefined, { type: "unknown" })).toEqual(initialState);
  });
  test("handles fetchInstituteCredential lifecycle", () => {
    let state = reducer(
      initialState,
      fetchInstituteCredentialAsync.pending("", { instituteName: "X" })
    );
    expect(state.status).toBe(RequestStatus.Pending);
    state = reducer(
      state,
      fetchInstituteCredentialAsync.fulfilled(
        {
          result: [{ token: "TKN-1" }],
        } as any,
        "",
        { instituteName: "X" }
      )
    );
    expect(state.status).toBe(RequestStatus.Success);
    expect(state.token).toBe("TKN-1");
    state = reducer(
      state,
      fetchInstituteCredentialAsync.rejected(null, "", { instituteName: "X" })
    );
    expect(state.status).toBe(RequestStatus.Error);
  });
  test("handles fetchUserList fulfilled", () => {
    const state = reducer(
      initialState,
      fetchUserListAsync.fulfilled(
        {
          total: 1,
          result: [{ username: "u", email: "e", userRole: "operator", uuid: "1" }],
        } as any,
        "",
        { instituteName: "X" }
      )
    );
    expect(state.status).toBe(RequestStatus.Success);
    expect(state.total).toBe(1);
    expect(state.userList).toHaveLength(1);
  });
  test("handles deleteUser lifecycle", () => {
    let state = reducer(initialState, deleteUserAsync.pending("", "1"));
    expect(state.status).toBe(RequestStatus.Pending);
    state = reducer(state, deleteUserAsync.fulfilled(true, "", "1"));
    expect(state.status).toBe(RequestStatus.Success);
    state = reducer(state, deleteUserAsync.rejected(null, "", "1"));
    expect(state.status).toBe(RequestStatus.Error);
  });
});
