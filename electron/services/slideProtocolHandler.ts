/**
 * slide:// protocol handler — serves SVS tiles to OpenSeadragon via IPC.
 *
 * URL format:
 *   slide://tile/{uploadId}/{level}/{x0}_{y0}.png?tw={tileWidth}&th={tileHeight}
 *
 * {x0},{y0} are LEVEL-0 pixel coordinates (matching the Web IIIF path and the
 * worker's read_region contract).  On each request, the handler looks up the
 * slide path from localUploadStore, calls the Python worker to extract the
 * tile, and returns the PNG.
 */

import { protocol } from "electron";
import type { LocalUploadStore } from "./localUploadStore";
import type { WorkerManager } from "./workerManager";

export function registerSlideProtocolHandler(
  localUploadStore: LocalUploadStore,
  workerManager: WorkerManager,
) {
  protocol.handle("slide", async (request) => {
    try {
      const url = new URL(request.url);

      // URL: slide://tile/{uploadId}/{level}/{x}_{y}.png
      //       ↑ hostname ↑  ←── pathname ──→
      if (url.hostname !== "tile") {
        return new Response("Invalid slide URL", { status: 400 });
      }

      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts.length < 3) {
        return new Response("Invalid slide URL", { status: 400 });
      }

      const uploadId = pathParts[0];
      if (!uploadId) {
        return new Response("Missing uploadId", { status: 400 });
      }

      const level = parseInt(pathParts[1] ?? "", 10);
      const fileName = pathParts[2];
      if (!fileName) {
        return new Response("Missing tile coords", { status: 400 });
      }

      const [xStr, yStr] = fileName.replace(/\.png$/i, "").split("_");
      const x = parseInt(xStr ?? "", 10);
      const y = parseInt(yStr ?? "", 10);
      const tileWidth = parseInt(
        url.searchParams.get("tw") || "256",
        10,
      );
      const tileHeight = parseInt(
        url.searchParams.get("th") || "256",
        10,
      );
      // IIIF scale factor (target) and the real level's downsample — used by
      // the worker to downscale when the real level differs from the factor.
      const scaleFactor = parseFloat(url.searchParams.get("sf") || "0");
      const realDownsample = parseFloat(url.searchParams.get("ds") || "0");

      if (
        !uploadId ||
        isNaN(level) || isNaN(x) || isNaN(y) ||
        isNaN(tileWidth) || isNaN(tileHeight)
      ) {
        return new Response("Invalid tile parameters", { status: 400 });
      }

      const slidePath = await localUploadStore.getSlidePath(uploadId);

      const result = await workerManager.request(
        {
          slidePath,
          level,
          x,
          y,
          tileWidth,
          tileHeight,
          scaleFactor,
          realDownsample,
        },
        undefined,
        "extract-tile",
      );

      // result is already the raw PNG (binary frame protocol)
      const buf = Buffer.isBuffer(result)
        ? result
        : Buffer.from(String(result), "base64");
      return new Response(buf as unknown as BodyInit, {
        headers: { "Content-Type": "image/png" },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      // Suppress noisy logs for missing tiles (OSD probes many tiles)
      if (
        !message.includes("ENOENT") &&
        !message.includes("not found")
      ) {
        console.error("[slideProtocol]", message);
      }
      return new Response(null, { status: 404 });
    }
  });
}
