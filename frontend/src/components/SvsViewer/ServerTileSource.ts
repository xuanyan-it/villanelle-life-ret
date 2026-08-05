/**
 * ServerTileSource — utility helpers for server-side SVS tile serving.
 *
 * The tile endpoint follows the DZI URL pattern:
 *   GET /api/uploads/:uploadId/tiles/:level/:x_y.png?tileWidth=...&tileHeight=...
 *
 * Slide metadata endpoint:
 *   GET /api/uploads/:uploadId/slide-info
 *
 * These utilities are consumed by SvsViewer.tsx.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface SlideInfo {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  levels: number;
  levelDimensions: Array<{ width: number; height: number }>;
  levelDownsamples: number[];
}

/** Async function that returns a PNG tile as a Blob (for Electron IPC mode). */
export type TileFetcher = (
  level: number,
  x: number,
  y: number,
) => Promise<Blob>;

// ── Slide info ──────────────────────────────────────────────────────

export async function fetchSlideInfo(
  uploadId: string,
  apiBase: string,
): Promise<SlideInfo> {
  const url = `${apiBase}/api/uploads/${encodeURIComponent(uploadId)}/slide-info`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`获取切片信息失败 (${resp.status}): ${body}`);
  }
  return resp.json();
}

// ── Tile URL builder ────────────────────────────────────────────────

export function buildTileUrl(
  uploadId: string,
  apiBase: string,
  level: number,
  x: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
): string {
  return (
    `${apiBase}/api/uploads/${encodeURIComponent(uploadId)}/tiles/` +
    `${level}/${x}_${y}.png` +
    `?tileWidth=${tileWidth}&tileHeight=${tileHeight}`
  );
}

// ── OpenSeadragon custom tile source ────────────────────────────────

/**
 * Build an OpenSeadragon "custom" tile source config object.
 *
 * OpenSeadragon recognises `{ width, height, tileWidth, tileHeight,
 * getTileUrl }` as a custom tile source (no DZI XML needed).
 * See: OpenSeadragon.getTileSourceImplementation()
 */
export function buildCustomTileSource(
  info: SlideInfo,
  uploadId: string,
  apiBase: string,
): Record<string, unknown> {
  const level0 = info.levelDimensions[0]!;
  const baseUrl = `${apiBase}/api/uploads/${encodeURIComponent(uploadId)}/tiles/`;
  const suffix = `?tileWidth=${info.tileWidth}&tileHeight=${info.tileHeight}`;

  return {
    width: level0.width,
    height: level0.height,
    tileWidth: info.tileWidth,
    tileHeight: info.tileHeight,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: info.levels - 1,
    getTileUrl(level: number, x: number, y: number): string {
      return `${baseUrl}${level}/${x}_${y}.png${suffix}`;
    },
  };
}

// ── Electron slide:// protocol tile sources ────────────────────────────

export type ElectronTileMode = "web" | "native";

/**
 * Web-style tile source — fixed IIIF scale factors [1, 4, 16, 64, 256, 1024]
 * filtered to the slide size, exactly matching the server's iiifInfo.  Fewer,
 * coarser tiles → same tile count as Web.  Each IIIF level is served from the
 * real SVS level whose downsample is closest, with sf/ds so the worker can
 * downscale when they differ.  URL format:
 *   slide://tile/{uploadId}/{realLevel}/{x0}_{y0}.png
 *     ?tw={tileWidth}&th={tileHeight}&sf={factor}&ds={realDownsample}
 */
export function buildWebTileSource(
  info: SlideInfo,
  uploadId: string,
): Record<string, unknown> {
  const level0 = info.levelDimensions[0]!;

  const allFactors = [1, 4, 16, 64, 256, 1024];
  const maxDim = Math.max(level0.width, level0.height);
  const tileSize = info.tileWidth || 256;
  const scaleFactors = allFactors.filter(
    (s) => s * tileSize <= maxDim * 1.1,
  );
  if (scaleFactors.length === 0) {
    scaleFactors.push(1);
  }

  // Map each IIIF level to the real SVS level with the closest downsample.
  const realLevels = scaleFactors.map((factor) => {
    let best = 0;
    let bestDiff = Infinity;
    info.levelDownsamples.forEach((downsample, index) => {
      const diff = Math.abs(downsample - factor);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = index;
      }
    });
    return best;
  });
  const realDownsamples = scaleFactors.map(
    (factor, index) => info.levelDownsamples[realLevels[index]] ?? factor,
  );

  return {
    width: level0.width,
    height: level0.height,
    tileWidth: info.tileWidth,
    tileHeight: info.tileHeight,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: scaleFactors.length - 1,
    getLevelScale: (level: number): number =>
      1 / (scaleFactors[level] ?? Math.pow(2, level)),
    getTileUrl(level: number, x: number, y: number): string {
      const factor = scaleFactors[level] ?? Math.pow(2, level);
      const x0 = Math.round(x * info.tileWidth * factor);
      const y0 = Math.round(y * info.tileHeight * factor);
      return (
        `slide://tile/${encodeURIComponent(uploadId)}/` +
        `${realLevels[level]}/${x0}_${y0}.png` +
        `?tw=${info.tileWidth}&th=${info.tileHeight}` +
        `&sf=${factor}&ds=${realDownsamples[level]}`
      );
    },
  };
}

/**
 * Native tile source — exposes every real SVS pyramid level
 * (getLevelScale = 1/downsample).  Finest possible zoom detail, but requests
 * more tiles than web at the same zoom (includes 2x/8x/32x … levels).
 */
export function buildNativeTileSource(
  info: SlideInfo,
  uploadId: string,
): Record<string, unknown> {
  const level0 = info.levelDimensions[0]!;

  return {
    width: level0.width,
    height: level0.height,
    tileWidth: info.tileWidth,
    tileHeight: info.tileHeight,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: info.levels - 1,
    getLevelScale: (level: number): number =>
      1 / (info.levelDownsamples[level] ?? Math.pow(2, level)),
    getTileUrl(level: number, x: number, y: number): string {
      const scale = 1 / (info.levelDownsamples[level] ?? Math.pow(2, level));
      const x0 = Math.round((x * info.tileWidth) / scale);
      const y0 = Math.round((y * info.tileHeight) / scale);
      return (
        `slide://tile/${encodeURIComponent(uploadId)}/` +
        `${level}/${x0}_${y0}.png` +
        `?tw=${info.tileWidth}&th=${info.tileHeight}`
      );
    },
  };
}

/**
 * Create a tile fetcher that uses Electron IPC to get tiles.
 *
 * Expects `window.electronAPI.call("uploadGetTile", { ... })` to return
 * a `data:image/png;base64,...` string.
 */
export function createElectronTileFetcher(uploadId: string): TileFetcher {
  return async (level: number, x: number, y: number): Promise<Blob> => {
    const win = window as any;
    if (!win.electronAPI?.call) {
      throw new Error("Electron API not available");
    }
    const dataUrl: string = await win.electronAPI.call("uploadGetTile", {
      uploadId,
      level,
      x,
      y,
    });
    const resp = await fetch(dataUrl);
    return resp.blob();
  };
}

