import { contextBridge, ipcRenderer } from "electron";

import type { SampleRecord } from "./types";

contextBridge.exposeInMainWorld("electron", { isElectronRuntime: true });

const subscribe = <T>(channel: string, callback: (payload: T) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
};

contextBridge.exposeInMainWorld("electronAPI", {
  // generic IPC invoke, used by electronApi.ts
  call: (route: string, payload?: any) => ipcRenderer.invoke(route, payload),

  // download helper (implement handler in main if needed)
  download: (filename: string) => ipcRenderer.invoke("download", filename),
  exportCsv: (payload: { filename: string; content: string }) =>
    ipcRenderer.invoke("exportCsv", payload),

  evaluationResponse: (callback: (record: SampleRecord) => void) =>
    subscribe("evaluationResponse", callback),

  shellOutput: (callback: (data: string) => void) =>
    subscribe("shellOutput", callback),
  workerReady: (
    callback: (payload: {
      type: string;
      ok: boolean;
      error?: string;
      pending?: boolean;
    }) => void
  ) => subscribe("workerReady", callback),

  fetchSampleRecords: (params: {
    instituteName: string;
    page?: number;
    pageSize?: number;
    deletedOnly?: boolean;
  }) => ipcRenderer.invoke("fetchSampleRecords", params),
  createSampleRecords: (record: SampleRecord) =>
    ipcRenderer.invoke("createSampleRecords", record),
  updateSampleRecords: (record: SampleRecord) =>
    ipcRenderer.invoke("updateSampleRecords", record),
  deleteSampleRecords: (record: SampleRecord) =>
    ipcRenderer.invoke("deleteSampleRecords", record),
  quitApp: () => ipcRenderer.invoke("quitApp"),
});
