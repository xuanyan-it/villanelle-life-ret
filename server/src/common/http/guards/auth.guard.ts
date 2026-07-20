import type {
  CanActivate,
  ExecutionContext} from "@nestjs/common";
import {
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import { TokenExpiredError } from "jsonwebtoken";

import { verifyAccessJwt } from "../../auth/jwt";
import { createSanitizedLogger } from "../../logging/sanitized-logger";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

const guardLogger = createSanitizedLogger("AuthGuard");

const parseCookieToken = (cookies: unknown, cookieName: string): string | null => {
  if (!cookies || typeof cookies !== "object") return null;
  const token = (cookies as Record<string, unknown>)[cookieName];
  return typeof token === "string" && token.length > 0 ? token : null;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const cookieName = this.configService.get<string>("AUTH_COOKIE_NAME", "ret_at");
    const cookieToken = parseCookieToken(request.cookies, cookieName);
    const token = cookieToken;

    if (!token) {
      throw new UnauthorizedException(SharedClientErrorMessage.missingAccessToken);
    }

    try {
      const jwtSecret = this.configService.get<string>("JWT_SECRET", "dev-change-me");
      request.authUser = verifyAccessJwt(token, jwtSecret);
      return true;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException(SharedClientErrorMessage.tokenExpired);
      }
      guardLogger.warn(`invalid access token requestId=${request.requestId ?? "-"}`);
      throw new UnauthorizedException(SharedClientErrorMessage.invalidAccessToken);
    }
  }
}

