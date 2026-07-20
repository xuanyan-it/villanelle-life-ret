import { existsSync } from "node:fs";
import path from "node:path";

import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DEFAULT_TEMPLATE_FILENAME,
  SharedClientErrorMessage,
  normalizeTemplateFilename
} from "@villanelle/ret-shared/contracts";

import { createSanitizedLogger } from "../../common/logging/sanitized-logger";
import { resolveServerTemplateDir } from "../model/model-config";

@Injectable()
export class DownloadStrictService implements OnModuleInit {
  private readonly logger = createSanitizedLogger(DownloadStrictService.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
    if (nodeEnv !== "production") return;

    const configuredFilename = this.configService.get<string>("TEMPLATE_FILENAME")?.trim() || DEFAULT_TEMPLATE_FILENAME;
    const filename = normalizeTemplateFilename(configuredFilename);
    if (!filename) {
      throw new Error(SharedClientErrorMessage.invalidTemplateFilename);
    }
    const templateDir = resolveServerTemplateDir(this.configService.get<string>("TEMPLATE_DIR"), nodeEnv);
    const templatePath = path.resolve(templateDir, filename);
    if (!existsSync(templatePath)) {
      throw new Error(`template file not found: ${templatePath}`);
    }

    this.logger.log(`[template-config-validate] validated template=${filename}`);
  }
}
