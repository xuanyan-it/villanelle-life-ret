import {
  getInstituteCredentialToken,
  getUserList,
} from "../selectors";
describe("admin selectors", () => {
  test("select expected fields", () => {
    const state = {
      admin: {
        userList: [{ username: "u", email: "e", userRole: "operator", uuid: "1" }],
        token: "TKN-1",
      },
    } as any;
    expect(getUserList(state)).toHaveLength(1);
    expect(getInstituteCredentialToken(state)).toBe("TKN-1");
  });
});
