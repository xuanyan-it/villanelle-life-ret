import { electronApi } from "./electronApi";
import type { ApiType } from "./types";
import { isElectronRuntime } from "../platform/runtime";
import { webApi } from "./webApi";
/* runtime check */
const isElectron = isElectronRuntime();
export const api: ApiType = isElectron
  ? electronApi
  : webApi;
