import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { createRecord, deleteRecords, listRecords, updateRecord } from "@villanelle/ret-shared/application";
import type { RecordDraft, RecordRepositoryPort, RecordUpdate, SampleRecord } from "@villanelle/ret-shared/domain";

import { PERSISTENCE_REPOSITORY_TOKEN, RECORD_EVALUATOR_TOKEN } from "../../common/di/tokens";
import type { PersistenceRepository } from "../persistence/persistence.repository";
import { createRecordRepositoryPort } from "../persistence/ports";

import { createDrizzleDb } from "../persistence/db";
import { evaluationJobItemsTable, evaluationJobsTable } from "../persistence/schema";

import type { RecordEvaluator } from "./record-evaluator";

@Injectable()
export class RecordService {
  private readonly recordPort: RecordRepositoryPort;
  private readonly evaluationJobDb:
    | ReturnType<typeof createDrizzleDb>["db"]
    | undefined;

  constructor(
    @Inject(PERSISTENCE_REPOSITORY_TOKEN) repository: PersistenceRepository,
    @Inject(RECORD_EVALUATOR_TOKEN)
    private readonly recordEvaluator: RecordEvaluator,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {
    this.recordPort = createRecordRepositoryPort(repository);

    const databaseUrl = this.configService.get<string>("DATABASE_URL");
    if (databaseUrl) {
      const { db } = createDrizzleDb(databaseUrl);
      this.evaluationJobDb = db;
    }
  }

  async createRecord(record: RecordDraft): Promise<SampleRecord> {
    return createRecord(record, this.recordPort, (draft) => this.recordEvaluator.evaluate(draft));
  }

  async createRecordWithoutEvaluation(record: RecordDraft): Promise<SampleRecord> {
    // Async MVP: create record now (result empty), evaluate in background.
    return this.recordPort.create(record, "");
  }

  async updateRecordResult(recordUuid: string, draft: RecordDraft, result: string): Promise<boolean> {
    return this.recordPort.update({
      uuid: recordUuid,
      hospitalName: draft.hospitalName,
      doctorName: draft.doctorName,
      patientName: draft.patientName,
      patientAge: draft.patientAge,
      patientGender: draft.patientGender,
      uploadId: draft.uploadId,
      slideFileName: draft.slideFileName,
      slideId: draft.slideId,
      samplingDate: draft.samplingDate,
      receptionDate: draft.receptionDate,
      testDate: draft.testDate,
      modelType: draft.modelType,
      generateHeatmap: draft.generateHeatmap,
      testerName: draft.testerName,
      reviewerName: "",
      otherInfo: draft.otherInfo,
      result,
      instituteName: draft.instituteName,
      isDeleted: 0
    });
  }

  async createRecordWithResult(record: RecordDraft, result: string): Promise<SampleRecord> {
    return this.recordPort.create(record, result);
  }

  /**
   * Create evaluation job+item for a single record, then run evaluation asynchronously.
   *
   * MVP cancel semantics (non-intrusive):
   * - cancel_requested prevents final record writing after evaluation completes.
   * - does not kill Python process (yet).
   */
  async createAndRunSingleEvaluationJob(params: {
    jobUuid: string;
    instituteName: string;
    createdByUsername: string;
    recordDraft: RecordDraft;
    itemSeqNo?: number;
  }): Promise<void> {
    const { jobUuid, instituteName, createdByUsername, recordDraft } = params;
    const itemSeqNo = params.itemSeqNo ?? 0;

    if (!this.evaluationJobDb) {
      // Safety fallback: if job db not available, use sync path.
      await this.createRecord(recordDraft);
      return;
    }

    await this.evaluationJobDb.insert(evaluationJobsTable).values({
      uuid: jobUuid,
      instituteName,
      createdByUsername,
      status: "pending",
      progressPercent: 0,
      errorMessage: "",
      recordUuid: "",
      cancelRequested: 0
    });

    await this.evaluationJobDb.insert(evaluationJobItemsTable).values({
      uuid: randomUUID(),
      evaluationJobUuid: jobUuid,
      itemSeqNo,
      itemStatus: "pending",
      recordUuid: "",
      errorMessage: ""
    });

    setImmediate(async () => {
      try {
        await this.evaluationJobDb!.update(evaluationJobsTable).set({
          status: "evaluating",
          progressPercent: 50,
          errorMessage: ""
        }).where(eq(evaluationJobsTable.uuid, jobUuid));

        const job = await this.evaluationJobDb!.select({
          cancelRequested: evaluationJobsTable.cancelRequested
        }).from(evaluationJobsTable).where(eq(evaluationJobsTable.uuid, jobUuid));

        if (job[0]?.cancelRequested) {
          await this.evaluationJobDb!.update(evaluationJobsTable).set({
            status: "cancelled",
            progressPercent: 100
          }).where(eq(evaluationJobsTable.uuid, jobUuid));

          await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
            itemStatus: "cancelled",
            errorMessage: ""
          }).where(and(
            eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
            eq(evaluationJobItemsTable.itemSeqNo, itemSeqNo)
          ));
          return;
        }

        // Give users a cancellation window before starting evaluation.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const jobBeforeEval = await this.evaluationJobDb!.select({
          cancelRequested: evaluationJobsTable.cancelRequested
        }).from(evaluationJobsTable).where(eq(evaluationJobsTable.uuid, jobUuid));
        if (jobBeforeEval[0]?.cancelRequested) {
          await this.evaluationJobDb!.update(evaluationJobsTable).set({
            status: "cancelled",
            progressPercent: 100
          }).where(eq(evaluationJobsTable.uuid, jobUuid));

          await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
            itemStatus: "cancelled",
            errorMessage: ""
          }).where(and(
            eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
            eq(evaluationJobItemsTable.itemSeqNo, itemSeqNo)
          ));
          return;
        }

        const probability = await this.recordEvaluator.evaluate(recordDraft);

        const jobAfter = await this.evaluationJobDb!.select({
          cancelRequested: evaluationJobsTable.cancelRequested
        }).from(evaluationJobsTable).where(eq(evaluationJobsTable.uuid, jobUuid));

        if (jobAfter[0]?.cancelRequested) {
          await this.evaluationJobDb!.update(evaluationJobsTable).set({
            status: "cancelled",
            progressPercent: 100
          }).where(eq(evaluationJobsTable.uuid, jobUuid));

          await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
            itemStatus: "cancelled",
            errorMessage: ""
          }).where(and(
            eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
            eq(evaluationJobItemsTable.itemSeqNo, itemSeqNo)
          ));
          return;
        }

        const created = await this.createRecordWithResult(recordDraft, probability);

        await this.evaluationJobDb!.update(evaluationJobsTable).set({
          status: "succeeded",
          progressPercent: 100,
          errorMessage: "",
          recordUuid: created.uuid
        }).where(eq(evaluationJobsTable.uuid, jobUuid));

        await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
          itemStatus: "succeeded",
          recordUuid: created.uuid,
          errorMessage: ""
        }).where(and(
          eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
          eq(evaluationJobItemsTable.itemSeqNo, itemSeqNo)
        ));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await this.evaluationJobDb!.update(evaluationJobsTable).set({
          status: "failed",
          progressPercent: 100,
          errorMessage: reason
        }).where(eq(evaluationJobsTable.uuid, jobUuid));

        await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
          itemStatus: "failed",
          recordUuid: "",
          errorMessage: reason
        }).where(and(
          eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
          eq(evaluationJobItemsTable.itemSeqNo, itemSeqNo)
        ));
      }
    });
  }

  async findActiveEvaluationJobUuid(params: {
    instituteName: string;
    createdByUsername: string;
  }): Promise<string | null> {
    if (!this.evaluationJobDb) {
      return null;
    }
    const { instituteName, createdByUsername } = params;
    const rows = await this.evaluationJobDb
      .select({ uuid: evaluationJobsTable.uuid })
      .from(evaluationJobsTable)
      .where(
        and(
          eq(evaluationJobsTable.instituteName, instituteName),
          eq(evaluationJobsTable.createdByUsername, createdByUsername),
          inArray(evaluationJobsTable.status, ["pending", "evaluating"])
        )
      )
      .orderBy(desc(evaluationJobsTable.createdAt))
      .limit(1);
    return rows[0]?.uuid ?? null;
  }

  async getActiveEvaluationJobs(params: {
    instituteName: string;
    createdByUsername: string;
  }) {
    if (!this.evaluationJobDb) {
      throw new Error("evaluation job db unavailable");
    }
    const { instituteName, createdByUsername } = params;

    const activeJob = await this.evaluationJobDb
      .select()
      .from(evaluationJobsTable)
      .where(
        and(
          eq(evaluationJobsTable.instituteName, instituteName),
          eq(evaluationJobsTable.createdByUsername, createdByUsername),
          inArray(evaluationJobsTable.status, ["pending", "evaluating"])
        )
      )
      .orderBy(desc(evaluationJobsTable.createdAt))
      .limit(1);

    if (!activeJob[0]) {
      return { jobs: [] };
    }

    const job = activeJob[0];
    const items = await this.evaluationJobDb
      .select()
      .from(evaluationJobItemsTable)
      .where(eq(evaluationJobItemsTable.evaluationJobUuid, job.uuid))
      .orderBy(evaluationJobItemsTable.itemSeqNo);

    return {
      jobs: [
        {
          jobUuid: String(job.uuid),
          instituteName: String(job.instituteName),
          status: String(job.status),
          progressPercent: Number(job.progressPercent ?? 0),
          recordUuid: String(job.recordUuid ?? ""),
          errorMessage: String(job.errorMessage ?? ""),
          items: items.map((it) => ({
            itemSeqNo: Number(it.itemSeqNo),
            itemStatus: String(it.itemStatus),
            recordUuid: String(it.recordUuid ?? ""),
            errorMessage: String(it.errorMessage ?? "")
          }))
        }
      ]
    };
  }

  async createAndRunBatchEvaluationJob(params: {
    instituteName: string;
    createdByUsername: string;
    recordDrafts: RecordDraft[];
    // When false, only enqueue; when true, start runner.
    evaluationJobStart?: boolean;
  }): Promise<string> {
    const { instituteName, createdByUsername, recordDrafts, evaluationJobStart = true } = params;

    if (!this.evaluationJobDb) {
      // Without job db, we can't provide polling visibility; fail fast to avoid silent sync fallback.
      throw new Error("evaluation job db unavailable");
    }

    const jobUuid = randomUUID();

    // 1) create job row
    await this.evaluationJobDb.insert(evaluationJobsTable).values({
      uuid: jobUuid,
      instituteName,
      createdByUsername,
      status: "pending",
      progressPercent: 0,
      errorMessage: "",
      recordUuid: "",
      cancelRequested: 0
    });

    // 2) create job items only（评估一条加一条）
    // - enqueue 时不提前创建 record 行
    // - runner 进入 item i 时再创建该条 record 占位，并把 recordUuid 写回 evaluation_job_item
    for (let i = 0; i < recordDrafts.length; i++) {
      await this.evaluationJobDb.insert(evaluationJobItemsTable).values({
        uuid: randomUUID(),
        evaluationJobUuid: jobUuid,
        itemSeqNo: i,
        itemStatus: "pending",
        recordUuid: "",
        errorMessage: ""
      });
    }

    // 3) runner (async, cooperative cancel)
    if (evaluationJobStart) {
      setImmediate(async () => {
        try {
          const total = recordDrafts.length;
          let completed = 0;
          let anyFailed = false;

          const cancelAndMarkRemaining = async () => {
            const remainingItems = await this.evaluationJobDb!.select({
              recordUuid: evaluationJobItemsTable.recordUuid
            }).from(evaluationJobItemsTable).where(and(
              eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
              inArray(evaluationJobItemsTable.itemStatus, ["pending", "evaluating"])
            ));

            const recordUuidsToDelete = remainingItems
              .map((it) => String(it.recordUuid ?? ""))
              .filter((uuid) => uuid.length > 0);
            if (recordUuidsToDelete.length > 0) {
              await this.recordPort.deleteByUuids(recordUuidsToDelete);
            }

            await this.evaluationJobDb!.update(evaluationJobsTable).set({
              status: "cancelled",
              progressPercent: 100,
              errorMessage: ""
            }).where(eq(evaluationJobsTable.uuid, jobUuid));

            await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
              itemStatus: "cancelled",
              recordUuid: "",
              errorMessage: ""
            }).where(and(
              eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
              inArray(evaluationJobItemsTable.itemStatus, ["pending", "evaluating"])
            ));
          };

          await this.evaluationJobDb!.update(evaluationJobsTable).set({
            status: "evaluating",
            progressPercent: 0,
            errorMessage: ""
          }).where(eq(evaluationJobsTable.uuid, jobUuid));

          for (let i = 0; i < recordDrafts.length; i++) {
            const jobNow = await this.evaluationJobDb!.select({
              cancelRequested: evaluationJobsTable.cancelRequested
            }).from(evaluationJobsTable).where(eq(evaluationJobsTable.uuid, jobUuid));

            if (jobNow[0]?.cancelRequested) {
              await cancelAndMarkRemaining();
              return;
            }

            // Batch pacing: pause 1s between items (except the first one).
            if (i > 0) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const jobAfterGap = await this.evaluationJobDb!.select({
                cancelRequested: evaluationJobsTable.cancelRequested
              }).from(evaluationJobsTable).where(eq(evaluationJobsTable.uuid, jobUuid));
              if (jobAfterGap[0]?.cancelRequested) {
                await cancelAndMarkRemaining();
                return;
              }
            }

            const draft = recordDrafts[i]!;
            try {
              await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
                itemStatus: "evaluating",
                recordUuid: "",
                errorMessage: ""
              }).where(and(
                eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
                eq(evaluationJobItemsTable.itemSeqNo, i)
              ));

              console.log("evaluating", i);
              const probability = await this.recordEvaluator.evaluate(draft);
              console.log("evaluated", i);
              const jobAfter = await this.evaluationJobDb!.select({
                cancelRequested: evaluationJobsTable.cancelRequested
              }).from(evaluationJobsTable).where(eq(evaluationJobsTable.uuid, jobUuid));

              if (jobAfter[0]?.cancelRequested) {
                await cancelAndMarkRemaining();
                return;
              }

              const created = await this.createRecordWithResult(draft, probability);

              await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
                itemStatus: "succeeded",
                recordUuid: created.uuid,
                errorMessage: ""
              }).where(and(
                eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
                eq(evaluationJobItemsTable.itemSeqNo, i)
              ));
            } catch (error) {
              anyFailed = true;
              const reason = error instanceof Error ? error.message : String(error);
              await this.evaluationJobDb!.update(evaluationJobItemsTable).set({
                itemStatus: "failed",
                errorMessage: reason
              }).where(and(
                eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
                eq(evaluationJobItemsTable.itemSeqNo, i)
              ));
            }

            completed++;
            const progressPercent = Math.round((completed / total) * 100);
            await this.evaluationJobDb!.update(evaluationJobsTable).set({
              progressPercent
            }).where(eq(evaluationJobsTable.uuid, jobUuid));
          }

          await this.evaluationJobDb!.update(evaluationJobsTable).set({
            status: anyFailed ? "failed" : "succeeded",
            progressPercent: 100,
            errorMessage: anyFailed ? "one or more items failed" : ""
          }).where(eq(evaluationJobsTable.uuid, jobUuid));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await this.evaluationJobDb!.update(evaluationJobsTable).set({
            status: "failed",
            progressPercent: 100,
            errorMessage: reason
          }).where(eq(evaluationJobsTable.uuid, jobUuid));
        }
      });
    }

    return jobUuid;
  }

  async getEvaluationJobStatus(params: { jobUuid: string; instituteName: string }) {
    if (!this.evaluationJobDb) {
      throw new Error("evaluation job db unavailable");
    }
    const { jobUuid, instituteName } = params;

    const jobRows = await this.evaluationJobDb
      .select()
      .from(evaluationJobsTable)
      .where(and(eq(evaluationJobsTable.uuid, jobUuid), eq(evaluationJobsTable.instituteName, instituteName)));

    const job = jobRows[0];
    if (!job) {
      return null;
    }

    const items = await this.evaluationJobDb
      .select()
      .from(evaluationJobItemsTable)
      .where(eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid))
      .orderBy(evaluationJobItemsTable.itemSeqNo);

    return {
      jobUuid: String(job.uuid),
      instituteName: String(job.instituteName),
      status: String(job.status),
      progressPercent: Number(job.progressPercent ?? 0),
      recordUuid: String(job.recordUuid ?? ""),
      errorMessage: String(job.errorMessage ?? ""),
      items: items.map((it) => ({
        itemSeqNo: Number(it.itemSeqNo),
        itemStatus: String(it.itemStatus),
        recordUuid: String(it.recordUuid ?? ""),
        errorMessage: String(it.errorMessage ?? "")
      }))
    };
  }

  async cancelEvaluationJob(params: { jobUuid: string; createdByUsername: string }): Promise<void> {
    if (!this.evaluationJobDb) {
      throw new Error("evaluation job db unavailable");
    }
    const { jobUuid, createdByUsername } = params;
    const updatedJobs = await this.evaluationJobDb
      .update(evaluationJobsTable)
      .set({
        cancelRequested: 1,
        status: "cancelled",
        progressPercent: 100,
        errorMessage: ""
      })
      .where(and(
        eq(evaluationJobsTable.uuid, jobUuid),
        eq(evaluationJobsTable.createdByUsername, createdByUsername)
      ));

    // 未命中（jobUuid 不属于当前用户）则不更新 item，避免越权。
    if (!updatedJobs) {
      return;
    }

    // 立即把 pending/evaluating 的 item 标记为 cancelled，
    // 即使当前 python 仍在跑，也不会再写回结果（runner 里会二次检查 cancelRequested）。
    const cancellableItems = await this.evaluationJobDb.select({
      recordUuid: evaluationJobItemsTable.recordUuid
    }).from(evaluationJobItemsTable).where(and(
      eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
      inArray(evaluationJobItemsTable.itemStatus, ["pending", "evaluating"])
    ));

    const recordUuidsToDelete = cancellableItems
      .map((it) => String(it.recordUuid ?? ""))
      .filter((uuid) => uuid.length > 0);
    if (recordUuidsToDelete.length > 0) {
      await this.recordPort.deleteByUuids(recordUuidsToDelete);
    }

    await this.evaluationJobDb.update(evaluationJobItemsTable).set({
      itemStatus: "cancelled",
      recordUuid: "",
      errorMessage: ""
    }).where(and(
      eq(evaluationJobItemsTable.evaluationJobUuid, jobUuid),
      inArray(evaluationJobItemsTable.itemStatus, ["pending", "evaluating"])
    ));
  }

  async listRecords(params: Parameters<RecordRepositoryPort["list"]>[0]) {
    return listRecords(params, this.recordPort);
  }

  async deleteRecords(uuids: string[]) {
    return deleteRecords(uuids, this.recordPort);
  }

  async updateRecord(record: RecordUpdate) {
    return updateRecord(record, this.recordPort);
  }
}
