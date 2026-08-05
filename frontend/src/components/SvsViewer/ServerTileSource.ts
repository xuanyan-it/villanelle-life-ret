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

// ── Electron slide:// protocol tile source ────────────────────────────

/**
 * Build a tile source that fetches tiles via the Electron `slide://` protocol.
 *
 * Aligned with the Web IIIF path (SvsViewer.tsx web branch):
 *   - `getLevelScale` uses the real OpenSlide downsample factors instead of
 *     OSD's default power-of-2 assumption (SVS pyramids are usually 1/4/16/64).
 *   - `getTileUrl` converts OSD tile indices → level-0 pixel coordinates,
 *     matching how the IIIF TileSource computes regions for read_region().
 *
 * The `slide://` protocol is handled by the main process, which calls the
 * Python worker to extract tiles.  The URL format is:
 *   slide://tile/{uploadId}/{level}/{x0}_{y0}.png?tw={tileWidth}&th={tileHeight}
 * where {x0},{y0} are LEVEL-0 pixel coordinates (worker read_region contract).
 */
export function buildElectronTileSource(
  info: SlideInfo,
  uploadId: string,
): Record<string, unknown> {
  const level0 = info.levelDimensions[0]!;

  const getLevelScale = (level: number): number =>
    1 / (info.levelDownsamples[level] ?? Math.pow(2, level));

  return {
    width: level0.width,
    height: level0.height,
    tileWidth: info.tileWidth,
    tileHeight: info.tileHeight,
    tileOverlap: 0,
    minLevel: 0,
    maxLevel: info.levels - 1,
    getLevelScale,
    getTileUrl(level: number, x: number, y: number): string {
      // OSD passes tile indices (column/row).  The worker's read_region
      // takes level-0 pixel coords, so scale like the IIIF path does.
      const scale = getLevelScale(level);
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

