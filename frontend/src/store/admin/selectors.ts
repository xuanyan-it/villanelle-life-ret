import type { RootState } from "../index";
export const getUserList = (state: RootState) => state.admin.userList;
export const getInstituteCredentialToken = (state: RootState) => state.admin.token;
