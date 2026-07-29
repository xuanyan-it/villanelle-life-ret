import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

import { createSanitizedLogger } from "../../common/logging/sanitized-logger";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 32 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".svs"]);

type UploadStatus = "uploading" | "completed" | "failed";
type UploadMetadata = {
  uploadId: string;
  owner: string;
  originalFileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  status: UploadStatus;
  sha256?: string;
  storagePath?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class UploadService {
  private readonly logger = createSanitizedLogger(UploadService.name);
  private readonly root: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.root = path.resolve(this.configService.get<string>("UPLOAD_ROOT") ?? path.join(process.cwd(), "data", "uploads"));
  }

  private uploadDir(uploadId: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw new BadRequestException("invalid upload id");
    return path.join(this.root, uploadId);
  }

  private metadataPath(uploadId: string): string {
    return path.join(this.uploadDir(uploadId), "upload.json");
  }

  private async readMetadata(uploadId: string, owner: string): Promise<UploadMetadata> {
    try {
      const value = JSON.parse(await fs.readFile(this.metadataPath(uploadId), "utf8")) as UploadMetadata;
      if (value.owner !== owner) throw new NotFoundException("upload not found");
      return value;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException("upload not found");
    }
  }

  private async writeMetadata(metadata: UploadMetadata): Promise<void> {
    metadata.updatedAt = new Date().toISOString();
    const target = this.metadataPath(metadata.uploadId);
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(metadata, null, 2), "utf8");
    await fs.rename(temporary, target);
  }

  async init(owner: string, input: { fileName: string; fileSize: number; chunkSize?: number }) {
    const originalFileName = path.basename(input.fileName);
    if (!ALLOWED_EXTENSIONS.has(path.extname(originalFileName).toLowerCase())) {
      throw new BadRequestException("only .svs files are supported");
    }
    if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException("file size must be between 1 byte and 2 GB");
    }
    const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;
    if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024 * 1024 || chunkSize > 64 * 1024 * 1024) {
      throw new BadRequestException("chunk size must be between 1 MB and 64 MB");
    }
    const uploadId = randomUUID();
    const now = new Date().toISOString();
    const metadata: UploadMetadata = {
      uploadId,
      owner,
      originalFileName,
      fileSize: input.fileSize,
      chunkSize,
      totalChunks: Math.ceil(input.fileSize / chunkSize),
      uploadedChunks: [],
      status: "uploading",
      createdAt: now,
      updatedAt: now
    };
    await fs.mkdir(path.join(this.uploadDir(uploadId), "chunks"), { recursive: true });
    await this.writeMetadata(metadata);
    this.logger.log(`[upload] initialized id=${uploadId} size=${input.fileSize} chunks=${metadata.totalChunks}`);
    return metadata;
  }

  async status(uploadId: string, owner: string) {
    return this.readMetadata(uploadId, owner);
  }

  async heatmapPath(uploadId: string, owner: string): Promise<string | null> {
    await this.readMetadata(uploadId, owner);
    const heatmapPath = path.join(this.uploadDir(uploadId), "output", "heatmap.png");
    try {
      await fs.access(heatmapPath);
      return heatmapPath;
    } catch {
      // A requested heatmap is created only after evaluation finishes. Missing
      // output is therefore a normal pending/unavailable state, not a server
      // exception. Unknown uploads are still rejected by readMetadata above.
      return null;
    }
  }

  async writeChunk(uploadId: string, owner: string, index: number, request: Request) {
    const metadata = await this.readMetadata(uploadId, owner);
    if (metadata.status !== "uploading") throw new BadRequestException("upload is not active");
    if (!Number.isInteger(index) || index < 0 || index >= metadata.totalChunks) {
      throw new BadRequestException("invalid chunk index");
    }
    const expectedSize = index === metadata.totalChunks - 1
      ? metadata.fileSize - index * metadata.chunkSize
      : metadata.chunkSize;
    const declaredHeader = request.headers["content-length"];
    if (declaredHeader !== undefined && Number(declaredHeader) !== expectedSize) {
      throw new BadRequestException("invalid chunk size");
    }

    const target = path.join(this.uploadDir(uploadId), "chunks", `${index}.part`);
    const temporary = `${target}.tmp`;
    try {
      await pipeline(request, createWriteStream(temporary, { flags: "wx" }));
      const stat = await fs.stat(temporary);
      if (stat.size !== expectedSize) throw new Error("incomplete chunk");
      await fs.rename(temporary, target);
      if (!metadata.uploadedChunks.includes(index)) metadata.uploadedChunks.push(index);
      metadata.uploadedChunks.sort((a, b) => a - b);
      await this.writeMetadata(metadata);
      this.logger.log(`[upload] chunk stored id=${uploadId} index=${index} bytes=${stat.size}`);
      return { uploadId, index, uploadedChunks: metadata.uploadedChunks };
    } catch (error) {
      await fs.rm(temporary, { force: true });
      this.logger.warn(`[upload] chunk failed id=${uploadId} index=${index} reason=${String(error)}`);
      throw error;
    }
  }

  async complete(uploadId: string, owner: string, expectedSha256?: string) {
    const metadata = await this.readMetadata(uploadId, owner);
    if (metadata.uploadedChunks.length !== metadata.totalChunks) {
      throw new BadRequestException("upload is incomplete");
    }
    const finalDir = path.join(this.uploadDir(uploadId), "input");
    const temporary = path.join(this.uploadDir(uploadId), "assembled.tmp");
    await fs.mkdir(finalDir, { recursive: true });
    const output = createWriteStream(temporary, { flags: "wx" });
    const hash = createHash("sha256");
    try {
      for (let index = 0; index < metadata.totalChunks; index += 1) {
        const chunkPath = path.join(this.uploadDir(uploadId), "chunks", `${index}.part`);
        const stream = createReadStream(chunkPath);
        for await (const chunk of stream) {
          hash.update(chunk as Buffer);
          if (!output.write(chunk)) await new Promise<void>((resolve) => output.once("drain", resolve));
        }
      }
      await new Promise<void>((resolve, reject) => output.end((error?: Error | null) => error ? reject(error) : resolve()));
      const stat = await fs.stat(temporary);
      if (stat.size !== metadata.fileSize) throw new Error("assembled file size mismatch");
      const sha256 = hash.digest("hex");
      if (expectedSha256 && sha256.toLowerCase() !== expectedSha256.toLowerCase()) {
        throw new BadRequestException("file checksum mismatch");
      }
      const finalPath = path.join(finalDir, metadata.originalFileName);
      await fs.rename(temporary, finalPath);
      await fs.rm(path.join(this.uploadDir(uploadId), "chunks"), { recursive: true, force: true });
      metadata.status = "completed";
      metadata.sha256 = sha256;
      metadata.storagePath = finalPath;
      await this.writeMetadata(metadata);
      this.logger.log(`[upload] completed id=${uploadId} bytes=${stat.size} sha256=${sha256}`);
      return metadata;
    } catch (error) {
      output.destroy();
      await fs.rm(temporary, { force: true });
      metadata.errorMessage = error instanceof Error ? error.message : String(error);
      await this.writeMetadata(metadata);
      this.logger.error(`[upload] completion failed id=${uploadId}`, metadata.errorMessage);
      throw error;
    }
  }
}
