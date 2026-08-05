import type { IpcContext } from "./context";
import { createIpcHandlerFactory } from "./handlerFactory";

const ownerOf = (context: IpcContext) => {
  context.authSession.requireAuthenticated();
  const principal = context.authSession.getPrincipal();
  if (!principal) {
    throw new Error("unauthorized");
  }
  return principal.username;
};

export const registerUploadHandlers = (context: IpcContext) => {
  const { registerRaw } = createIpcHandlerFactory(context);
  const store = context.localUploadStore;

  registerRaw(
    "uploadInit",
    { requireAuth: true },
    async (payload: { fileName: string; fileSize: number }) =>
      store.init(ownerOf(context), payload.fileName, payload.fileSize),
  );

  registerRaw(
    "uploadStatus",
    { requireAuth: true },
    async (payload: { uploadId: string }) =>
      store.status(ownerOf(context), payload.uploadId),
  );

  registerRaw(
    "uploadChunk",
    { requireAuth: true },
    async (payload: {
      uploadId: string;
      index: number;
      bytes: Uint8Array;
    }) => {
      const bytes =
        payload.bytes instanceof Uint8Array
          ? payload.bytes
          : new Uint8Array(payload.bytes);
      await store.writeChunk(
        ownerOf(context),
        payload.uploadId,
        payload.index,
        bytes,
      );
    },
  );

  registerRaw(
    "uploadComplete",
    { requireAuth: true },
    async (payload: { uploadId: string }) =>
      store.complete(ownerOf(context), payload.uploadId),
  );

  registerRaw(
    "uploadHeatmap",
    { requireAuth: true },
    async (payload: { uploadId: string }) =>
      store.heatmapDataUrl(ownerOf(context), payload.uploadId),
  );

  registerRaw(
    "uploadSlidePreview",
    { requireAuth: true },
    async (payload: { uploadId: string }) =>
      store.slidePreviewDataUrl(ownerOf(context), payload.uploadId),
  );

  registerRaw(
    "uploadGetTile",
    { requireAuth: true },
    async (payload: {
      uploadId: string;
      level: number;
      x: number;
      y: number;
      tileWidth?: number;
      tileHeight?: number;
    }) => {
      const owner = ownerOf(context);
      const slidePath = await store.slidePathByUploadId(owner, payload.uploadId);
      const result = await context.workerManager.request(
        {
          slidePath,
          level: payload.level,
          x: payload.x,
          y: payload.y,
          tileWidth: payload.tileWidth ?? 256,
          tileHeight: payload.tileHeight ?? 256,
        },
        undefined,
        "extract-tile",
      );
      // result is the raw PNG tile (binary frame protocol)
      const buf = Buffer.isBuffer(result)
        ? result
        : Buffer.from(String(result), "base64");
      return `data:image/png;base64,${buf.toString("base64")}`;
    },
  );

  registerRaw(
    "uploadSlideInfo",
    { requireAuth: true },
    async (payload: { uploadId: string }) => {
      const owner = ownerOf(context);
      const slidePath = await store.slidePathByUploadId(owner, payload.uploadId);
      const result = await context.workerManager.request(
        { slidePath },
        undefined,
        "slide-info",
      );
      return JSON.parse(String(result));
    },
  );
};
