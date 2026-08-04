const { spawn } = require("node:child_process");

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const compressionLevel =
  process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || "1";

console.log(
  `[electron-builder] 7-Zip compression level: ${compressionLevel} ` +
    "(override with ELECTRON_BUILDER_COMPRESSION_LEVEL=0..9)",
);

const startedAt = Date.now();
const child = spawn(
  pnpmCommand,
  ["exec", "electron-builder", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ELECTRON_MIRROR:
        process.env.ELECTRON_MIRROR ||
        "https://npmmirror.com/mirrors/electron/",
      ELECTRON_BUILDER_BINARIES_MIRROR:
        process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
        "https://npmmirror.com/mirrors/electron-builder-binaries/",
      ELECTRON_BUILDER_COMPRESSION_LEVEL: compressionLevel,
    },
  },
);

const heartbeat = setInterval(() => {
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[electron-builder] still running (${elapsedSeconds}s elapsed); ` +
      "large Python/model resources can make compression quiet for several minutes",
  );
}, 30_000);

child.on("error", (error) => {
  clearInterval(heartbeat);
  console.error("[electron-builder] failed to start:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  clearInterval(heartbeat);
  if (signal) {
    console.error(`[electron-builder] terminated by signal ${signal}`);
  }
  process.exit(code ?? 1);
});
