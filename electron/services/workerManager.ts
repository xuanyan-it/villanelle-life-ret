import type { ChildProcessWithoutNullStreams} from "child_process";
import { spawn } from "child_process";
import fs from "fs";

import { getElectronLogger } from "../infrastructure/logger";

type WorkerReadyMessage = {
  type: "ready";
  ok: boolean;
  error?: string;
  pending?: boolean;
};

type PendingRequest = {
  resolve: (value: string | Buffer) => void;
  reject: (reason?: Error) => void;
  onProgress?: (progress: { pct: number; step: string }) => void;
};

type ReadyWaiter = {
  resolve: () => void;
  reject: (reason: Error) => void;
};

type WorkerSlot = {
  index: number;
  role: "predict" | "tile";
  process: ChildProcessWithoutNullStreams | null;
  ready: boolean;
  readyMessage: WorkerReadyMessage | null;
  readyWaiters: Set<ReadyWaiter>;
  pending: Map<string, PendingRequest>;
  seq: number;
  streamBuffer: any;
  pendingTile: { id: string; length: number } | null;
};

type WorkerManagerOptions = {
  onReady: (message: WorkerReadyMessage) => void;
  emitShellOutput: (payload: unknown) => void;
};

/** Startup configuration remembered so workers can be spawned lazily on first use. */
type WorkerStartConfig = {
  command: string;
  args: string[];
  count?: number;
  tileCommand?: string;
  tileArgs?: string[];
};

/** Worker pool size — override with RET_WORKER_COUNT (default 3). */
const resolveWorkerCount = () => {
  const raw = process.env.RET_WORKER_COUNT?.trim();
  if (!raw) {
    return 3;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(8, n)) : 3;
};

export const createWorkerManager = ({
  onReady,
  emitShellOutput,
}: WorkerManagerOptions) => {
  const logger = getElectronLogger();
  const workers: WorkerSlot[] = [];
  let slotPointer = 0;
  let startConfig: WorkerStartConfig | null = null;

  const createSlot = (index: number, role: "predict" | "tile"): WorkerSlot => ({
    index,
    role,
    process: null,
    ready: false,
    readyMessage: null,
    readyWaiters: new Set(),
    pending: new Map(),
    seq: 0,
    streamBuffer: Buffer.alloc(0),
    pendingTile: null,
  });

  const flushReadyWaiters = (slot: WorkerSlot, error?: Error) => {
    slot.readyWaiters.forEach((waiter) => {
      if (error) {
        waiter.reject(error);
        return;
      }
      waiter.resolve();
    });
    slot.readyWaiters.clear();
  };

  const cleanup = (slot: WorkerSlot, reason: Error) => {
    slot.process = null;
    slot.ready = false;
    slot.readyMessage = null;
    flushReadyWaiters(slot, reason);
    slot.pending.forEach((pending) => pending.reject(reason));
    slot.pending.clear();
    slot.pendingTile = null;
  };

  const waitForSlotReady = (slot: WorkerSlot, timeoutMs = 1800000) => {
    if (slot.ready) {
      return Promise.resolve();
    }
    if (slot.readyMessage && !slot.readyMessage.ok) {
      return Promise.reject(
        new Error(slot.readyMessage.error ?? "worker ready failed"),
      );
    }
    return new Promise<void>((resolve, reject) => {
      let timeout: NodeJS.Timeout;
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
      timeout = setTimeout(() => {
        slot.readyWaiters.delete(waiter);
        reject(new Error("worker ready timeout"));
      }, timeoutMs);
      slot.readyWaiters.add(waiter);
    });
  };

  const handleMessage = (slot: WorkerSlot, message: Record<string, unknown>) => {
    if (message?.type === "ready") {
      const readyMessage: WorkerReadyMessage = {
        type: "ready",
        ok: Boolean(message?.ok),
        error: message?.error as string | undefined,
      };
      slot.ready = readyMessage.ok;
      slot.readyMessage = readyMessage;
      onReady(readyMessage);
      if (!readyMessage.ok) {
        emitShellOutput(
          `[worker#${slot.index}] ready failed: ${
            readyMessage.error ?? "unknown error"
          }`,
        );
        flushReadyWaiters(
          slot,
          new Error(readyMessage.error ?? "worker ready failed"),
        );
        logger.warn("[worker] ready failed", {
          index: slot.index,
          error: readyMessage.error ?? "",
        });
      } else {
        emitShellOutput(`[worker#${slot.index}] ready`);
        flushReadyWaiters(slot);
      }
      return;
    }

    const id = String(message?.id ?? "");
    if (!id) {
      return;
    }
    const pending = slot.pending.get(id);
    if (!pending) {
      return;
    }

    if (message?.type === "progress") {
      const pct = Number(message?.pct);
      const step = String(message?.step ?? "");
      if (Number.isFinite(pct)) {
        pending.onProgress?.({ pct, step });
        emitShellOutput(
          `[worker#${slot.index}] progress: ${pct}% ${step}`.trim(),
        );
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

    // Tile binary frame: the JSON line announces the frame, the raw bytes
    // follow on stdout.  Resolve only after those bytes have arrived.
    if (message?.type === "tile") {
      slot.pendingTile = { id, length: Number(message?.length ?? 0) };
      return;
    }

    slot.pending.delete(id);
    if (message?.ok) {
      pending.resolve(String(message?.result ?? ""));
    } else {
      pending.reject(new Error(String(message?.error ?? "worker response error")));
    }
  };

  /**
   * Custom stdout parser: JSON lines interleaved with raw binary tile frames.
   * After a `{"type":"tile","length":N}` JSON line, the next N bytes on the
   * stream are the raw tile payload (no base64 → no 33% overhead).
   */
  const attachStdout = (
    slot: WorkerSlot,
    proc: ChildProcessWithoutNullStreams,
  ) => {
    proc.stdout.on("data", (chunk: Buffer) => {
      slot.streamBuffer = Buffer.concat([slot.streamBuffer, chunk]);
      while (slot.streamBuffer.length > 0) {
        if (slot.pendingTile) {
          const need = slot.pendingTile.length;
          if (slot.streamBuffer.length < need) {
            break;
          }
          const data = Buffer.from(slot.streamBuffer.subarray(0, need));
          slot.streamBuffer = slot.streamBuffer.subarray(need);
          const { id } = slot.pendingTile;
          slot.pendingTile = null;
          const pending = slot.pending.get(id);
          if (pending) {
            slot.pending.delete(id);
            pending.resolve(data);
          }
          continue;
        }
        const newline = slot.streamBuffer.indexOf(0x0a);
        if (newline === -1) {
          break;
        }
        const line = slot.streamBuffer
          .subarray(0, newline)
          .toString("utf8")
          .trim();
        slot.streamBuffer = slot.streamBuffer.subarray(newline + 1);
        if (!line) {
          continue;
        }
        try {
          handleMessage(slot, JSON.parse(line));
        } catch (error) {
          logger.warn("[worker] failed to parse response", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  };

  const spawnWorker = (slot: WorkerSlot, command: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
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
        slot.ready = false;
        slot.readyMessage = failMessage;
        onReady(failMessage);
        emitShellOutput(`[worker#${slot.index}] start failed: ${error.message}`);
        reject(error);
      };
      const commandLine = `${command} ${args.join(" ")}`.trim();
      try {
        emitShellOutput(`[worker#${slot.index}] starting: ${commandLine}`);
        if (!command) {
          failStart(new Error("worker command is empty"));
          return;
        }
        if (!fs.existsSync(command)) {
          emitShellOutput(
            `[worker#${slot.index}] python not found: ${command}`,
          );
        }
        const scriptPathArg = args[1];
        if (scriptPathArg && !fs.existsSync(scriptPathArg)) {
          emitShellOutput(
            `[worker#${slot.index}] script not found: ${scriptPathArg}`,
          );
        }

        const proc = spawn(command, args, { stdio: "pipe" });
        slot.process = proc;
        attachStdout(slot, proc);

        proc.stderr?.on("data", (data) => {
          logger.error(`[worker#${slot.index}] stderr`, {
            data: data.toString().trim(),
          });
        });

        proc.on("error", (error) => {
          failStart(error instanceof Error ? error : new Error(String(error)));
          cleanup(slot, new Error("worker spawn error"));
        });

        proc.on("exit", (code, signal) => {
          logger.warn(`[worker#${slot.index}] exited`, {
            code: code ?? null,
            signal: signal ?? null,
          });
          if (!slot.ready) {
            const reason = new Error(
              `worker exited before ready (${code ?? "null"}/${signal ?? "null"})`,
            );
            const failMessage: WorkerReadyMessage = {
              type: "ready",
              ok: false,
              error: reason.message,
            };
            slot.ready = false;
            slot.readyMessage = failMessage;
            onReady(failMessage);
          }
          cleanup(slot, new Error("worker exited"));
        });

        proc.on("spawn", () => {
          if (settled) {
            return;
          }
          settled = true;
          logger.info(`[worker#${slot.index}] started`, {
            commandLine,
            pid: proc.pid ?? null,
          });
          emitShellOutput(
            `[worker#${slot.index}] started: pid=${proc.pid ?? "unknown"}`,
          );
          resolve();
        });
      } catch (error) {
        failStart(error as Error);
      }
    });

  const start = async (
    command: string,
    args: string[],
    count = resolveWorkerCount(),
    tileCommand?: string,
    tileArgs?: string[],
  ) => {
    startConfig = { command, args, count, tileCommand, tileArgs };
    if (workers.length > 0) {
      return;
    }
    const n = Math.max(1, Math.min(8, Math.floor(count)));
    const hasTileWorkers = Boolean(tileCommand);
    const spawns: Promise<void>[] = [];
    for (let index = 0; index < n; index += 1) {
      // Worker #0 runs the heavy script (worker.py — predict); the rest run
      // the lightweight tile script (tile_worker.py) so torch never blocks
      // or bloats tile serving.
      const role: "predict" | "tile" =
        hasTileWorkers && index > 0 ? "tile" : "predict";
      const slot = createSlot(index, role);
      workers.push(slot);
      const cmd = role === "tile" ? tileCommand! : command;
      const cargs = role === "tile" ? (tileArgs ?? []) : args;
      spawns.push(spawnWorker(slot, cmd, cargs));
    }
    // Spawn all workers concurrently — total startup ≈ one script import.
    await Promise.allSettled(spawns);
  };

  const waitForAnyReady = async (timeoutMs = 30000) => {
    if (workers.some((w) => w.ready)) {
      return;
    }
    await Promise.race([
      ...workers.map((w) =>
        waitForSlotReady(w, timeoutMs).catch(() => undefined),
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("worker pool ready timeout")),
          timeoutMs,
        ),
      ),
    ]);
  };

  const selectWorker = (cmd: string): WorkerSlot | null => {
    const ready = workers.filter((w) => w.ready && w.process);
    if (ready.length === 0) {
      return null;
    }
    if (cmd === "predict") {
      // Heavy predict worker (worker.py) — long evaluations never block
      // tile serving on the lightweight tile workers.
      return ready.find((w) => w.role === "predict") ?? ready[0]!;
    }
    // extract-tile / slide-info: round-robin over the lightweight tile pool.
    const tilePool = ready.filter((w) => w.role === "tile");
    const pool = tilePool.length > 0 ? tilePool : ready;
    const slot = pool[slotPointer % pool.length]!;
    slotPointer = (slotPointer + 1) % pool.length;
    return slot;
  };

  const ensureStarted = async () => {
    if (workers.length > 0) {
      return;
    }
    if (!startConfig) {
      throw new Error("worker manager not configured");
    }
    await start(
      startConfig.command,
      startConfig.args,
      startConfig.count,
      startConfig.tileCommand,
      startConfig.tileArgs,
    );
  };

  const configure = (config: WorkerStartConfig) => {
    startConfig = config;
  };

  const request = async (
    payload: Record<string, string | boolean | number>,
    onProgress?: (progress: { pct: number; step: string }) => void,
    cmd = "predict",
  ): Promise<string | Buffer> => {
    await ensureStarted();
    if (cmd === "predict") {
      const primary = workers.find((w) => w.index === 0);
      if (primary) {
        await waitForSlotReady(primary, 1800000);
      } else {
        await waitForAnyReady();
      }
    } else {
      await waitForAnyReady();
    }
    const slot = selectWorker(cmd);
    if (!slot || !slot.process || !slot.process.stdin) {
      throw new Error("worker not running");
    }
    const id = String(++slot.seq);
    const message = JSON.stringify({ id, cmd, ...payload });
    return new Promise<string | Buffer>((resolve, reject) => {
      slot.pending.set(id, { resolve, reject, onProgress });
      slot.process!.stdin!.write(message + "\n");
    });
  };

  const ensureReady = async (timeoutMs = 1800000) => {
    await Promise.all(workers.map((w) => waitForSlotReady(w, timeoutMs)));
  };

  const stop = () => {
    for (const slot of workers) {
      if (!slot.process) {
        continue;
      }
      try {
        slot.process.kill();
      } catch (error) {
        logger.warn("[worker] failed to stop worker", {
          index: slot.index,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      cleanup(slot, new Error("worker stopped"));
    }
    workers.length = 0;
    slotPointer = 0;
  };

  const getReadyMessage = () => workers[0]?.readyMessage ?? null;

  return {
    start,
    request,
    ensureReady,
    stop,
    getReadyMessage,
    configure,
  };
};

export type { WorkerReadyMessage };
export type WorkerManager = ReturnType<typeof createWorkerManager>;
