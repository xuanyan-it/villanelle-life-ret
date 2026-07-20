export type Unsubscribe = () => void;
type ShellOutputHandler = (data: string) => void;
const hasWindow = () => typeof window !== "undefined";
export const isElectronRuntime = (): boolean =>
  hasWindow() && Boolean(window.electron?.isElectronRuntime);
export const bindWindowDropGuard = (): Unsubscribe => {
  if (!hasWindow()) return () => undefined;
  const preventDefault = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("dragover", preventDefault);
  window.addEventListener("drop", preventDefault);
  return () => {
    window.removeEventListener("dragover", preventDefault);
    window.removeEventListener("drop", preventDefault);
  };
};
export const subscribeShellOutput = (handler: ShellOutputHandler): Unsubscribe => {
  if (!isElectronRuntime()) return () => undefined;
  return window.electronAPI?.shellOutput?.(handler) ?? (() => undefined);
};
