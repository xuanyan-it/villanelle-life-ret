import type { AdminState} from "../../types";
import { RequestStatus } from "../../types";
export const initialState: AdminState = {
  total: 0,
  userList: [],
  token: "",
  status: RequestStatus.None,
};
