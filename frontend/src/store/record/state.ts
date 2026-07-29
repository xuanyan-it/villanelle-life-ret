import type { RecordState} from "../../types";
import { RequestStatus } from "../../types";
export const DEFAULT_PAGE_SIZE = 15;
export const initialState: RecordState = {
  status: RequestStatus.None,
  total: 0,
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  deletedOnly: false,
  searchKeyword: "",
  activeFetchRequestId: undefined,
  recordList: [],
  selectedRowsByPage: [],
  testQueueLength: 0,
  testQueue: [],
  evaluationProgressPercent: null,
};
