import { RequestStatus, UserRole } from "../../../types";
import {
  getEmail,
  getInstituteName,
  getLoginStatus,
  getUsername,
  getUserRole,
} from "../selectors";
describe("user selectors", () => {
  test("select expected fields", () => {
    const state = {
      user: {
        status: RequestStatus.Success,
        userRole: UserRole.Administrator,
        username: "alice",
        email: "a@b.com",
        instituteName: "Institute",
      },
    } as any;
    expect(getLoginStatus(state)).toBe(RequestStatus.Success);
    expect(getUserRole(state)).toBe(UserRole.Administrator);
    expect(getUsername(state)).toBe("alice");
    expect(getEmail(state)).toBe("a@b.com");
    expect(getInstituteName(state)).toBe("Institute");
  });
});
