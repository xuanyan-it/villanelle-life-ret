import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import {
  ElectronInstituteCreateRequestSchema,
  ElectronInstituteCredentialRequestSchema,
  ElectronInstituteListRequestSchema,
  ElectronInstituteRegisterRequestSchema,
  ElectronInstituteVerifyRequestSchema,
  ElectronUserCreateRequestSchema,
  ElectronUserDeleteRequestSchema,
  ElectronUserListRequestSchema,
  ElectronUserLoginRequestSchema
} from "../contracts/request.schemas";

import {
  createInstitute,
  createUser,
  deleteUsersByUuids,
  ensureInstitute,
  getInstituteByName,
  hasLocalUsers,
  listInstitutes,
  listUsers,
  verifyInstituteToken,
  verifyUser,
} from "../database";

import type { IpcContext } from "./context";
import { createIpcHandlerFactory } from "./handlerFactory";

export const registerAuthHandlers = (context: Pick<IpcContext, "authSession" | "onLoginSuccess" | "onLogout">) => {
  const { registerEnvelope, registerRaw } = createIpcHandlerFactory(context);

  const triggerLoginSuccess = () => {
    if (!context.onLoginSuccess) {
      return;
    }
    try {
      const ret = context.onLoginSuccess();
      if (ret && typeof (ret as Promise<void>).then === "function") {
        void (ret as Promise<void>).catch((error) => {
          console.warn("[worker] async warmup failed", error);
        });
      }
    } catch (error) {
      console.warn("[worker] async warmup failed", error);
    }
  };

  registerEnvelope(
    "userCreate",
    {
      schema: ElectronUserCreateRequestSchema,
      fallbackMessage: SharedClientErrorMessage.userCreateFailed,
      preserveProtectedErrors: false
    },
    async (payload) => {
      const { instituteName, username, email, password, userRole } = payload;
      const institute = await ensureInstitute(instituteName);
      if (!institute) {
        throw new Error(SharedClientErrorMessage.instituteNotFound);
      }
      const user = await createUser({
        instituteName,
        username,
        email,
        password,
        userRole,
      });
      if (!user) {
        throw new Error(SharedClientErrorMessage.userCreateFailed);
      }
      context.authSession.markAuthenticated({
        username: user.username,
        instituteName: user.instituteName
      });
      triggerLoginSuccess();
      return [
        {
          uuid: user.uuid,
          instituteName: user.instituteName,
          username: user.username,
          email: user.email,
          userRole: user.userRole,
          status: "success",
        },
      ];
    }
  );

  registerEnvelope(
    "userLogin",
    {
      schema: ElectronUserLoginRequestSchema,
      fallbackMessage: SharedClientErrorMessage.loginFailed,
      preserveProtectedErrors: false
    },
    async (payload) => {
      const user = await verifyUser(payload.email, payload.password);
      if (!user) {
        throw new Error(SharedClientErrorMessage.invalidCredentials);
      }
      context.authSession.markAuthenticated({
        username: user.username,
        instituteName: user.instituteName
      });
      triggerLoginSuccess();
      return [
        {
          uuid: user.uuid,
          instituteName: user.instituteName,
          username: user.username,
          email: user.email,
          userRole: user.userRole,
          status: "success",
        },
      ];
    }
  );

  registerRaw(
    "userLogout",
    {},
    async () => {
      context.authSession.clear();
      if (context.onLogout) {
        await context.onLogout();
      }
      return true;
    }
  );

  registerEnvelope(
    "instituteList",
    {
      schema: ElectronInstituteListRequestSchema,
      requireAuth: true,
      fallbackMessage: SharedClientErrorMessage.requestFailed
    },
    async (filters) => {
      const rows = await listInstitutes(filters);
      return [
        {
          total: rows.length,
          result: rows.map((row) => ({
            uuid: row.uuid,
            instituteName: row.instituteName,
            token: row.token
          }))
        }
      ];
    }
  );

  registerEnvelope(
    "instituteCreate",
    {
      schema: ElectronInstituteCreateRequestSchema,
      fallbackMessage: SharedClientErrorMessage.requestFailed,
      preserveProtectedErrors: false
    },
    async ({ instituteName }) => {
      const institute = await createInstitute(instituteName);
      if (!institute) {
        throw new Error(SharedClientErrorMessage.requestFailed);
      }
      return [
        {
          uuid: institute.uuid,
          instituteName: institute.instituteName,
          token: institute.token
        }
      ];
    }
  );

  registerEnvelope(
    "instituteRegister",
    {
      schema: ElectronInstituteRegisterRequestSchema,
      fallbackMessage: SharedClientErrorMessage.requestFailed,
      preserveProtectedErrors: false
    },
    async (payload) => {
      const institute = await createInstitute(payload.instituteName);
      const user = await createUser({
        instituteName: payload.instituteName,
        username: payload.username,
        email: payload.email,
        password: payload.password,
        userRole: "administrator"
      });
      if (!institute || !user) {
        throw new Error(SharedClientErrorMessage.requestFailed);
      }
      context.authSession.markAuthenticated({
        username: user.username,
        instituteName: user.instituteName
      });
      triggerLoginSuccess();
      return [
        {
          uuid: user.uuid,
          instituteName: user.instituteName,
          username: user.username,
          email: user.email,
          userRole: user.userRole,
          status: "success"
        }
      ];
    }
  );

  registerEnvelope(
    "userList",
    {
      schema: ElectronUserListRequestSchema,
      requireAuth: true,
      fallbackMessage: SharedClientErrorMessage.listUsersFailed
    },
    async (filters) => {
      const rows = await listUsers(filters);
      return [
        {
          total: rows.length,
          result: rows,
        },
      ];
    }
  );

  registerEnvelope(
    "getInstituteCredential",
    {
      schema: ElectronInstituteCredentialRequestSchema,
      requireAuth: true,
      fallbackMessage: SharedClientErrorMessage.getInstituteCredentialFailed
    },
    async ({ instituteName }) => {
      const institute = await getInstituteByName(instituteName);
      return [
        {
          total: institute ? 1 : 0,
          result: institute
            ? [
                {
                  uuid: institute.uuid,
                  instituteName: institute.instituteName,
                  token: institute.token,
                },
              ]
            : [],
        },
      ];
    }
  );

  registerEnvelope(
    "verifyInstituteToken",
    {
      schema: ElectronInstituteVerifyRequestSchema,
      fallbackMessage: SharedClientErrorMessage.invalidToken,
      preserveProtectedErrors: false
    },
    async ({ token }) => {
      const rows = await verifyInstituteToken(token);
      return [
        {
          total: rows.length,
          result: rows.map((row) => ({
            uuid: row.uuid,
            instituteName: row.instituteName,
            token: row.token
          }))
        }
      ];
    }
  );

  registerEnvelope(
    "userDelete",
    {
      schema: ElectronUserDeleteRequestSchema,
      requireAuth: true,
      fallbackMessage: SharedClientErrorMessage.deleteFailed
    },
    async (payload) => {
      const uuids = payload.map((item) => item.uuid);
      await deleteUsersByUuids(uuids);
      return [true];
    }
  );

  registerRaw("isBootstrapRequired", {}, async () => {
    return !(await hasLocalUsers());
  });
};
