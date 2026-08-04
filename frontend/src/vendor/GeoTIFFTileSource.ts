// Adapted from https://github.com/episphere/GeoTIFFTileSource-JPEG2k
// Changes:
//   - CDN imports replaced with npm `geotiff`
//   - Added TypeScript types
//   - Attached to OpenSeadragon instance
//   - JPEG-2000 decoder baseURL configurable for offline use

import { fromBlob, fromUrl, Pool, globals } from "geotiff";
import OpenSeadragon from "openseadragon";

// ─── JPEG-2000 decoder support (offline-first) ────────────────────────
// This app runs fully offline.  Standard JPEG-compressed SVS files work
// out of the box via geotiff's built-in decoders (no network needed).
//
// JPEG-2000 (.jp2k) encoded slides require an extra decoder WASM bundle.
// To enable offline JPEG-2000 support:
//   1. Download the decoders/ folder from:
//        https://github.com/episphere/imagebox3/tree/main/decoders
//   2. Place it in your Electron app's resources or public/ folder.
//   3. Before mounting any SvsViewer, set:
//        window.__SVS_DECODER_BASE_URL = "/decoders";
//
// Without this, JPEG-2000 SVS files will show an error instead of the
// slide image.

let supportedDecoders: Record<string, string> = {};

function resolveDecoderBaseUrl(): string | null {
  if (typeof window === "undefined") return null;
  return (window as any).__SVS_DECODER_BASE_URL ?? null;
}

function loadDecoderConfig(baseUrl: string): void {
  if (Object.keys(supportedDecoders).length > 0) return; // already loaded

  fetch(`${baseUrl}/decoders.json`)
    .then((resp) => resp.json())
    .then((decoders: Record<string, string>) => {
      supportedDecoders = decoders;
      console.log(
        "[GeoTIFFTileSource] JPEG-2000 decoders loaded from",
        baseUrl,
      );
    })
    .catch(() => {
      console.warn(
        "[GeoTIFFTileSource] JPEG-2000 decoders not found at",
        baseUrl,
        "— JPEG-2000 SVS files will not render.",
      );
    });
}

// Try to load decoders at init time *only if* the user configured a URL.
(function initDecoders() {
  const base = resolveDecoderBaseUrl();
  if (base) loadDecoderConfig(base);
})();

// Expose for manual re-trigger (e.g. after setting __SVS_DECODER_BASE_URL late)
if (typeof window !== "undefined") {
  (window as any).__SVS_LOAD_DECODERS = function () {
    const base = resolveDecoderBaseUrl();
    if (base) loadDecoderConfig(base);
  };
}

// ─── Types ───────────────────────────────────────────────────────────

export interface GeoTIFFTileSourceOptions {
  logLatency?: boolean | ((msg: string) => void);
  cache?: boolean;
  slideOnly?: boolean;
  pool?: Pool;
  tileWidth?: number;
  tileHeight?: number;
}

export interface GeoTIFFTileSourceInstance {
  destroyPool?: () => void;
}

/** OpenSeadragon augmented with the GeoTIFFTileSource plugin. */
export type OpenSeadragonGeoTIFF = typeof OpenSeadragon & {
  GeoTIFFTileSource: {
    new (
      input: File | string | { GeoTIFF: any; GeoTIFFImages: any[] },
      opts?: GeoTIFFTileSourceOptions,
    ): OpenSeadragon.TileSource & GeoTIFFTileSourceInstance;

    getAllTileSources: (
      input: File | string,
      opts?: GeoTIFFTileSourceOptions,
    ) => Promise<
      (OpenSeadragon.TileSource & GeoTIFFTileSourceInstance)[]
    >;
  };
};

// ─── DeferredPromise ─────────────────────────────────────────────────

function deferredPromise<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ─── Plugin ──────────────────────────────────────────────────────────

(function ($: typeof OpenSeadragon) {
  const OSD = $ as OpenSeadragonGeoTIFF;

  // ── Converters ──────────────────────────────────────────────────

  const Converters = {
    RGBAfromRGB(input: Uint8ClampedArray) {
      const out = new Uint8ClampedArray((input.length * 4) / 3);
      for (let i = 0, j = 0; i < input.length; i += 3, j += 4) {
        out[j] = input[i]!;
        out[j + 1] = input[i + 1]!;
        out[j + 2] = input[i + 2]!;
        out[j + 3] = 255;
      }
      return out;
    },

    RGBAfromWhiteIsZero(input: Uint8ClampedArray, max: number) {
      const out = new Uint8Array(input.length * 4);
      for (let i = 0, j = 0; i < input.length; ++i, j += 4) {
        const value = 256 - (input[i]! / max) * 256;
        out[j] = out[j + 1] = out[j + 2] = value;
        out[j + 3] = 255;
      }
      return new Uint8ClampedArray(out.buffer);
    },

    RGBAfromBlackIsZero(input: Uint8ClampedArray, max: number) {
      const out = new Uint8Array(input.length * 4);
      for (let i = 0, j = 0; i < input.length; ++i, j += 4) {
        const value = (input[i]! / max) * 256;
        out[j] = out[j + 1] = out[j + 2] = value;
        out[j + 3] = 255;
      }
      return new Uint8ClampedArray(out.buffer);
    },

    RGBAfromPalette(input: Uint8ClampedArray, colorMap: number[]) {
      const out = new Uint8Array(input.length * 4);
      const greenOffset = colorMap.length / 3;
      const blueOffset = (colorMap.length / 3) * 2;
      for (let i = 0, j = 0; i < input.length; ++i, j += 4) {
        const mapIndex = input[i]!;
        out[j] = (colorMap[mapIndex]! / 65536) * 256;
        out[j + 1] = (colorMap[mapIndex + greenOffset]! / 65536) * 256;
        out[j + 2] = (colorMap[mapIndex + blueOffset]! / 65536) * 256;
        out[j + 3] = 255;
      }
      return new Uint8ClampedArray(out.buffer);
    },

    RGBAfromCMYK(input: Uint8ClampedArray) {
      const out = new Uint8Array(input.length);
      for (let i = 0, j = 0; i < input.length; i += 4, j += 4) {
        const c = input[i]!,
          m = input[i + 1]!,
          y = input[i + 2]!,
          k = input[i + 3]!;
        out[j] = 255 * ((255 - c) / 256) * ((255 - k) / 256);
        out[j + 1] = 255 * ((255 - m) / 256) * ((255 - k) / 256);
        out[j + 2] = 255 * ((255 - y) / 256) * ((255 - k) / 256);
        out[j + 3] = 255;
      }
      return new Uint8ClampedArray(out.buffer);
    },

    RGBAfromYCbCr(input: Uint8ClampedArray) {
      const out = new Uint8ClampedArray((input.length * 4) / 3);
      for (let i = 0, j = 0; i < input.length; i += 3, j += 4) {
        const y = input[i]!,
          cb = input[i + 1]!,
          cr = input[i + 2]!;
        out[j] = y + 1.402 * (cr - 0x80);
        out[j + 1] = y - 0.34414 * (cb - 0x80) - 0.71414 * (cr - 0x80);
        out[j + 2] = y + 1.772 * (cb - 0x80);
        out[j + 3] = 255;
      }
      return out;
    },

    RGBAfromCIELab(input: Uint8ClampedArray) {
      const Xn = 0.95047,
        Yn = 1.0,
        Zn = 1.08883;
      const out = new Uint8Array((input.length * 4) / 3);
      for (let i = 0, j = 0; i < input.length; i += 3, j += 4) {
        const L = input[i]!;
        const a_ = (input[i + 1]! << 24) >> 24;
        const b_ = (input[i + 2]! << 24) >> 24;
        let y = (L + 16) / 116,
          x = a_ / 500 + y,
          z = y - b_ / 200;
        x = Xn * (x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787);
        y = Yn * (y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787);
        z = Zn * (z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787);
        let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
        let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
        let b = x * 0.0557 + y * -0.204 + z * 1.057;
        r = r > 0.0031308 ? 1.055 * r ** (1 / 2.4) - 0.055 : 12.92 * r;
        g = g > 0.0031308 ? 1.055 * g ** (1 / 2.4) - 0.055 : 12.92 * g;
        b = b > 0.0031308 ? 1.055 * b ** (1 / 2.4) - 0.055 : 12.92 * b;
        out[j] = Math.max(0, Math.min(1, r)) * 255;
        out[j + 1] = Math.max(0, Math.min(1, g)) * 255;
        out[j + 2] = Math.max(0, Math.min(1, b)) * 255;
        out[j + 3] = 255;
      }
      return new Uint8ClampedArray(out.buffer);
    },
  } as const;

  // ── regionToDataUrl ──────────────────────────────────────────────

  function regionToDataUrl(
    this: any,
    level: any,
    x: number,
    y: number,
    src: any,
  ) {
    const startTime = this.options.logLatency && Date.now();
    const abortController = (src.abortController = new AbortController());

    return level.image
      .getTileOrStrip(x, y, null, this._pool, abortController.signal)
      .then((raster: any) => {
        const data = new Uint8ClampedArray(raster.data);
        const canvas = document.createElement("canvas");
        canvas.width = level.tileWidth;
        canvas.height = level.tileHeight;
        const ctx = canvas.getContext("2d")!;

        const pi =
          level.image.fileDirectory.PhotometricInterpretation;
        let arr: Uint8ClampedArray;

        switch (pi) {
          case globals.photometricInterpretations.WhiteIsZero:
            arr = Converters.RGBAfromWhiteIsZero(
              data,
              2 ** level.image.fileDirectory.BitsPerSample[0],
            );
            break;
          case globals.photometricInterpretations.BlackIsZero:
            arr = Converters.RGBAfromBlackIsZero(
              data,
              2 ** level.image.fileDirectory.BitsPerSample[0],
            );
            break;
          case globals.photometricInterpretations.RGB:
            arr = Converters.RGBAfromRGB(data);
            break;
          case globals.photometricInterpretations.Palette:
            arr = Converters.RGBAfromPalette(
              data,
              level.image.fileDirectory.ColorMap,
            );
            break;
          case globals.photometricInterpretations.CMYK:
            arr = Converters.RGBAfromCMYK(data);
            break;
          case globals.photometricInterpretations.YCbCr:
            arr = Converters.RGBAfromYCbCr(data);
            break;
          case globals.photometricInterpretations.CIELab:
            arr = Converters.RGBAfromCIELab(data);
            break;
          default:
            arr = Converters.RGBAfromRGB(data);
        }

        ctx.putImageData(
          new ImageData(arr as Uint8ClampedArray<ArrayBuffer>, canvas.width, canvas.height),
          0,
          0,
        );

        const dataURL = canvas.toDataURL("image/jpeg", 0.8);

        if (this.options.logLatency) {
          (typeof this.options.logLatency === "function"
            ? this.options.logLatency
            : console.log)(
            "Tile latency (ms):",
            Date.now() - (startTime as number),
          );
        }

        return dataURL;
      });
  }

  // ── setupLevels ──────────────────────────────────────────────────

  function setupLevels(this: any) {
    if (this.ready) return;

    const images = this.GeoTIFFImages.sort(
      (a: any, b: any) => b.getWidth() - a.getWidth(),
    );
    console.log("[GeoTIFFTileSource] setupLevels: %d images, largest %dx%d",
      images.length,
      images[0]?.getWidth?.() ?? 0,
      images[0]?.getHeight?.() ?? 0,
    );
    const defaultTw = 256;
    const defaultTh = 256;
    const fullWidth = (this.width = images[0].getWidth());
    const fullHeight = (this.height = images[0].getHeight());
    this.tileOverlap = 0;
    this.minLevel = 0;
    this.aspectRatio = this.width / this.height;
    this.dimensions = new OpenSeadragon.Point(this.width, this.height);

    // Check for valid native pyramid
    const pyramid = images.reduce(
      (acc: any, im: any) => {
        if (acc.width !== -1)
          acc.valid = acc.valid && im.getWidth() < acc.width;
        acc.width = im.getWidth();
        return acc;
      },
      { valid: true, width: -1 },
    );

    if (pyramid.valid) {
      this.levels = images.map((image: any) => ({
        width: image.getWidth(),
        height: image.getHeight(),
        tileWidth:
          this.options.tileWidth || image.getTileWidth() || defaultTw,
        tileHeight:
          this.options.tileHeight || image.getTileHeight() || defaultTh,
        image,
        scalefactor: 1,
      }));
      this.maxLevel = this.levels.length - 1;
    } else {
      // Build levels from tiles
      const numPowers = Math.ceil(
        Math.log2(
          Math.max(fullWidth / defaultTw, fullHeight / defaultTh),
        ),
      );
      const levelsToUse = [...Array(numPowers).keys()].filter(
        (v) => v % 2 === 0,
      );
      this.levels = levelsToUse.map((levelnum) => {
        const scale = Math.pow(2, levelnum);
        const image = images
          .filter((im: any) => im.getWidth() * scale >= fullWidth)
          .slice(-1)[0]!;
        return {
          width: fullWidth / scale,
          height: fullHeight / scale,
          tileWidth:
            this.options.tileWidth || image.getTileWidth() || defaultTw,
          tileHeight:
            this.options.tileHeight || image.getTileHeight() || defaultTh,
          image,
          scalefactor: (scale * image.getWidth()) / fullWidth,
        };
      });
      this.maxLevel = this.levels.length - 1;
    }

    this.levels = this.levels.sort(
      (a: any, b: any) => a.width - b.width,
    );
    this._tileWidth = this.levels[0].tileWidth;
    this._tileHeight = this.levels[0].tileHeight;
    this._setupComplete();
  }

  // ── GeoTIFFTileSource constructor ────────────────────────────────

  function GeoTIFFTileSource(
    this: any,
    input: any,
    opts: GeoTIFFTileSourceOptions = {},
  ) {
    const self = this;
    this.options = opts;

    OpenSeadragon.TileSource.apply(this, [
      { width: 1, height: 1 },
    ] as any);
    this._ready = false;

    const imageCompression =
      input.GeoTIFFImages?.[0]?.fileDirectory?.Compression;

    this.destroyPool = function () {
      this._pool?.destroy?.();
      this._pool = undefined;
    };

    // Instead of geotiff's Pool (which needs Web Workers that are
    // fragile in Vite-bundled environments), use a simple decoder
    // wrapper that calls geotiff's built-in getDecoder() on the
    // main thread.  For JPEG-2000 we still create a custom Worker
    // pool; standard JPEG/LZW/etc go through this fast path.
    if (opts.pool) {
      this._pool = opts.pool;
    } else {
      const decoderBase = resolveDecoderBaseUrl();
      const needsJ2k = decoderBase && supportedDecoders[imageCompression];
      if (needsJ2k) {
        // JPEG-2000: custom worker pool
        const createWorker = () =>
          new Worker(
            URL.createObjectURL(
              new Blob(
                [
                  `importScripts("${decoderBase}/${supportedDecoders[imageCompression]}")`,
                ],
                { type: "application/javascript" },
              ),
            ),
            { name: `gtiff-j2k-${Math.floor(Math.random() * 100000)}` },
          );
        this._pool = new Pool(
          Math.floor(navigator.hardwareConcurrency / 2) || 1,
          createWorker,
        );
        (this._pool as any).supportedCompression = imageCompression;
      } else {
        // Standard compression: main-thread decoder wrapper.
        // geotiff's getTileOrStrip calls poolOrDecoder.decode(slice).
        // We provide an object whose .decode() uses getDecoder().
        // This avoids all Web Worker / Pool / CSP issues entirely.
        const self = this;
        this._pool = {
          decode(slice: any) {
            return Promise.resolve().then(async () => {
              const { getDecoder } = await import("geotiff");
              const decoder = await getDecoder(slice.fileDirectory, undefined as any);
              return decoder.decode(slice);
            });
          },
        };
      }
    }

    this._setupComplete = function () {
      this._ready = true;
      self.raiseEvent("ready", { tileSource: self });
    };

    if (input.GeoTIFF && input.GeoTIFFImages) {
      // Pre-loaded data
      this.promises = {
        GeoTIFF: Promise.resolve(input.GeoTIFF),
        GeoTIFFImages: Promise.resolve(input.GeoTIFFImages),
      };
      this.GeoTIFF = input.GeoTIFF;
      this.imageCount = input.GeoTIFFImages.length;
      this.GeoTIFFImages = input.GeoTIFFImages;
      setupLevels.call(this);
    } else {
      // Load from File or URL
      const cacheHeaders: Record<string, string> | undefined = !this
        .options.cache
        ? { "Cache-Control": "no-cache,no-store" }
        : undefined;
      const srcLabel = input instanceof File
        ? `File(${(input as File).name}, ${(input as File).size} bytes)`
        : `URL(${String(input).slice(0, 80)})`;
      console.log("[GeoTIFFTileSource] loading from", srcLabel);
      this.promises = {
        GeoTIFF:
          input instanceof File
            ? fromBlob(input)
            : fromUrl(input as string, { headers: cacheHeaders }),
        GeoTIFFImages: deferredPromise(),
        ready: deferredPromise(),
      };
      this.promises.GeoTIFF.then((tiff: any) => {
        console.log("[GeoTIFFTileSource] tiff loaded, getting image count...");
        self.GeoTIFF = tiff;
        return tiff.getImageCount();
      })
        .then((count: number) => {
          console.log("[GeoTIFFTileSource] image count:", count);
          self.imageCount = count;
          return Promise.all(
            [...Array(count).keys()].map((i) =>
              self.GeoTIFF.getImage(i),
            ),
          );
        })
        .then((images: any[]) => {
          console.log("[GeoTIFFTileSource] all images loaded, count:", images.length);
          self.GeoTIFFImages = images;
          self.promises.GeoTIFFImages.resolve(images);
          setupLevels.call(self);
        })
        .catch((error: Error) => {
          console.error("[GeoTIFFTileSource] load error:", error);
          throw error;
        });
    }
  }

  // ── Static: getAllTileSources ────────────────────────────────────

  GeoTIFFTileSource.getAllTileSources = async function (
    input: File | string,
    opts: GeoTIFFTileSourceOptions = { cache: true, slideOnly: false },
  ) {
    const cacheHeaders: Record<string, string> | undefined = !opts.cache
      ? { "Cache-Control": "no-cache,no-store" }
      : undefined;

    let tiff: any =
      input instanceof File
        ? fromBlob(input)
        : fromUrl(input as string, { headers: cacheHeaders });
    tiff = await tiff;
    console.log("[GeoTIFFTileSource.getAllTileSources] tiff opened, getting image count...");
    const count = await tiff.getImageCount();
    console.log("[GeoTIFFTileSource.getAllTileSources] image count:", count);
    let images = await Promise.all(
      [...Array(count).keys()].map((i) => tiff.getImage(i)),
    );

    // Filter out transparency masks
    images = images.filter(
      (image: any) =>
        image.fileDirectory.PhotometricInterpretation !==
        globals.photometricInterpretations.TransparencyMask,
    );
    images.sort((a: any, b: any) => b.getWidth() - a.getWidth());

    // Group by aspect ratio
    const tolerance = 0.015;
    const aspectSets = images.reduce(
      (acc: any[], image: any) => {
        const r = image.getWidth() / image.getHeight();
        const exists = acc.filter(
          (set) => Math.abs(1 - set.aspectRatio / r) < tolerance,
        );
        if (exists.length === 0) {
          acc.push({ aspectRatio: r, images: [image] });
        } else {
          exists[0]!.images.push(image);
        }
        return acc;
      },
      [],
    );

    let imagesets = aspectSets.map((s: any) => s.images);

    if (opts.slideOnly) {
      imagesets = [
        imagesets.reduce((best: any[], set: any[]) => {
          if (
            best.length < set.length ||
            (best.length === set.length &&
              best[0].getWidth() < set[0].getWidth())
          )
            return set;
          return best;
        }, []),
      ];
    }

    return imagesets.map(
      (imgs: any[]) =>
        new (GeoTIFFTileSource as any)(
          { GeoTIFF: tiff, GeoTIFFImages: imgs },
          opts,
        ),
    );
  };

  // ── Prototype methods ────────────────────────────────────────────

  Object.defineProperty(GeoTIFFTileSource.prototype, "ready", {
    set: function () {},
    get: function () {
      return this._ready;
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  (OpenSeadragon as any).extend(
    GeoTIFFTileSource.prototype,
    OpenSeadragon.TileSource.prototype,
    {
      getTileWidth(level: number) {
        if (this.levels.length > level) return this.levels[level].tileWidth;
      },
      getTileHeight(level: number) {
        if (this.levels.length > level) return this.levels[level].tileHeight;
      },
      getLevelScale(level: number) {
        if (
          this.levels.length > 0 &&
          level >= this.minLevel &&
          level <= this.maxLevel
        ) {
          return (
            this.levels[level].width /
            this.levels[this.maxLevel].width
          );
        }
        return NaN;
      },
      getTileUrl(levelnum: number, x: number, y: number) {
        const level = this.levels[levelnum];
        const url = new String(`${levelnum}/${x}_${y}`) as any;
        url.fetch = () => regionToDataUrl.call(this, level, x, y, url);
        return url;
      },
      downloadTileStart(context: any) {
        const image = new Image();
        const request = "" + context.src;
        context.src
          .fetch()
          .then((dataURL: string) => {
            image.onload = () => context.finish(image);
            image.onerror = image.onabort = () =>
              context.finish(null, request, "Request aborted");
            image.src = dataURL;
          })
          .catch((e: Error) => {
            context.finish(null, request, e.message);
          });
      },
      downloadTileAbort(context: any) {
        context.src.abortController?.abort();
      },
    } as any,
  );

  // ── Register ─────────────────────────────────────────────────────

  (OSD as any).GeoTIFFTileSource = GeoTIFFTileSource as any;
})(OpenSeadragon);

export default OpenSeadragon as OpenSeadragonGeoTIFF;
