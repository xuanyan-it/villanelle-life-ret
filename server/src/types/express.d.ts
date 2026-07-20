import type { UserRole } from "@villanelle/ret-shared/domain";

type AuthUser = {
  uuid?: string;
  username: string;
  instituteName: string;
  email: string;
  userRole: UserRole;
  iat?: number;
  exp?: number;
};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      authUser?: AuthUser;
    }
  }
}

export {};
