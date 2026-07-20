import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

export type AuthSession = {
  isAuthenticated(): boolean;
  markAuthenticated(principal: AuthSessionPrincipal): void;
  clear(): void;
  requireAuthenticated(): void;
  getPrincipal(): AuthSessionPrincipal | null;
};

export type AuthSessionPrincipal = {
  username: string;
  instituteName: string;
};

export const createAuthSession = (): AuthSession => {
  let authenticated = false;
  let principal: AuthSessionPrincipal | null = null;

  return {
    isAuthenticated: () => authenticated,
    markAuthenticated: (nextPrincipal) => {
      authenticated = true;
      principal = nextPrincipal;
    },
    clear: () => {
      authenticated = false;
      principal = null;
    },
    requireAuthenticated: () => {
      if (!authenticated) {
        throw new Error(SharedClientErrorMessage.unauthorized);
      }
    },
    getPrincipal: () => principal
  };
};
