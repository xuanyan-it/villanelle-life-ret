import { RequestStatus, UserRole } from "../../../types";
import reducer from "../slice";
import { initialState } from "../state";
import {
  userCreateAsync,
  userLoginAsync,
  userLogoutAsync,
  verifyRegisterTokenAsync,
} from "../thunks";
describe("user slice", () => {
  test("returns initial state", () => {
    expect(reducer(undefined, { type: "unknown" })).toEqual(initialState);
  });
  test("handles verify token lifecycle", () => {
    let state = reducer(
      initialState,
      verifyRegisterTokenAsync.pending("", { token: "x" })
    );
    expect(state.status).toBe(RequestStatus.Pending);
    state = reducer(
      state,
      verifyRegisterTokenAsync.fulfilled(
        { result: [{ instituteName: "Institute" }] } as any,
        "",
        { token: "x" }
      )
    );
    expect(state.instituteName).toBe("Institute");
    expect(state.status).toBe(RequestStatus.None);
  });
  test("handles userCreate/userLogin fulfilled", () => {
    const payload = [
      {
        instituteName: "Institute",
        username: "alice",
        email: "a@b.com",
        userRole: UserRole.Operator,
      },
    ];
    let state = reducer(
      initialState,
      userCreateAsync.fulfilled(payload as any, "", {
        email: "",
        password: "",
        instituteName: "",
        username: "",
        userRole: UserRole.Operator,
      })
    );
    expect(state.status).toBe(RequestStatus.Success);
    expect(state.username).toBe("alice");
    state = reducer(
      initialState,
      userLoginAsync.fulfilled(payload as any, "", {
        email: "",
        password: "",
      })
    );
    expect(state.status).toBe(RequestStatus.Success);
    expect(state.username).toBe("alice");
  });
  test("handles rejected and logout", () => {
    let state = reducer(
      initialState,
      userLoginAsync.rejected(null, "", { email: "", password: "" })
    );
    expect(state.status).toBe(RequestStatus.Error);
    state = reducer(state, userLogoutAsync.fulfilled(undefined, "", undefined));
    expect(state).toEqual(initialState);
  });
});
