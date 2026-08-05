/**
 * SVS Viewer — renders whole slide images via OpenSeadragon + IIIF.
 *
 * Fully aligned with svs-master/boxv2:
 *   - IIIF Image API 2.0 tile source (OSD computes pixel coords → correct tiles)
 *   - prefixUrl for navigation icons
 *   - immediateRender: false (wait for tiles to load)
 *   - imageLoaderLimit: 5, timeout: 180s
 *
 * Server endpoints:
 *   GET /api/uploads/:uploadId/iiif/info.json
 *   GET /api/uploads/:uploadId/iiif/{x},{y},{w},{h}/{size}/{rotation}/default.jpg
 */

import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import OpenSeadragon from "openseadragon";

import { Switch } from "antd";

import styles from "./SvsViewer.module.css";
import { isElectronRuntime } from "../../platform/runtime";
import {
  buildWebTileSource,
  buildNativeTileSource,
  type ElectronTileMode,
  type SlideInfo,
} from "./ServerTileSource";

// ── Types ───────────────────────────────────────────────────────────

export interface SvsViewerHandle {
  zoomToFit(): void;
  getViewer(): OpenSeadragon.Viewer | null;
}

export interface SvsViewerProps {
  uploadId: string | null;
  apiBase?: string;
  /** OpenSeadragon prefixUrl for nav icons (default: /openseadragon/images/) */
  prefixUrl?: string;
  onReady?: () => void;
  onError?: (message: string) => void;
  className?: string;
}

interface IiifInfo {
  "@context": string;
  "@id": string;
  protocol: string;
  width: number;
  height: number;
  tiles: Array<{ width: number; scaleFactors: number[] }>;
  profile: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────

async function fetchIiifInfo(uploadId: string, apiBase: string): Promise<IiifInfo> {
  const url = `${apiBase}/api/uploads/${encodeURIComponent(uploadId)}/iiif/info.json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`获取切片信息失败 (${resp.status}): ${body}`);
  }
  const data = await resp.json();
  if (!data || data.error || !data.width || !data.tiles) {
    throw new Error(data?.error ?? "返回的切片元数据无效");
  }
  return data;
}

// ── Component ───────────────────────────────────────────────────────

export const SvsViewer = forwardRef<SvsViewerHandle, SvsViewerProps>(
  function SvsViewer(
    {
      uploadId,
      apiBase = "",
      // Web: absolute path from public/ (http://host/openseadragon/images/).
      // Electron: file:// cannot resolve absolute paths, so use a relative
      // path from index.html (resources/web/openseadragon/images/).
      prefixUrl = isElectronRuntime()
        ? "./openseadragon/images/"
        : "/openseadragon/images/",
      onReady,
      onError,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
    const disposedRef = useRef(false);

    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

    // ── Tile mode (Electron only): web-style fixed IIIF factors (default)
    // vs native all-pyramid-levels.  Persisted across sessions.
    const TILE_MODE_KEY = "ret-svs-tile-mode";
    const [tileMode, setTileMode] = useState<ElectronTileMode>(() => {
      try {
        return localStorage.getItem(TILE_MODE_KEY) === "native"
          ? "native"
          : "web";
      } catch {
        return "web";
      }
    });
    const handleTileModeChange = (checked: boolean) => {
      const next: ElectronTileMode = checked ? "native" : "web";
      setTileMode(next);
      try {
        localStorage.setItem(TILE_MODE_KEY, next);
      } catch {
        // ignore storage failures
      }
    };

    // ── Cleanup ──────────────────────────────────────────────────

    const destroyViewer = useCallback(() => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    }, []);

    // ── Load slide ───────────────────────────────────────────────

    useEffect(() => {
      if (!uploadId || !containerRef.current) return;

      let active = true;
      disposedRef.current = false;
      setStatus("loading");
      setErrorMessage("");
      setDimensions(null);

      const init = async () => {
        try {
          // ── Electron mode: IIIF deep zoom via slide:// protocol ──
          if (isElectronRuntime()) {
            const electron = (window as any).electronAPI;
            if (!electron?.call) throw new Error("Electron API not available");

            // Slide metadata comes from the Python worker.  If the worker is
            // not ready it will hang in waitForWorkerReady(), so bound the
            // call with a timeout and surface a clear error.
            const WORKER_TIMEOUT_MS = 15000;
            const slideInfo: SlideInfo = await Promise.race([
              electron.call("uploadSlideInfo", { uploadId }),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("worker 未就绪，无法读取切片信息")),
                  WORKER_TIMEOUT_MS,
                ),
              ),
            ]);
            if (!active || disposedRef.current) return;
            console.log("[SvsViewer] Electron slide info:", slideInfo);
            setDimensions({ w: slideInfo.levelDimensions[0].width, h: slideInfo.levelDimensions[0].height });

            // Step 2: build tile source (slide:// protocol serves tiles via IPC → worker)
            const tileSource =
              tileMode === "native"
                ? buildNativeTileSource(slideInfo, uploadId)
                : buildWebTileSource(slideInfo, uploadId);

            // Step 3: create viewer (same config as web mode)
            destroyViewer();
            if (!active || disposedRef.current) return;

            const viewer = OpenSeadragon({
              element: containerRef.current!,
              prefixUrl,
              visibilityRatio: 1,
              minZoomImageRatio: 1,
              imageLoaderLimit: 5,
              timeout: 180 * 1000,
              tileSources: tileSource as any,
              crossOriginPolicy: "Anonymous",
              immediateRender: false,
              showNavigator: true,
              navigatorPosition: "BOTTOM_RIGHT",
              navigatorSizeRatio: 0.18,
              showNavigationControl: true,
              constrainDuringPan: true,
            });
            viewerRef.current = viewer;
            viewer.addHandler("open", () => { if (active && !disposedRef.current) { setStatus("ready"); onReady?.(); } });
            viewer.addHandler("open-failed", () => { if (active && !disposedRef.current) { setStatus("error"); setErrorMessage("无法打开切片预览"); onError?.("open-failed"); } });
            return;
          }

          // ── Web mode: IIIF deep zoom ─────────────────────────
          // Step 1: fetch IIIF info.json
          console.log("[SvsViewer] fetching IIIF info for:", uploadId);
          const iiif = await fetchIiifInfo(uploadId, apiBase);
          if (!active || disposedRef.current) return;
          console.log("[SvsViewer] IIIF info:", iiif);
          setDimensions({ w: iiif.width, h: iiif.height });

          // Step 2: destroy previous viewer
          destroyViewer();
          if (!active || disposedRef.current) return;

          // Step 3: build IIIF tileSource (exact svs-master format)
          // OSD's IIIFTileSource computes proper level-0 pixel coords
          // and puts them in the URL → server's read_region() always correct.
          const tileSource = {
            "@context": iiif["@context"],
            "@id": iiif["@id"],
            width: iiif.width,
            height: iiif.height,
            profile: iiif.profile,
            protocol: iiif.protocol,
            tiles: iiif.tiles,
          };

          // Step 4: create viewer (exact svs-master config)
          const viewer = OpenSeadragon({
            element: containerRef.current!,
            prefixUrl,
            visibilityRatio: 1,
            minZoomImageRatio: 1,
            imageLoaderLimit: 5,
            timeout: 180 * 1000,
            tileSources: tileSource as any,
            crossOriginPolicy: "Anonymous",
            immediateRender: false,
            showNavigator: true,
            navigatorPosition: "BOTTOM_RIGHT",
            navigatorSizeRatio: 0.18,
            showNavigationControl: true,
            constrainDuringPan: true,
          });

          viewerRef.current = viewer;

          viewer.addHandler("open", () => {
            console.log("[SvsViewer] viewer 'open' fired");
            if (active && !disposedRef.current) {
              setStatus("ready");
              onReady?.();
            }
          });

          viewer.addHandler("open-failed", () => {
            console.error("[SvsViewer] viewer 'open-failed'");
            if (active && !disposedRef.current) {
              setStatus("error");
              setErrorMessage("OpenSeadragon 无法打开此切片图像");
              onError?.("open-failed");
            }
          });

          viewer.addHandler("tile-load-failed", (evt: unknown) => {
            console.warn("[SvsViewer] tile-load-failed:", evt);
          });
        } catch (cause) {
          console.error("[SvsViewer] load error:", cause);
          if (active && !disposedRef.current) {
            const msg = cause instanceof Error ? cause.message : String(cause);
            setStatus("error");
            setErrorMessage(msg);
            onError?.(msg);
          }
        }
      };

      void init();

      return () => {
        active = false;
        disposedRef.current = true;
        destroyViewer();
      };
    }, [uploadId, apiBase, prefixUrl, destroyViewer, onReady, onError, tileMode]);

    // ── Cleanup on unmount ───────────────────────────────────────

    useEffect(() => {
      return () => {
        disposedRef.current = true;
        destroyViewer();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Imperative handle ────────────────────────────────────────

    useImperativeHandle(
      ref,
      () => ({
        zoomToFit() {
          viewerRef.current?.viewport.goHome();
        },
        getViewer() {
          return viewerRef.current;
        },
      }),
      [],
    );

    // ── Render ───────────────────────────────────────────────────

    const isLoading = status === "loading";

    return (
      <div className={`${styles.container} ${className ?? ""}`}>
        {isLoading && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
            <span className={styles.overlayText}>正在加载切片预览…</span>
            {dimensions && (
              <span className={styles.overlayText}>
                {dimensions.w} × {dimensions.h}
              </span>
            )}
          </div>
        )}

        {status === "error" && (
          <div className={styles.overlay}>
            <span className={styles.errorText}>预览加载失败：{errorMessage}</span>
          </div>
        )}

        {status === "idle" && !uploadId && (
          <div className={styles.overlay}>
            <span className={styles.overlayText}>请先上传 SVS 文件</span>
          </div>
        )}

        {/* Tile mode toggle — Electron only.  Off (default) = web-style
            fixed IIIF factors; on = all native pyramid levels (finer). */}
        {isElectronRuntime() && uploadId && (
          <div className={styles.modeToggle} title="高细节：使用全部原生金字塔层级（更细、瓦片更多）">
            <span>高细节</span>
            <Switch
              size="small"
              checked={tileMode === "native"}
              onChange={handleTileModeChange}
            />
          </div>
        )}

        <div ref={containerRef} className={styles.viewer} />
      </div>
    );
  },
);

export default SvsViewer;
