import * as SharedContracts from "@villanelle/ret-shared/contracts";

const E2E_STORAGE_KEY = "ret.alof.timeoutSeconds";

export const resolveIdleTimeoutMs = (): number => {
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem(E2E_STORAGE_KEY);
    const parsed = Number(fromStorage);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed * 1000;
    }
  }
  return SharedContracts.DEFAULT_IDLE_TIMEOUT_SECONDS * 1000;
};

export type IdleProtector = {
  start: () => void;
  stop: () => void;
};

export const createIdleProtector = (params: {
  timeoutMs: number;
  onProtect: () => void;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}): IdleProtector => {
  const { timeoutMs, onProtect, addEventListener, removeEventListener } = params;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const reset = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(onProtect, timeoutMs);
  };
  const activityListener = () => reset();
  const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

  return {
    start: () => {
      events.forEach((eventName) => addEventListener(eventName, activityListener));
      reset();
    },
    stop: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      events.forEach((eventName) => removeEventListener(eventName, activityListener));
    }
  };
};
