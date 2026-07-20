import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { createSanitizedLogger } from "../../common/logging/sanitized-logger";

import { loadServerModelConfig } from "./model-config";

@Injectable()
export class ModelStrictService implements OnModuleInit {
  private readonly logger = createSanitizedLogger(ModelStrictService.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
    if (nodeEnv !== "production") return;

    const modelRoot = this.configService.get<string>("MODEL_ROOT");
    const config = loadServerModelConfig(modelRoot);
    this.logger.log(`[model-config-validate] validated modelVersion=${config.modelVersion}`);
  }
}
