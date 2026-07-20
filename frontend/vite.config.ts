import { configDefaults, defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { parseFrontendEnv } from "./config/env";

export default defineConfig(({ mode }) => {
  const env = parseFrontendEnv(loadEnv(mode, process.cwd(), ""));
  const normalizePkgChunkName = (pkg: string) => pkg.replace("@", "").replace("/", "-");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@villanelle/ret-shared/contracts": path.resolve(__dirname, "../shared/src/contracts/index.ts"),
        "@villanelle/ret-shared/contracts/base": path.resolve(
          __dirname,
          "../shared/src/contracts/base/index.ts",
        ),
        "@villanelle/ret-shared/application": path.resolve(
          __dirname,
          "../shared/src/application/index.ts",
        ),
        "@villanelle/ret-shared/domain": path.resolve(
          __dirname,
          "../shared/src/domain/index.ts",
        ),
      }
    },
    server: {
      port: 5173,
      https: false,
      proxy: {
        "/health": {
          target: env.SERVICE_BASE_URL,
          changeOrigin: true,
          secure: false
        },
        "/api": {
          target: env.SERVICE_BASE_URL,
          changeOrigin: true,
          secure: false
        }
      }
    },
    test: {
      globals: true,
      environment: "happy-dom",
      setupFiles: "./src/setupTests.ts",
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: [...configDefaults.exclude, "__e2e__/**", "**/__e2e__/**"]
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            const nmIndex = id.lastIndexOf("node_modules/");
            const subPath = id.slice(nmIndex + "node_modules/".length);
            const parts = subPath.split("/");
            const pkgName = parts[0]?.startsWith("@")
              ? `${parts[0]}/${parts[1]}`
              : parts[0] ?? "misc";

            if (pkgName === "react" || pkgName === "react-dom" || pkgName === "scheduler") {
              return "vendor-react";
            }
            if (pkgName === "react-router" || pkgName === "react-router-dom") {
              return "vendor-router";
            }
            if (pkgName === "axios" || pkgName === "dayjs" || pkgName === "zod") {
              return "vendor-utils";
            }
            if (
              pkgName === "antd" ||
              pkgName.startsWith("@ant-design/") ||
              pkgName.startsWith("rc-")
            ) {
              return "vendor-ui";
            }
            if (
              pkgName.startsWith("@react-pdf/") ||
              pkgName === "pdfkit" ||
              pkgName === "fontkit" ||
              pkgName === "yoga-layout"
            ) {
              return `vendor-pdf-${normalizePkgChunkName(pkgName)}`;
            }
            return;
          }
        }
      }
    }
  };
});
