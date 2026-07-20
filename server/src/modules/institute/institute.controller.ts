import { BadRequestException, Body, ConflictException, Controller, HttpCode, Inject, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type { Response } from "express";

import {
  type ServerInstituteCreateRequest,
  type ServerInstituteCredentialRequest,
  type ServerInstituteListRequest,
  type ServerInstituteRegisterRequest,
  type ServerInstituteVerifyRequest,
  ServerInstituteCreateRequestSchema,
  ServerInstituteCredentialRequestSchema,
  ServerInstituteListRequestSchema,
  ServerInstituteRegisterRequestSchema,
  ServerInstituteVerifyRequestSchema
} from "../../contracts/request.schemas";
import {
  ServerAuthResultSchema,
  ServerInstituteCreateSuccessEnvelopeSchema,
  ServerInstituteCredentialQuerySchema,
  ServerInstituteQuerySchema
} from "../../contracts/response.schemas";

import { ok } from "../../common/envelope/response";
import { Public } from "../../common/http/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/http/pipes/zod-validation.pipe";
import { parseJwtExpiresSeconds } from "../../config/env";

import { InstituteService } from "./institute.service";

type InstituteListBody = ServerInstituteListRequest;
type InstituteCredentialBody = ServerInstituteCredentialRequest;
type InstituteCreateBody = ServerInstituteCreateRequest;
type InstituteRegisterBody = ServerInstituteRegisterRequest;
type InstituteVerifyBody = ServerInstituteVerifyRequest;

@Controller("/api/institute")
export class InstituteController {
  constructor(
    @Inject(InstituteService) private readonly instituteService: InstituteService,
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

  @Post("/list")
  @HttpCode(200)
  async instituteList(@Body(new ZodValidationPipe(ServerInstituteListRequestSchema)) body: InstituteListBody) {
    return ok(await this.instituteService.listInstitutes(body), "", ServerInstituteQuerySchema);
  }

  @Post("/credential/get")
  @HttpCode(200)
  async instituteCredentialGet(
    @Body(new ZodValidationPipe(ServerInstituteCredentialRequestSchema)) body: InstituteCredentialBody
  ) {
    return ok(await this.instituteService.getInstituteCredential(body.instituteName), "", ServerInstituteCredentialQuerySchema);
  }

  @Public()
  @Post("/create")
  @HttpCode(200)
  async instituteCreate(@Body(new ZodValidationPipe(ServerInstituteCreateRequestSchema)) body: InstituteCreateBody) {
    const result = await this.instituteService.createInstitute(body.instituteName);
    if ("error" in result) {
      throw new ConflictException(result.error);
    }
    return ok(
      result,
      "",
      ServerInstituteCreateSuccessEnvelopeSchema.shape.payload.element
    );
  }

  @Public()
  @Post("/register")
  @HttpCode(200)
  async instituteRegister(
    @Body(new ZodValidationPipe(ServerInstituteRegisterRequestSchema)) body: InstituteRegisterBody
    ,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.instituteService.registerInstitute(body);
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
  @Post("/verify")
  @HttpCode(200)
  async instituteVerify(@Body(new ZodValidationPipe(ServerInstituteVerifyRequestSchema)) body: InstituteVerifyBody) {
    const result = await this.instituteService.verifyInstituteToken(body.token);
    if (result.total === 0) {
      throw new BadRequestException(SharedClientErrorMessage.invalidToken);
    }
    return ok(result, "", ServerInstituteQuerySchema);
  }
}

