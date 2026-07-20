import {
  UserRole,
} from "../../types";
export type RegisterMode = "bootstrap" | "invited" | "electron";
export const isBootstrapRegisterMode = (
  mode: RegisterMode,
  isFirstRun: boolean
) => mode === "bootstrap" || (mode === "electron" && isFirstRun);
export const resolveRegisterUserRole = ({
  mode,
  isFirstRun,
}: {
  mode: RegisterMode;
  isFirstRun: boolean;
}): UserRole => {
  if (isBootstrapRegisterMode(mode, isFirstRun)) {
    return UserRole.Administrator;
  }
  return UserRole.Operator;
};
export const resolveLoginTabAvailable = (
  isElectronRuntime: boolean,
  hasLocalUsers: boolean | undefined,
  bootstrapCheckFailed = false
) => !bootstrapCheckFailed && (!isElectronRuntime || hasLocalUsers === true);
export const resolveActiveLoginTabKey = (
  activeTabKey: string,
  isElectronRuntime: boolean,
  hasLocalUsers: boolean | undefined,
  bootstrapCheckFailed = false
) =>
  resolveLoginTabAvailable(isElectronRuntime, hasLocalUsers, bootstrapCheckFailed)
    ? activeTabKey
    : "register";
