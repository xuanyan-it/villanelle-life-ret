import type { NativeImage } from "electron";
import { BrowserWindow } from "electron";
import { join } from "path";

export const createMainWindow = (iconImage: NativeImage): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    minHeight: 600,
    minWidth: 800,
    icon: iconImage,
    webPreferences: {
      devTools: true,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: true,
      nodeIntegrationInSubFrames: false,
      preload: join(__dirname, "../preload.js"),
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.maximize();
  if (!iconImage.isEmpty()) {
    mainWindow.setIcon(iconImage);
  }
  return mainWindow;
};

export const applyProductionWindowGuards = (mainWindow: BrowserWindow) => {
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const isReload =
      input.key === "F5" ||
      ((input.control || input.meta) &&
        (input.key === "r" || input.key === "R"));
    if (isReload) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on("context-menu", (event) => {
    event.preventDefault();
  });
};
