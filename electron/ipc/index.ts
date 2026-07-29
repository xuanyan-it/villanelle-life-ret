import { registerAuthHandlers } from "./authHandlers";
import type { IpcContext } from "./context";
import { registerFileHandlers } from "./fileHandlers";
import { registerRecordHandlers } from "./recordHandlers";
import { registerSystemHandlers } from "./systemHandlers";
import { registerUploadHandlers } from "./uploadHandlers";

let handlersRegistered = false;

export const registerIpcHandlers = (context: IpcContext) => {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;
  registerAuthHandlers(context);
  registerFileHandlers(context);
  registerUploadHandlers(context);
  registerRecordHandlers(context);
  registerSystemHandlers(context);
};
