import { app, BrowserWindow, globalShortcut, Menu } from "electron";

type RegisterAppLifecycleOptions = {
  nodeEnv?: string;
  createWindow: () => void;
  getMainWindow: () => BrowserWindow | undefined;
  onBeforeQuit?: () => void;
};

export const registerAppLifecycle = ({
  nodeEnv,
  createWindow,
  getMainWindow,
  onBeforeQuit,
}: RegisterAppLifecycleOptions) => {
  app.on("ready", async () => {
    if (nodeEnv !== "development") {
      Menu.setApplicationMenu(null);
      globalShortcut.register("F5", () => {});
      globalShortcut.register("CommandOrControl+R", () => {});
      app.on("web-contents-created", (event, contents) => {
        contents.on("will-navigate", (navEvent, url) => {
          if (typeof url === "string" && url.startsWith("http")) {
            navEvent.preventDefault();
          }
        });
      });
    }

    const toggleDevTools = () => {
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const wc = mainWindow.webContents;
      if (wc.isDevToolsOpened()) {
        wc.closeDevTools();
      } else {
        wc.openDevTools();
      }
    };

    globalShortcut.register("CommandOrControl+Shift+I", toggleDevTools);
    globalShortcut.register("CommandOrControl+Alt+I", toggleDevTools);
    createWindow();
  });

  app.on("window-all-closed", () => {
    if (nodeEnv !== "development") {
      globalShortcut.unregisterAll();
    }
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on("before-quit", () => {
    if (!onBeforeQuit) {
      return;
    }
    onBeforeQuit();
  });
};
