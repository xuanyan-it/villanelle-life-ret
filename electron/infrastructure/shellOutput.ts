import type { BrowserWindow } from "electron";

export const createShellOutputEmitter =
  (getWindow: () => BrowserWindow | null | undefined) =>
  (payload: unknown) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) {
      return;
    }
    win.webContents.send("shellOutput", payload);
  };
