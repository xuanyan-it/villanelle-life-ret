import { Body, ConflictException, Controller, HttpCode, Inject, Post, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type { Response } from "express";

import {
  type ServerUserCreateRequest,
  type ServerUserLoginRequest,
  ServerUserCreateRequestSchema,
  ServerUserLoginRequestSchema
} from "../../contracts/request.schemas";
import { ServerAuthResultSchema } from "../../contracts/response.schemas";

import { ok } from "../../common/envelope/response";
import { Public } from "../../common/http/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/http/pipes/zod-validation.pipe";
import { parseJwtExpiresSeconds } from "../../config/env";

import { AuthService } from "./auth.service";

type UserLoginBody = ServerUserLoginRequest;
type UserCreateBody = ServerUserCreateRequest;

@Controller("/api/user")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  private getCookieName(): string {
    return this.configService.get<string>("AUTH_COOKIE_NAME", "ret_at");
  }

  private isProduction(): boolean {
    return (this.configService.get<string>("NODE_ENV", "development") ?? "").trim().toLowerCase() === "production";
  }

  private setAccessCookie(response: Response, accessToken: string): void {
    const expires = this.configService.get<string>("JWT_EXPIRES_IN", "24h");
    const expiresSeconds = parseJwtExpiresSeconds(expires) ?? 24 * 60 * 60;
    response.cookie(this.getCookieName(), accessToken, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "lax",
      maxAge: expiresSeconds * 1000,
      path: "/"
    });
  }

  private clearAccessCookie(response: Response): void {
    response.clearCookie(this.getCookieName(), {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "lax",
      path: "/"
    });
  }

  @Public()
  @Post("/login")
  @HttpCode(200)
  async userLogin(
    @Body(new ZodValidationPipe(ServerUserLoginRequestSchema)) body: UserLoginBody,
    @Res({ passthrough: true }) response: Response
  ) {
    const data = await this.authService.userLogin(body);
    if (!data) {
      throw new UnauthorizedException(SharedClientErrorMessage.loginFailed);
    }
    this.setAccessCookie(response, data.accessToken);
    return ok(data, "", ServerAuthResultSchema);
  }

  @Public()
  @Post("/create")
  @HttpCode(200)
  async userCreate(
    @Body(new ZodValidationPipe(ServerUserCreateRequestSchema)) body: UserCreateBody,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.userCreate(body);
    if ("error" in result) {
      throw new ConflictException(result.error);
    }
    const accessToken = (result.data as { accessToken?: string }).accessToken;
    if (typeof accessToken === "string" && accessToken.length > 0) {
      this.setAccessCookie(response, accessToken);
    }
    return ok(result.data, "", ServerAuthResultSchema);
  }

  @Public()
  @Post("/logout")
  @HttpCode(200)
  async userLogout(@Res({ passthrough: true }) response: Response) {
    this.clearAccessCookie(response);
    return ok(true);
  }
}
