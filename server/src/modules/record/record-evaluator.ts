import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type { RecordDraft } from "@villanelle/ret-shared/domain";
import { createSanitizedLogger } from "../../common/logging/sanitized-logger";

import { loadServerModelConfig, resolveServerModelDir } from "../model/model-config";

const resolveDefaultPythonCmd = (modelRoot: string): string => {
  const venvCandidates =
    process.platform === "win32"
      ? [
          path.resolve(modelRoot, "venv-LMN-1.0", "Scripts", "python.exe"),
          path.resolve(modelRoot, "venv.portable.Ret", "python.exe")
        ]
      : [
          path.resolve(modelRoot, "venv-LMN-1.0", "bin", "python"),
          path.resolve(modelRoot, "venv.portable.Ret", "bin", "python")
        ];
  const resolved = venvCandidates.find((candidate) => fs.existsSync(candidate));
  return resolved ?? "python";
};

type WorkerReadyMessage = {
  type: "ready";
  ok: boolean;
  error?: string;
};

type WorkerPredictPayload = {
  modelType: "2class" | "3class" | "5class";
  generateHeatmap: boolean;
  uploadId: string;
  slidePath: string;
};

type PendingRequest = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
};

type ReadyWaiter = {
  resolve: () => void;
  reject: (reason: Error) => void;
};

class PythonWorkerClient {
  private readonly logger = createSanitizedLogger(PythonWorkerClient.name);
  private workerProcess: ChildProcessWithoutNullStreams | null = null;
  private workerRequestSeq = 0;
  private workerReady = false;
  private workerReadyMessage: WorkerReadyMessage | null = null;
  private readonly workerReadyWaiters = new Set<ReadyWaiter>();
  private readonly workerPending = new Map<string, PendingRequest>();  private onProgress: ((pct: number, step: string) => void) | null = null;

  setOnProgress(cb: (pct: number, step: string) => void): void {
    this.onProgress = cb;
  }
  private flushReadyWaiters(error?: Error): void {
    this.workerReadyWaiters.forEach((waiter) => {
      if (error) {
        waiter.reject(error);
        return;
      }
      waiter.resolve();
    });
    this.workerReadyWaiters.clear();
  }

  private cleanup(reason: Error): void {
    this.workerProcess = null;
    this.workerReady = false;
    this.workerReadyMessage = null;
    this.flushReadyWaiters(reason);
    this.workerPending.forEach((pending) => pending.reject(reason));
    this.workerPending.clear();
  }

  async ensureReady(timeoutMs = 2_100_000): Promise<void> {
    if (this.workerReady) {
      return;
    }
    if (this.workerReadyMessage && !this.workerReadyMessage.ok) {
      throw new Error(this.workerReadyMessage.error ?? "worker ready failed");
    }
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.workerReadyWaiters.delete(waiter);
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
        }
      };
      this.workerReadyWaiters.add(waiter);
    });
  }

  async start(command: string, args: string[]): Promise<void> {
    if (this.workerProcess) {
      return;
    }

    this.workerReady = false;
    this.workerReadyMessage = null;
    const commandLine = `${command} ${args.join(" ")}`.trim();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const failStart = (error: Error) => {
        if (settled) return;
        settled = true;
        const failMessage: WorkerReadyMessage = {
          type: "ready",
          ok: false,
          error: error.message
        };
        this.workerReady = false;
        this.workerReadyMessage = failMessage;
        this.logger.error(`[worker] start failed: ${error.message}`);
        reject(error);
      };

      try {
        if (!command) {
          failStart(new Error("worker command is empty"));
          return;
        }
        if (!fs.existsSync(command) && !command.includes(path.sep)) {
          this.logger.warn(`[worker] executable not found in fs check (may rely on PATH): ${command}`);
        }
        const scriptPathArg = args.find((arg) => arg.endsWith(".py") || arg.endsWith(".js"));
        if (scriptPathArg && !fs.existsSync(scriptPathArg)) {
          failStart(new Error(`worker script not found: ${scriptPathArg}`));
          return;
        }

        const proc = spawn(command, args, { stdio: "pipe" });
        this.workerProcess = proc;

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
                error: message?.error
              };
              this.workerReady = readyMessage.ok;
              this.workerReadyMessage = readyMessage;
              if (!readyMessage.ok) {
                this.logger.error(`[worker] ready failed: ${readyMessage.error ?? "unknown error"}`);
                this.flushReadyWaiters(new Error(readyMessage.error ?? "worker ready failed"));
              } else {
                this.logger.log("[worker] ready");
                this.flushReadyWaiters();
              }
              return;
            }

            if (message?.type === "progress") {
              if (typeof message?.pct === "number" && typeof message?.step === "string") {
                this.onProgress?.(message.pct, message.step);
              }
              return;
            }

            const id = String(message?.id ?? "");
            const pending = this.workerPending.get(id);
            if (!pending) return;
            this.workerPending.delete(id);
            if (message?.ok) {
              pending.resolve(String(message.result ?? ""));
            } else {
              pending.reject(new Error(message?.error ?? "worker response error"));
            }
          } catch (error) {
            this.logger.warn(`[worker] failed to parse response: ${String(error)}`);
          }
        });

        proc.stderr?.on("data", (data) => {
          this.logger.warn(`[worker] ${data.toString().trim()}`);
        });

        proc.on("error", (error) => {
          const reason = error instanceof Error ? error : new Error(String(error));
          failStart(reason);
          this.cleanup(new Error("worker spawn error"));
        });

        proc.on("exit", (code, signal) => {
          this.logger.warn(`[worker] exited (${code ?? "null"}/${signal ?? "null"})`);
          if (!this.workerReady) {
            const reason = new Error(
              `worker exited before ready (${code ?? "null"}/${signal ?? "null"})`
            );
            this.workerReadyMessage = {
              type: "ready",
              ok: false,
              error: reason.message
            };
          }
          this.cleanup(new Error("worker exited"));
        });

        proc.on("spawn", () => {
          if (settled) return;
          settled = true;
          this.logger.log(`[worker] started: ${commandLine}`);
          resolve();
        });
      } catch (error) {
        failStart(error as Error);
      }
    });
  }

  async request(payload: WorkerPredictPayload): Promise<string> {
    await this.ensureReady();
    const proc = this.workerProcess;
    if (!proc || !proc.stdin) {
      throw new Error("worker not running");
    }
    const id = String(++this.workerRequestSeq);
    const message = JSON.stringify({ id, cmd: "predict", ...payload });
    return await new Promise<string>((resolve, reject) => {
      this.workerPending.set(id, { resolve, reject });
      proc.stdin.write(`${message}\n`);
    });
  }

  stop(): void {
    if (!this.workerProcess) return;
    const proc = this.workerProcess;
    try {
      proc.kill();
    } catch (error) {
      this.logger.warn(`[worker] failed to stop: ${String(error)}`);
    }
    this.cleanup(new Error("worker stopped"));
  }
}

export interface RecordEvaluator {
  evaluate(record: RecordDraft): Promise<string>;
}

@Injectable()
export class PythonRecordEvaluator implements RecordEvaluator, OnModuleDestroy {
  private readonly logger = createSanitizedLogger(PythonRecordEvaluator.name);
  private readonly workerClient = new PythonWorkerClient();

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async evaluate(record: RecordDraft): Promise<string> {
    const modelRoot = resolveServerModelDir(this.configService.get<string>("MODEL_ROOT"));
    let modelVersion = "unknown";
    try {
      modelVersion = loadServerModelConfig(this.configService.get<string>("MODEL_ROOT")).modelVersion;
    } catch (error) {
      this.logger.warn(`[evaluation] model config unavailable: ${String(error)}`);
    }

    // Resolve the SVS slide file path from upload storage
    const projectRoot = fs.existsSync(path.join(process.cwd(), "assets"))
      ? process.cwd()
      : path.resolve(process.cwd(), "..");
    const uploadRoot = path.resolve(
      this.configService.get<string>("UPLOAD_ROOT") ?? path.join(projectRoot, "data", "uploads")
    );
    const slidePath = path.join(uploadRoot, record.uploadId, "input", record.slideFileName);
    if (!fs.existsSync(slidePath)) {
      throw new Error(`slide file not found: ${slidePath}`);
    }

    const scriptPath =
      this.configService.get<string>("SERVICE_EVAL_SCRIPT") ?? path.resolve(modelRoot, "worker.py");
    const pythonCmd =
      this.configService.get<string>("SERVICE_PYTHON_CMD") ?? resolveDefaultPythonCmd(modelRoot);
    const args =
      path.basename(pythonCmd).toLowerCase().includes("python")
        ? ["-u", scriptPath]
        : [scriptPath];

    try {
      await this.workerClient.start(pythonCmd, args);
      this.workerClient.setOnProgress((pct, step) => {
        this.logger.log(`[evaluation] progress ${pct}% — ${step}`);
      });
      const result = await this.workerClient.request({
        modelType: record.modelType,
        generateHeatmap: record.generateHeatmap,
        uploadId: record.uploadId,
        slidePath
      });

      this.logger.log(
        `[evaluation] source=worker modelVersion=${modelVersion} modelType=${record.modelType} heatmap=${record.generateHeatmap} result=${result}`
      );
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[evaluation] blocked: worker not ready (${reason})`);
      throw new Error(SharedClientErrorMessage.workerNotReady);
    }
  }

  onModuleDestroy(): void {
    this.workerClient.stop();
  }
}
