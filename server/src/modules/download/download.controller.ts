import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { BadRequestException, Controller, Get, Inject, NotFoundException, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_TEMPLATE_FILENAME, normalizeTemplateFilename, SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import { Public } from "../../common/http/decorators/public.decorator";
import { resolveServerTemplateDir } from "../model/model-config";

type CsvResponse = {
  setHeader(name: string, value: string): unknown;
  send(content: string): unknown;
};

@Controller()
export class DownloadController {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  @Public()
  @Get("/api/download")
  download(@Res() reply: CsvResponse, @Query("file") requestedFile?: string) {
    const configuredFilename = this.configService.get<string>("TEMPLATE_FILENAME")?.trim() || DEFAULT_TEMPLATE_FILENAME;
    const filename = normalizeTemplateFilename(requestedFile ?? configuredFilename);
    if (!filename) {
      throw new BadRequestException(SharedClientErrorMessage.invalidTemplateFilename);
    }
    const templateDirRaw = this.configService.get<string>("TEMPLATE_DIR");
    const templateDir = resolveServerTemplateDir(templateDirRaw);
    const candidate = path.resolve(templateDir, filename);
    if (!existsSync(candidate)) {
      throw new NotFoundException(SharedClientErrorMessage.templateNotFound);
    }
    const content = readFileSync(candidate, "utf-8");
    reply.setHeader("Content-Type", "text/csv; charset=utf-8");
    reply.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    return reply.send(content);
  }
}
