import { Module } from "@nestjs/common";

import { DownloadController } from "./download.controller";
import { DownloadStrictService } from "./download-strict.service";

@Module({
  controllers: [DownloadController],
  providers: [DownloadStrictService]
})
export class DownloadModule {}
