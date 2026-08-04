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

// ── Electron IPC tile fetcher ───────────────────────────────────────

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

