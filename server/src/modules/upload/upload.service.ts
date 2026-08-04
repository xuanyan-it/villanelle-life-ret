import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";

import { createSanitizedLogger } from "../../common/logging/sanitized-logger";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 32 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".svs"]);

/** Resolve the monorepo project root, whether started from root or server/. */
const resolveProjectRoot = (): string =>
  existsSync(path.join(process.cwd(), "assets"))
    ? process.cwd()
    : path.resolve(process.cwd(), "..");

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

  // ── Persistent tile worker pool ────────────────────────────────
  // Keeps one Python process per slide path alive to avoid ~300ms
  // spawn overhead on every tile request.
  private readonly tileWorkers = new Map<
    string,
    { proc: ChildProcessWithoutNullStreams; rl: readline.Interface; busy: boolean }
  >();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const projectRoot = resolveProjectRoot();
    this.root = path.resolve(
      this.configService.get<string>("UPLOAD_ROOT") ??
        path.join(projectRoot, "data", "uploads"),
    );
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

  async slidePreviewPath(uploadId: string, owner: string): Promise<string | null> {
    await this.readMetadata(uploadId, owner);
    const previewPath = path.join(this.uploadDir(uploadId), "output", "slide_preview.png");
    try {
      await fs.access(previewPath);
      return previewPath;
    } catch {
      return null;
    }
  }

  async slideFilePath(uploadId: string, owner: string): Promise<string | null> {
    const metadata = await this.readMetadata(uploadId, owner);
    if (metadata.storagePath && metadata.status === "completed") {
      try {
        await fs.access(metadata.storagePath);
        return metadata.storagePath;
      } catch {
        return null;
      }
    }
    // Fallback: try input/{originalFileName}
    const fallback = path.join(this.uploadDir(uploadId), "input", metadata.originalFileName);
    try {
      await fs.access(fallback);
      return fallback;
    } catch {
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

  async extractTile(
    response: Response,
    slidePath: string,
    opts: { level: number; x: number; y: number; tileWidth: number; tileHeight: number; downsample?: number; full?: boolean; targetW?: number },
  ): Promise<void> {
    const projectRoot = resolveProjectRoot();
    const extractScript = path.join(
      this.configService.get<string>("PYTHON_SCRIPTS_ROOT") ??
        path.join(projectRoot, "assets", "models"),
      "extract_tile.py",
    );

    const pythonBin =
      this.configService.get<string>("PYTHON_BIN") ??
      path.join(projectRoot, "assets", "models", "venv-LMN-1.0", "Scripts", "python.exe");

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonBin, [extractScript, slidePath], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });

      const input = JSON.stringify({
        level: opts.level,
        x: opts.x,
        y: opts.y,
        tileWidth: opts.tileWidth,
        tileHeight: opts.tileHeight,
        downsample: opts.downsample ?? 0,
        full: opts.full ?? false,
        targetW: opts.targetW ?? 0,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });

      proc.on("error", (error) => {
        this.logger.error(`[tile] failed to spawn extract_tile.py`, error.message);
        if (!response.writableEnded) {
          response.status(500).json({ error: "tile extraction failed" });
        }
        reject(error);
      });

      proc.on("close", (code) => {
        if (code !== 0 || stderr) {
          this.logger.error(`[tile] extract_tile.py exited code=${code} stderr=${stderr}`);
          if (!response.writableEnded) {
            response.status(500).json({ error: "tile extraction failed" });
          }
          reject(new Error(stderr || `exit code ${code}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.ok) {
            const tileBuf = Buffer.from(result.tile, "base64");
            response.setHeader("Content-Type", "image/png");
            response.setHeader("Cache-Control", "public, max-age=86400");
            response.send(tileBuf);
            resolve();
          } else {
            this.logger.error(`[tile] extract_tile.py error: ${result.error}`);
            if (!response.writableEnded) {
              response.status(500).json({ error: result.error ?? "tile extraction failed" });
            }
            reject(new Error(result.error));
          }
        } catch {
          this.logger.error(`[tile] failed to parse extract_tile.py output: ${stdout.slice(0, 200)}`);
          if (!response.writableEnded) {
            response.status(500).json({ error: "tile extraction failed" });
          }
          reject(new Error("invalid tile response"));
        }
      });

      proc.stdin.write(input);
      proc.stdin.end();
    });
  }

  async slideInfo(slidePath: string): Promise<{
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    levels: number;
    levelDimensions: Array<{ width: number; height: number }>;
    levelDownsamples: number[];
  }> {
    const projectRoot = resolveProjectRoot();
    const pythonBin =
      this.configService.get<string>("PYTHON_BIN") ??
      path.join(projectRoot, "assets", "models", "venv-LMN-1.0", "Scripts", "python.exe");

    // Resolve the OpenSlide bin directory for DLL loading
    const openslideBin = path.join(projectRoot, "assets", "openslide", "bin");

    const code = `
import json, sys, os
os.environ["PATH"] = ${JSON.stringify(openslideBin)} + os.pathsep + os.environ.get("PATH", "")
if hasattr(os, "add_dll_directory"):
    os.add_dll_directory(${JSON.stringify(openslideBin)})
import openslide
slide = openslide.OpenSlide(sys.argv[1])
dims = slide.level_dimensions
downs = slide.level_downsamples
info = {
    "width": slide.dimensions[0],
    "height": slide.dimensions[1],
    "tileWidth": int(slide.properties.get("openslide.level[0].tile-width", 256)),
    "tileHeight": int(slide.properties.get("openslide.level[0].tile-height", 256)),
    "levels": slide.level_count,
    "levelDimensions": [{"width": w, "height": h} for w, h in dims],
    "levelDownsamples": [float(d) for d in downs],
}
slide.close()
print(json.dumps(info))
`;

    return new Promise((resolve, reject) => {
      const proc = spawn(pythonBin, ["-c", code, slidePath], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf-8"); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf-8"); });

      proc.on("close", (code) => {
        if (code !== 0) {
          this.logger.error(`[slideInfo] python exited code=${code} stderr=${stderr}`);
          reject(new Error(stderr || `exit code ${code}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (err) {
          reject(new Error(`failed to parse slide info: ${stdout.slice(0, 200)}`));
        }
      });

      proc.on("error", (error) => {
        reject(error);
      });
    });
  }

  // ── IIIF Image API 2.0 ───────────────────────────────────────────

  async iiifInfo(
    slidePath: string,
    uploadId: string,
    _request: Request,
  ): Promise<Record<string, unknown>> {
    const raw = await this.slideInfo(slidePath);
    const level0 = raw.levelDimensions[0]!;

    // Fixed scale factors matching svs-master exactly: [1, 4, 16, 64, 256, 1024]
    // Filter to only those that fit within the slide dimensions.
    const allFactors = [1, 4, 16, 64, 256, 1024];
    const maxDim = Math.max(level0.width, level0.height);
    const tileSize = raw.tileWidth || 256;
    const scaleFactors = allFactors.filter((s) => s * tileSize <= maxDim * 1.1);
    if (scaleFactors.length === 0) scaleFactors.push(1);

    return {
      "@context": "http://iiif.io/api/image/2/context.json",
      "@id": `/api/uploads/${uploadId}/iiif`,
      protocol: "http://iiif.io/api/image",
      width: level0.width,
      height: level0.height,
      tiles: [
        {
          width: raw.tileWidth,
          scaleFactors,
        },
      ],
      profile: ["http://iiif.io/api/image/2/level2.json"],
    };
  }

  async extractIiiifTile(
    response: Response,
    slidePath: string,
    region: string,
    size: string,
    _rotation: string,
  ): Promise<void> {
    // Handle IIIF "full" (thumbnail) request — read the entire slide
    if (region === "full") {
      return this.extractTile(response, slidePath, {
        level: 0, x: 0, y: 0, tileWidth: 0, tileHeight: 0, downsample: 0, full: true,
        targetW: size !== "full" ? parseInt(size.split(",")[0] || "256", 10) : 256,
      } as any);
    }

    const regionParts = region.split(",").map(Number);
    if (regionParts.length !== 4 || regionParts.some(isNaN)) {
      response.status(400).json({ error: "invalid region: expected x,y,w,h" });
      return;
    }
    const [rx, ry, rw, rh] = regionParts as [
      number,
      number,
      number,
      number,
    ];

    let targetW = rw;
    let targetH = rh;
    if (size !== "full") {
      const sizeParts = size.split(",");
      const sw = sizeParts[0] !== "" ? Number(sizeParts[0]) : NaN;
      const sh = sizeParts[1] !== undefined && sizeParts[1] !== "" ? Number(sizeParts[1]) : NaN;
      if (!isNaN(sw) && !isNaN(sh)) {
        targetW = sw;
        targetH = sh;
      } else if (!isNaN(sw)) {
        targetW = sw;
        targetH = Math.round(rh * (sw / rw));
      } else if (!isNaN(sh)) {
        targetH = sh;
        targetW = Math.round(rw * (sh / rh));
      }
    }

    const downsample = targetW > 0 ? rw / targetW : 1;

    return this.extractTile(response, slidePath, {
      level: 0,
      x: rx,
      y: ry,
      tileWidth: rw,
      tileHeight: rh,
      downsample,
    });
    return this.extractTile(response, slidePath, {
      level: 0,
      x: rx,
      y: ry,
      tileWidth: rw,
      tileHeight: rh,
      downsample,
    });
  }

  async complete(uploadId: string, owner: string, expectedSha256?: string) {
    const metadata = await this.readMetadata(uploadId, owner);
    if (metadata.uploadedChunks.length !== metadata.totalChunks) {
      throw new BadRequestException("upload is incomplete");
    }
    // Idempotent: if already completed and file exists, return early
    const finalDir = path.join(this.uploadDir(uploadId), "input");
    const finalPath = path.join(finalDir, metadata.originalFileName);
    if (metadata.status === "completed" && metadata.storagePath) {
      try {
        await fs.access(metadata.storagePath);
        this.logger.log(`[upload] already completed id=${uploadId}`);
        return metadata;
      } catch { /* file missing — re-assemble below */ }
    }
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
