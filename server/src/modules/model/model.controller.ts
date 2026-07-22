import { Controller, Get, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BaseModelConfigSchema, BaseRuntimeProfileSchema } from "@villanelle/ret-shared/contracts/base";

import { ok } from "../../common/envelope/response";
import { Public } from "../../common/http/decorators/public.decorator";

import { loadServerModelConfig } from "./model-config";
import { buildServerRuntimeProfile } from "./runtime-profile";

const PLACEHOLDER_MODEL_CONFIG = {
  modelVersion: "LNM-0.0",
  resultPositiveThreshold: 0.5,
};

@Controller("/api/model")
export class ModelController {
  private readonly logger = new Logger(ModelController.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  @Public()
  @Get("/config")
  modelConfig() {
    let config;
    try {
      config = loadServerModelConfig(this.configService.get<string>("MODEL_ROOT"));
    } catch (error) {
      this.logger.warn(
        `Model config not available, using placeholder: ${(error as Error).message}`
      );
      config = PLACEHOLDER_MODEL_CONFIG;
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
