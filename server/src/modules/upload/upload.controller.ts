import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put, Query, Req, Res } from "@nestjs/common";
import { z } from "zod";
import type { Request, Response } from "express";

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

  @Get("/:uploadId/heatmap")
  async heatmap(
    @Req() request: Request,
    @Res() response: Response,
    @Param("uploadId") uploadId: string
  ) {
    const heatmapPath = await this.uploads.heatmapPath(uploadId, ownerOf(request));
    if (!heatmapPath) {
      return response.status(204).send();
    }
    response.setHeader("Cache-Control", "private, no-store");
    return response.sendFile(heatmapPath);
  }

  @Get("/:uploadId/slide-preview")
  async slidePreview(
    @Req() request: Request,
    @Res() response: Response,
    @Param("uploadId") uploadId: string
  ) {
    const previewPath = await this.uploads.slidePreviewPath(uploadId, ownerOf(request));
    if (!previewPath) {
      return response.status(204).send();
    }
    response.setHeader("Cache-Control", "private, no-store");
    return response.sendFile(previewPath);
  }

  @Get("/:uploadId/tiles/:level/:tilePath")
  async tile(
    @Req() request: Request,
    @Res() response: Response,
    @Param("uploadId") uploadId: string,
    @Param("level") level: string,
    @Param("tilePath") tilePath: string,
    @Query("tileWidth") tileWidth?: string,
    @Query("tileHeight") tileHeight?: string,
  ) {
    // tilePath format: "x_y.png" (DZI convention)
    const match = /^(\d+)_(\d+)(?:\.\w+)?$/.exec(tilePath);
    if (!match) {
      return response.status(400).json({ error: "invalid tile path, expected x_y.ext" });
    }
    const x = parseInt(match[1]!, 10);
    const y = parseInt(match[2]!, 10);

    const slidePath = await this.uploads.slideFilePath(uploadId, ownerOf(request));
    if (!slidePath) {
      return response.status(404).json({ error: "slide file not found" });
    }
    return this.uploads.extractTile(response, slidePath, {
      level: parseInt(level, 10),
      x,
      y,
      tileWidth: parseInt(tileWidth ?? "256", 10),
      tileHeight: parseInt(tileHeight ?? "256", 10),
    });
  }

  @Get("/:uploadId/slide-info")
  async slideInfo(
    @Req() request: Request,
    @Res() response: Response,
    @Param("uploadId") uploadId: string,
  ) {
    const slidePath = await this.uploads.slideFilePath(uploadId, ownerOf(request));
    if (!slidePath) {
      return response.status(404).json({ error: "slide file not found" });
    }
    const info = await this.uploads.slideInfo(slidePath);
    return response.json(info);
  }

  // ── IIIF Image API 2.0 (aligned with svs-master) ─────────────────

  @Get("/:uploadId/iiif/info.json")
  async iiifInfo(
    @Req() request: Request,
    @Res() response: Response,
    @Param("uploadId") uploadId: string,
  ) {
    const slidePath = await this.uploads.slideFilePath(uploadId, ownerOf(request));
    if (!slidePath) {
      return response.status(404).json({ error: "slide file not found" });
    }
    const info = await this.uploads.iiifInfo(slidePath, uploadId, request);
    return response.json(info);
  }

  // IIIF tile: region = "x,y,w,h"  size = "w," or "w,h"  rotation = "0"
  @Get("/:uploadId/iiif/:region/:size/:rotation/default.jpg")
  async iiifTile(
    @Req() request: Request,
    @Res() response: Response,
    @Param("uploadId") uploadId: string,
    @Param("region") region: string,
    @Param("size") size: string,
    @Param("rotation") rotation: string,
  ) {
    const slidePath = await this.uploads.slideFilePath(uploadId, ownerOf(request));
    if (!slidePath) {
      return response.status(404).json({ error: "slide file not found" });
    }
    return this.uploads.extractIiiifTile(response, slidePath, region, size, rotation);
  }

  // IIIF thumbnail: /full/{width},{height}/{rotation}/default.jpg
  @Get("/:uploadId/iiif/full/:size/:rotation/default.jpg")
  async iiifFull(
    @Req() request: Request,
    @Res() response: Response,
    @Param("uploadId") uploadId: string,
    @Param("size") size: string,
  ) {
    const slidePath = await this.uploads.slideFilePath(uploadId, ownerOf(request));
    if (!slidePath) {
      return response.status(404).json({ error: "slide file not found" });
    }
    return this.uploads.extractIiiifTile(response, slidePath, "full", size, "0");
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
