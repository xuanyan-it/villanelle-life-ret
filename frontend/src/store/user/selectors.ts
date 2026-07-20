import type { RootState } from "../index";
export const getLoginStatus = (state: RootState) => state.user.status;
export const getUserRole = (state: RootState) => state.user.userRole;
export const getUsername = (state: RootState) => state.user.username;
export const getEmail = (state: RootState) => state.user.email;
export const getInstituteName = (state: RootState) => state.user.instituteName;
