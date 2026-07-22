import type { RecordRepositoryPort } from "../domain";
import { ensure, type QueryResult, type RecordDraft, type RecordUpdate, type SampleRecord } from "../domain";

export type EvaluateRecordFn = (record: RecordDraft) => string | Promise<string>;

export const createRecord = async (
  payload: RecordDraft,
  repository: Pick<RecordRepositoryPort, "create">,
  evaluate: EvaluateRecordFn
): Promise<SampleRecord> => {
  ensure(Boolean(payload.uploadId), "uploadId is required");
  ensure(Boolean(payload.slideFileName), "slideFileName is required");
  ensure(Boolean(payload.instituteName), "instituteName is required");
  const result = await evaluate(payload);
  return repository.create(payload, result);
};

export const listRecords = async (
  params: {
    instituteName: string;
    page: number;
    pageSize: number;
    deletedOnly?: boolean;
    searchKeyword?: string;
  },
  repository: Pick<RecordRepositoryPort, "list">
): Promise<QueryResult<SampleRecord>> => {
  ensure(Boolean(params.instituteName), "instituteName is required");
  return repository.list(params);
};

export const deleteRecords = async (
  uuids: string[],
  repository: Pick<RecordRepositoryPort, "deleteByUuids">
): Promise<boolean> => {
  ensure(uuids.length > 0, "uuids is required");
  return repository.deleteByUuids(uuids);
};

export const updateRecord = async (
  payload: RecordUpdate,
  repository: Pick<RecordRepositoryPort, "update">
): Promise<boolean> => {
  ensure(Boolean(payload.uuid), "uuid is required");
  ensure(Boolean(payload.uploadId), "uploadId is required");
  ensure(Boolean(payload.instituteName), "instituteName is required");
  return repository.update(payload);
};
