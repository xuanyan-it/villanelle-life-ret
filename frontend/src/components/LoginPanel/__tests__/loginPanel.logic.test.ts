import { describe, expect, it } from "vitest";
import { UserRole } from "../../../types";
import {
  isBootstrapRegisterMode,
  resolveActiveLoginTabKey,
  resolveLoginTabAvailable,
  resolveRegisterUserRole,
} from "../loginPanel.logic";
describe("loginPanel.logic", () => {
  it("detects bootstrap register mode", () => {
    expect(isBootstrapRegisterMode("bootstrap", false)).toBe(true);
    expect(isBootstrapRegisterMode("electron", true)).toBe(true);
    expect(isBootstrapRegisterMode("electron", false)).toBe(false);
    expect(isBootstrapRegisterMode("invited", true)).toBe(false);
  });
  it("resolves register user role with bootstrap priority", () => {
    expect(
      resolveRegisterUserRole({
        mode: "bootstrap",
        isFirstRun: false,
      })
    ).toBe(UserRole.Administrator);
    expect(
      resolveRegisterUserRole({
        mode: "electron",
        isFirstRun: true,
      })
    ).toBe(UserRole.Administrator);
    expect(
      resolveRegisterUserRole({
        mode: "invited",
        isFirstRun: false,
      })
    ).toBe(UserRole.Operator);
  });
  it("resolves login tab availability and active key", () => {
    expect(resolveLoginTabAvailable(false, undefined)).toBe(true);
    expect(resolveLoginTabAvailable(true, true)).toBe(true);
    expect(resolveLoginTabAvailable(true, false)).toBe(false);
    expect(resolveLoginTabAvailable(true, true, true)).toBe(false);
    expect(resolveActiveLoginTabKey("login", false, undefined)).toBe("login");
    expect(resolveActiveLoginTabKey("login", true, true)).toBe("login");
    expect(resolveActiveLoginTabKey("login", true, false)).toBe("register");
    expect(resolveActiveLoginTabKey("login", true, true, true)).toBe("register");
    expect(resolveActiveLoginTabKey("register", true, false)).toBe("register");
  });
});
