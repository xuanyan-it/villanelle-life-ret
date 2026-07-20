import type { UserState} from "../../types";
import { RequestStatus,UserRole } from "../../types";
export const initialState: UserState = {
  uuid: "",
  instituteName: "",
  username: "",
  email: "",
  userRole: null,
  status: RequestStatus.None,
};
