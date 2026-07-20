import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "..", "dist");

if (existsSync(distPath)) {
  rmSync(distPath, { recursive: true, force: true });
}
