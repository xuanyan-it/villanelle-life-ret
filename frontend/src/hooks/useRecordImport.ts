import { useCallback, useState } from "react";
import type { SampleRecordRequestPayload } from "../types";
import { csv2ObjectArr } from "../utils/recordParser";
type ImportStatus = "idle" | "parsing" | "error";
type ImportTransform = (
  record: SampleRecordRequestPayload
) => SampleRecordRequestPayload;
export const useRecordImport = () => {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [error, setError] = useState<unknown>(null);
  const [records, setRecords] = useState<SampleRecordRequestPayload[]>([]);
  const [filename, setFilename] = useState<string>("");
  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setRecords([]);
    setFilename("");
  }, []);
  const parseFile = useCallback(
    async (file: File, transform?: ImportTransform) => {
      setStatus("parsing");
      setError(null);
      try {
        const data = await csv2ObjectArr(file);
        const next = transform ? data.map(transform) : data;
        setRecords(next);
        setFilename(file.name);
        setStatus("idle");
        return next;
      } catch (err) {
        setError(err);
        setStatus("error");
        throw err;
      }
    },
    []
  );
  return {
    status,
    error,
    records,
    filename,
    reset,
    parseFile,
  };
};
