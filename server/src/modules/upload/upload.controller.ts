import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put, Req } from "@nestjs/common";
import { z } from "zod";
import type { Request } from "express";

import { ZodValidationPipe } from "../../common/http/pipes/zod-validation.pipe";
import { UploadService } from "./upload.service";

const InitSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
  chunkSize: z.number().int().optional()
});
const CompleteSchema = z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/i).optional() });
const ownerOf = (request: any): string => String(request?.authUser?.username ?? "");

@Controller("/api/uploads")
export class UploadController {
  constructor(@Inject(UploadService) private readonly uploads: UploadService) {}

  @Post("/init")
  init(@Req() request: Request, @Body(new ZodValidationPipe(InitSchema)) body: z.infer<typeof InitSchema>) {
    return this.uploads.init(ownerOf(request), body);
  }

  @Get("/:uploadId/status")
  status(@Req() request: Request, @Param("uploadId") uploadId: string) {
    return this.uploads.status(uploadId, ownerOf(request));
  }

  @Put("/:uploadId/chunks/:index")
  writeChunk(
    @Req() request: Request,
    @Param("uploadId") uploadId: string,
    @Param("index", ParseIntPipe) index: number
  ) {
    return this.uploads.writeChunk(uploadId, ownerOf(request), index, request);
  }

  @Post("/:uploadId/complete")
  complete(
    @Req() request: Request,
    @Param("uploadId") uploadId: string,
    @Body(new ZodValidationPipe(CompleteSchema)) body: z.infer<typeof CompleteSchema>
  ) {
    return this.uploads.complete(uploadId, ownerOf(request), body.sha256);
  }
}
