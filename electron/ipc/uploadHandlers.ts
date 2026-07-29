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
};
