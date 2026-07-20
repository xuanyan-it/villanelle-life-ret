import { registerAuthHandlers } from "./authHandlers";
import type { IpcContext } from "./context";
import { registerFileHandlers } from "./fileHandlers";
import { registerRecordHandlers } from "./recordHandlers";
import { registerSystemHandlers } from "./systemHandlers";

let handlersRegistered = false;

export const registerIpcHandlers = (context: IpcContext) => {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;
  registerAuthHandlers(context);
  registerFileHandlers(context);
  registerRecordHandlers(context);
  registerSystemHandlers(context);
};
