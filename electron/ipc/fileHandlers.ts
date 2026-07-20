import { app, dialog } from "electron";
import fs from "fs";
import path from "path";
import {
  DEFAULT_TEMPLATE_FILENAME,
  normalizeTemplateFilename,
  SharedClientErrorMessage
} from "@villanelle/ret-shared/contracts";

import { parseElectronEnv } from "../config/env";
import type { IpcContext } from "./context";
import { createIpcHandlerFactory } from "./handlerFactory";
import { toClientErrorMessage } from "./responses";

export const registerFileHandlers = (context: Pick<IpcContext, "authSession" | "nodeEnv">) => {
  const env = parseElectronEnv(process.env);
  const { registerRaw } = createIpcHandlerFactory(context);
  const e2eSaveDir = process.env.RET_E2E_SAVE_DIR?.trim();

  const resolveSavePath = async (filename: string) => {
    if (e2eSaveDir && context.nodeEnv !== "production") {
      fs.mkdirSync(e2eSaveDir, { recursive: true });
      return { canceled: false, filePath: path.join(e2eSaveDir, filename) };
    }
    return await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
  };

  const templateRoot =
    context.nodeEnv === "development" && !app.isPackaged
      ? path.join(process.cwd(), "assets", "templates")
      : env.TEMPLATE_DIR
        ? path.resolve(process.resourcesPath, env.TEMPLATE_DIR)
        : path.join(process.resourcesPath, "assets", "templates");

  registerRaw(
    "download",
    {},
    async (filename: string) => {
      try {
        const normalizedFilename = normalizeTemplateFilename(filename);
        if (!normalizedFilename) {
          throw new Error(SharedClientErrorMessage.invalidTemplateFilename);
        }
        const sourcePath = path.join(templateRoot, normalizedFilename);
        const { canceled, filePath } = await resolveSavePath(
          normalizedFilename || DEFAULT_TEMPLATE_FILENAME,
        );
        if (canceled || !filePath) {
          return { canceled: true };
        }
        if (!fs.existsSync(sourcePath)) {
          throw new Error(SharedClientErrorMessage.templateNotFound);
        }
        fs.copyFileSync(sourcePath, filePath);
        return { canceled: false };
      } catch (error) {
        throw new Error(toClientErrorMessage(error, SharedClientErrorMessage.downloadFailed));
      }
    }
  );

  registerRaw(
    "exportCsv",
    {},
    async (payload: { filename: string; content: string }) => {
      try {
        const { filename, content } = payload;
        const { canceled, filePath } = await resolveSavePath(filename);
        if (canceled || !filePath) {
          return { canceled: true };
        }
        fs.writeFileSync(filePath, content, "utf8");
        return { canceled: false };
      } catch (error) {
        throw new Error(toClientErrorMessage(error, SharedClientErrorMessage.exportCsvFailed));
      }
    }
  );
};
