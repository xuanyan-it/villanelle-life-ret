import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 32 * 1024 * 1024;
const UPLOAD_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export type LocalUploadState = {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
};

type LocalUploadMetadata = LocalUploadState & {
  owner: string;
  originalFileName: string;
  fileSize: number;
  status: "uploading" | "completed";
};

const safeUploadId = (uploadId: string) => {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    throw new Error("invalid upload id");
  }
  return uploadId;
};

const safeFileName = (fileName: string) => {
  const normalized = path.basename(fileName);
  if (!normalized || path.extname(normalized).toLowerCase() !== ".svs") {
    throw new Error("only .svs files are supported");
  }
  return normalized;
};

export const createLocalUploadStore = (root: string) => {
  const resolvedRoot = path.resolve(root);
  const uploadDir = (uploadId: string) =>
    path.join(resolvedRoot, safeUploadId(uploadId));
  const metadataPath = (uploadId: string) =>
    path.join(uploadDir(uploadId), "upload.json");

  const writeMetadata = async (metadata: LocalUploadMetadata) => {
    const target = metadataPath(metadata.uploadId);
    const temporary = `${target}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(metadata, null, 2), "utf8");
    await fs.rename(temporary, target);
  };

  const readMetadata = async (
    uploadId: string,
    owner: string,
  ): Promise<LocalUploadMetadata> => {
    const metadata = JSON.parse(
      await fs.readFile(metadataPath(uploadId), "utf8"),
    ) as LocalUploadMetadata;
    if (metadata.owner !== owner) {
      throw new Error("upload not found");
    }
    return metadata;
  };

  const toState = (metadata: LocalUploadMetadata): LocalUploadState => ({
    uploadId: metadata.uploadId,
    chunkSize: metadata.chunkSize,
    totalChunks: metadata.totalChunks,
    uploadedChunks: metadata.uploadedChunks,
  });

  return {
    root: resolvedRoot,

    async init(owner: string, fileName: string, fileSize: number) {
      const originalFileName = safeFileName(fileName);
      if (
        !Number.isSafeInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > MAX_FILE_SIZE
      ) {
        throw new Error("file size must be between 1 byte and 2 GB");
      }
      const uploadId = randomUUID();
      const metadata: LocalUploadMetadata = {
        uploadId,
        owner,
        originalFileName,
        fileSize,
        chunkSize: DEFAULT_CHUNK_SIZE,
        totalChunks: Math.ceil(fileSize / DEFAULT_CHUNK_SIZE),
        uploadedChunks: [],
        status: "uploading",
      };
      await fs.mkdir(path.join(uploadDir(uploadId), "chunks"), {
        recursive: true,
      });
      await writeMetadata(metadata);
      return toState(metadata);
    },

    async status(
      owner: string,
      uploadId: string,
    ): Promise<LocalUploadState | null> {
      try {
        return toState(await readMetadata(uploadId, owner));
      } catch {
        return null;
      }
    },

    async writeChunk(
      owner: string,
      uploadId: string,
      index: number,
      bytes: Uint8Array,
    ) {
      const metadata = await readMetadata(uploadId, owner);
      if (
        metadata.status !== "uploading" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= metadata.totalChunks
      ) {
        throw new Error("invalid upload chunk");
      }
      const expectedSize =
        index === metadata.totalChunks - 1
          ? metadata.fileSize - index * metadata.chunkSize
          : metadata.chunkSize;
      if (bytes.byteLength !== expectedSize) {
        throw new Error("invalid chunk size");
      }

      const target = path.join(uploadDir(uploadId), "chunks", `${index}.part`);
      const temporary = `${target}.tmp`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, target);
      if (!metadata.uploadedChunks.includes(index)) {
        metadata.uploadedChunks.push(index);
        metadata.uploadedChunks.sort((a, b) => a - b);
        await writeMetadata(metadata);
      }
    },

    async complete(owner: string, uploadId: string) {
      const metadata = await readMetadata(uploadId, owner);
      // Idempotent: if already assembled, verify the final file exists and
      // return.  The chunks/ dir was deleted on the first completion, so a
      // second call (e.g. resume/re-upload of the same file) must NOT try to
      // re-read chunks — that would throw ENOENT.
      if (metadata.status === "completed") {
        const finalPath = path.join(
          uploadDir(uploadId),
          "input",
          metadata.originalFileName,
        );
        await fs.access(finalPath);
        return;
      }
      if (metadata.uploadedChunks.length !== metadata.totalChunks) {
        throw new Error("upload is incomplete");
      }

      const inputDir = path.join(uploadDir(uploadId), "input");
      const temporary = path.join(uploadDir(uploadId), "assembled.tmp");
      const finalPath = path.join(inputDir, metadata.originalFileName);
      await fs.mkdir(inputDir, { recursive: true });
      const output = createWriteStream(temporary, { flags: "w" });
      try {
        for (let index = 0; index < metadata.totalChunks; index += 1) {
          const input = createReadStream(
            path.join(uploadDir(uploadId), "chunks", `${index}.part`),
          );
          for await (const chunk of input) {
            if (!output.write(chunk)) {
              await new Promise<void>((resolve) =>
                output.once("drain", resolve),
              );
            }
          }
        }
        await new Promise<void>((resolve, reject) =>
          output.end((error?: Error | null) =>
            error ? reject(error) : resolve(),
          ),
        );
        const stat = await fs.stat(temporary);
        if (stat.size !== metadata.fileSize) {
          throw new Error("assembled file size mismatch");
        }
        await fs.rename(temporary, finalPath);
        await fs.rm(path.join(uploadDir(uploadId), "chunks"), {
          recursive: true,
          force: true,
        });
        metadata.status = "completed";
        await writeMetadata(metadata);
      } catch (error) {
        output.destroy();
        await fs.rm(temporary, { force: true });
        throw error;
      }
    },

    async slidePath(owner: string, uploadId: string, fileName: string) {
      const metadata = await readMetadata(uploadId, owner);
      const normalized = safeFileName(fileName);
      if (
        metadata.status !== "completed" ||
        normalized !== metadata.originalFileName
      ) {
        throw new Error("uploaded slide not found");
      }
      const result = path.join(uploadDir(uploadId), "input", normalized);
      await fs.access(result);
      return result;
    },

    /** Get the slide file path from uploadId alone (reads metadata for fileName). */
    async slidePathByUploadId(owner: string, uploadId: string): Promise<string> {
      const metadata = await readMetadata(uploadId, owner);
      if (metadata.status !== "completed") {
        throw new Error("upload not completed");
      }
      const result = path.join(uploadDir(uploadId), "input", metadata.originalFileName);
      await fs.access(result);
      return result;
    },

    /**
     * Get slide path without owner verification — for internal protocol handlers.
     * Only use in trusted, app-internal contexts (e.g. slide:// protocol).
     */
    async getSlidePath(uploadId: string): Promise<string> {
      const raw = JSON.parse(
        await fs.readFile(metadataPath(uploadId), "utf8"),
      ) as LocalUploadMetadata;
      if (raw.status !== "completed") {
        throw new Error("upload not completed");
      }
      const result = path.join(uploadDir(uploadId), "input", raw.originalFileName);
      await fs.access(result);
      return result;
    },

    async heatmapDataUrl(owner: string, uploadId: string) {
      await readMetadata(uploadId, owner);
      try {
        const content = await fs.readFile(
          path.join(uploadDir(uploadId), "output", "heatmap.png"),
        );
        return `data:image/png;base64,${content.toString("base64")}`;
      } catch {
        return null;
      }
    },

    async slidePreviewDataUrl(owner: string, uploadId: string) {
      await readMetadata(uploadId, owner);
      try {
        const content = await fs.readFile(
          path.join(uploadDir(uploadId), "output", "slide_preview.png"),
        );
        return `data:image/png;base64,${content.toString("base64")}`;
      } catch {
        return null;
      }
    },
  };
};

export type LocalUploadStore = ReturnType<typeof createLocalUploadStore>;
