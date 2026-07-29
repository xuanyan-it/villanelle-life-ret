import type { ChildProcessWithoutNullStreams} from "child_process";
import { spawn } from "child_process";
import fs from "fs";
import readline from "readline";

import { getElectronLogger } from "../infrastructure/logger";

type WorkerReadyMessage = {
  type: "ready";
  ok: boolean;
  error?: string;
  pending?: boolean;
};

type PendingRequest = {
  resolve: (value: string) => void;
  reject: (reason?: Error) => void;
  onProgress?: (progress: { pct: number; step: string }) => void;
};

type ReadyWaiter = {
  resolve: () => void;
  reject: (reason: Error) => void;
};

type WorkerManagerOptions = {
  onReady: (message: WorkerReadyMessage) => void;
  emitShellOutput: (payload: unknown) => void;
};

export const createWorkerManager = ({
  onReady,
  emitShellOutput,
}: WorkerManagerOptions) => {
  const logger = getElectronLogger();
  let workerProcess: ChildProcessWithoutNullStreams | null = null;
  let workerRequestSeq = 0;
  let workerReady = false;
  let workerReadyMessage: WorkerReadyMessage | null = null;
  const workerReadyWaiters = new Set<ReadyWaiter>();
  const workerPending = new Map<string, PendingRequest>();

  const flushReadyWaiters = (error?: Error) => {
    workerReadyWaiters.forEach((waiter) => {
      if (error) {
        waiter.reject(error);
        return;
      }
      waiter.resolve();
    });
    workerReadyWaiters.clear();
  };

  const cleanup = (reason: Error) => {
    workerProcess = null;
    workerReady = false;
    workerReadyMessage = null;
    flushReadyWaiters(reason);
    workerPending.forEach((pending) => {
      pending.reject(reason);
    });
    workerPending.clear();
  };

  const waitForWorkerReady = async (timeoutMs = 1800000) => {
    if (workerReady) {
      return;
    }
    if (workerReadyMessage && !workerReadyMessage.ok) {
      throw new Error(workerReadyMessage.error ?? "worker ready failed");
    }
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        workerReadyWaiters.delete(waiter);
        reject(new Error("worker ready timeout"));
      }, timeoutMs);
      const waiter: ReadyWaiter = {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (reason: Error) => {
          clearTimeout(timeout);
          reject(reason);
        },
      };
      workerReadyWaiters.add(waiter);
    });
  };

  const start = async (command: string, args: string[]) => {
    if (workerProcess) {
      return;
    }

    workerReady = false;
    workerReadyMessage = null;
    const commandLine = `${command} ${args.join(" ")}`.trim();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const failStart = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        const failMessage: WorkerReadyMessage = {
          type: "ready",
          ok: false,
          error: error.message,
        };
        workerReady = false;
        workerReadyMessage = failMessage;
        onReady(failMessage);
        emitShellOutput(`[worker] start failed: ${error.message}`);
        reject(error);
      };
      try {
        // Log start attempt before spawn so failures still leave a trace.
        emitShellOutput(`[worker] starting: ${commandLine}`);
        if (!command) {
          failStart(new Error("worker command is empty"));
          return;
        }
        if (!fs.existsSync(command)) {
          emitShellOutput(`[worker] python not found: ${command}`);
        }
        const scriptPathArg = args[1];
        if (scriptPathArg && !fs.existsSync(scriptPathArg)) {
          emitShellOutput(`[worker] script not found: ${scriptPathArg}`);
        }

        const proc = spawn(command, args, { stdio: "pipe" });
        workerProcess = proc;

        const rl = readline.createInterface({ input: proc.stdout });
        rl.on("line", (line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            const message = JSON.parse(trimmed);
            if (message?.type === "ready") {
              const readyMessage: WorkerReadyMessage = {
                type: "ready",
                ok: Boolean(message?.ok),
                error: message?.error,
              };
              workerReady = readyMessage.ok;
              workerReadyMessage = readyMessage;
              onReady(readyMessage);
              if (!readyMessage.ok) {
                emitShellOutput(
                  `[worker] ready failed: ${
                    readyMessage.error ?? "unknown error"
                  }`,
                );
                flushReadyWaiters(
                  new Error(readyMessage.error ?? "worker ready failed"),
                );
                logger.warn("[worker] ready failed", { error: readyMessage.error ?? "" });
              } else {
                emitShellOutput("[worker] ready");
                flushReadyWaiters();
              }
              return;
            }

            const id = String(message?.id ?? "");
            const pending = workerPending.get(id);
            if (!pending) return;
            if (message?.type === "progress") {
              const pct = Number(message?.pct);
              const step = String(message?.step ?? "");
              if (Number.isFinite(pct)) {
                pending.onProgress?.({ pct, step });
                emitShellOutput(`[worker] progress: ${pct}% ${step}`.trim());
              }
              return;
            }
            if (typeof message?.ok !== "boolean") {
              logger.warn("[worker] ignored non-terminal response", {
                id,
                type: String(message?.type ?? ""),
              });
              return;
            }
            workerPending.delete(id);
            if (message?.ok) {
              pending.resolve(String(message.result ?? ""));
            } else {
              pending.reject(new Error(message?.error ?? "worker response error"));
            }
          } catch (error) {
            logger.warn("[worker] failed to parse response", {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });

        proc.stderr?.on("data", (data) => {
          logger.error("[worker] stderr", { data: data.toString().trim() });
        });

        proc.on("error", (error) => {
          failStart(
            error instanceof Error ? error : new Error(String(error)),
          );
          cleanup(new Error("worker spawn error"));
        });

        proc.on("exit", (code, signal) => {
          logger.warn("[worker] exited", {
            code: code ?? null,
            signal: signal ?? null
          });
          if (!workerReady) {
            const reason = new Error(
              `worker exited before ready (${code ?? "null"}/${signal ?? "null"})`,
            );
            const failMessage: WorkerReadyMessage = {
              type: "ready",
              ok: false,
              error: reason.message,
            };
            workerReady = false;
            workerReadyMessage = failMessage;
            onReady(failMessage);
          }
          cleanup(new Error("worker exited"));
        });

        proc.on("spawn", () => {
          if (settled) {
            return;
          }
          settled = true;
          logger.info("[worker] started", { commandLine, pid: proc.pid ?? null });
          emitShellOutput(`[worker] started: pid=${proc.pid ?? "unknown"}`);
          resolve();
        });
      } catch (error) {
        failStart(error as Error);
      }
    });
  };

  const request = async (
    payload: Record<string, string | boolean | number>,
    onProgress?: (progress: { pct: number; step: string }) => void,
  ) => {
    await waitForWorkerReady();
    const proc = workerProcess;
    if (!proc || !proc.stdin) {
      throw new Error("worker not running");
    }
    const id = String(++workerRequestSeq);
    const message = JSON.stringify({ id, cmd: "predict", ...payload });
    return await new Promise<string>((resolve, reject) => {
      workerPending.set(id, { resolve, reject, onProgress });
      proc.stdin.write(message + "\n");
    });
  };

  const stop = () => {
    if (!workerProcess) return;
    const proc = workerProcess;
    try {
      proc.kill();
    } catch (error) {
      logger.warn("[worker] failed to stop worker", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    cleanup(new Error("worker stopped"));
  };

  const getReadyMessage = () => workerReadyMessage;

  return {
    start,
    request,
    ensureReady: waitForWorkerReady,
    stop,
    getReadyMessage,
  };
};

export type { WorkerReadyMessage };
export type WorkerManager = ReturnType<typeof createWorkerManager>;
