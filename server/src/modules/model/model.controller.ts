import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BaseModelConfigSchema, BaseRuntimeProfileSchema } from "@villanelle/ret-shared/contracts/base";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import { ok } from "../../common/envelope/response";
import { Public } from "../../common/http/decorators/public.decorator";

import { loadServerModelConfig } from "./model-config";
import { buildServerRuntimeProfile } from "./runtime-profile";

@Controller("/api/model")
export class ModelController {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  @Public()
  @Get("/config")
  modelConfig() {
    let config;
    try {
      config = loadServerModelConfig(this.configService.get<string>("MODEL_ROOT"));
    } catch (error) {
      throw new ServiceUnavailableException(SharedClientErrorMessage.requestFailed);
    }
    return ok(config, "", BaseModelConfigSchema);
  }

  @Get("/runtime-profile")
  runtimeProfile() {
    const profile = buildServerRuntimeProfile(
      this.configService.get<string>("DATABASE_URL"),
      this.configService.get<string>("MODEL_ROOT"),
      process.env.NODE_ENV
    );
    return ok(profile, "", BaseRuntimeProfileSchema);
  }
}
