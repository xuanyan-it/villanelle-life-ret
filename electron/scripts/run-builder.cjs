const { spawnSync } = require("node:child_process");

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
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
    },
  },
);

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
