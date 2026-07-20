import { app } from "electron";

import type { IpcContext } from "./context";
import { loadElectronModelConfig } from "../services/modelConfig";
import { buildElectronRuntimeProfile } from "../services/runtimeProfile";
import { createIpcHandlerFactory } from "./handlerFactory";

export const registerSystemHandlers = (context: IpcContext) => {
  const { registerRaw } = createIpcHandlerFactory(context);

  registerRaw(
    "getModelConfig",
    {
      requireAuth: true
    },
    async () => loadElectronModelConfig(context.modelDir)
  );

  registerRaw(
    "getRuntimeProfile",
    {
      requireAuth: true
    },
    async () => buildElectronRuntimeProfile(context.modelDir)
  );

  registerRaw(
    "quitApp",
    {
      requireAuth: false
    },
    async () => {
      app.quit();
      return true;
    }
  );
};
