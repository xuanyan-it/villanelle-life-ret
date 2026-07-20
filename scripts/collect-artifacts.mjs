import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outRoot = path.join(root, "release");
const outFrontend = path.join(outRoot, "frontend");
const outServer = path.join(outRoot, "server");
const outElectron = path.join(outRoot, "electron");

const copyIfExists = (from, to) => {
  if (!existsSync(from)) return false;
  rmSync(to, { recursive: true, force: true });
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  return true;
};

const warnings = [];

mkdirSync(outRoot, { recursive: true });
rmSync(outFrontend, { recursive: true, force: true });
rmSync(outServer, { recursive: true, force: true });
rmSync(outElectron, { recursive: true, force: true });

// frontend deliverable
if (!copyIfExists(path.join(root, "frontend", "dist"), path.join(outFrontend, "dist"))) {
  warnings.push("missing frontend/dist (run pnpm --filter @villanelle/ret-frontend build)");
}

// server deliverable (runtime package, not only dist)
if (!copyIfExists(path.join(root, "server", "dist"), path.join(outServer, "dist"))) {
  warnings.push("missing server/dist (run pnpm --filter @villanelle/ret-server build)");
}
copyIfExists(path.join(root, "server", "package.json"), path.join(outServer, "package.json"));
copyIfExists(path.join(root, "pnpm-lock.yaml"), path.join(outServer, "pnpm-lock.yaml"));
copyIfExists(path.join(root, "server", "migrations"), path.join(outServer, "migrations"));
if (!copyIfExists(path.join(root, "assets", "models"), path.join(outServer, "assets", "models"))) {
  warnings.push("missing assets/models (model runtime files are required)");
}
if (!copyIfExists(path.join(root, "assets", "templates"), path.join(outServer, "assets", "templates"))) {
  warnings.push("missing assets/templates (download templates are required)");
}

writeFileSync(
  path.join(outServer, "README.release.txt"),
  [
    "Server release package",
    "",
    "Expected deploy steps:",
    "1) Install production dependencies in this folder:",
    "   pnpm install --prod --frozen-lockfile",
    "2) (Optional) Set MODEL_ROOT to absolute model directory path.",
    "   If not set, server will read ./assets/models from this release package.",
    "3) Download templates are expected at ./assets/templates.",
    "4) Start server:",
    "   node dist/main.js",
    "",
    "Notes:",
    "- /api/model/config is strict: missing/invalid model.config.json will return 503.",
  ].join("\n"),
  "utf8"
);

// electron deliverables are optional in this release flow
copyIfExists(path.join(root, "electron", "release"), outElectron);

console.log(`release artifacts collected to ${outRoot}`);
if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`[warn] ${warning}`);
  }
}
