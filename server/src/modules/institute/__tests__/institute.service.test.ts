import { describe, expect, it, vi } from "vitest";

import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import {
  createInstitute,
  createUser,
  listInstitutes,
  verifyInstituteToken,
} from "@villanelle/ret-shared/application";
import { PersistenceConflictError } from "../../persistence/persistence.repository.types";
import { InstituteService } from "../institute.service";

vi.mock("@villanelle/ret-shared/application", () => ({
  createInstitute: vi.fn(),
  createUser: vi.fn(),
  listInstitutes: vi.fn(),
  verifyInstituteToken: vi.fn(),
}));

describe("InstituteService", () => {
  const instituteRepoStub = () => ({
    // used by institutePort.list()
    listInstitutes: vi.fn(),
    createInstitute: vi.fn(),
    verifyToken: vi.fn(),

    // used by createUserRepositoryPort (only needed if shared createUser calls ports)
    listUsers: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserByUsername: vi.fn(),
    loginUser: vi.fn(),
    createUser: vi.fn(),

    // used by createRecordRepositoryPort (not needed here)
    listRecords: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecords: vi.fn(),
    deleteUsers: vi.fn(),
  });

  const configStub = {
    get: (_key: string, fallback?: unknown) => fallback,
  } as any;

  it("delegates listInstitutes to shared application", async () => {
    const repo = instituteRepoStub();
    const listInstitutesMock = listInstitutes as unknown as ReturnType<typeof vi.fn>;
    (listInstitutesMock as any).mockResolvedValue({ total: 1, result: [{ token: "t1" }] });

    const service = new InstituteService(repo as any, configStub);
    const result = await service.listInstitutes({ instituteName: "Demo" });

    expect(result).toEqual({ total: 1, result: [{ token: "t1" }] });
    expect(listInstitutesMock).toHaveBeenCalled();
  });

  it("maps createInstitute PersistenceConflictError(instituteName) to instituteExists", async () => {
    const repo = instituteRepoStub();
    const createInstituteMock = createInstitute as unknown as ReturnType<typeof vi.fn>;
    (createInstituteMock as any).mockRejectedValue(
      new PersistenceConflictError("instituteName")
    );

    const service = new InstituteService(repo as any, configStub);
    const result = await service.createInstitute("Demo");

    expect(result).toEqual({ error: SharedClientErrorMessage.instituteExists });
  });

  it("rethrows createInstitute errors that are not persistence conflicts", async () => {
    const repo = instituteRepoStub();
    const createInstituteMock = createInstitute as unknown as ReturnType<typeof vi.fn>;
    (createInstituteMock as any).mockRejectedValue(new Error("boom"));

    const service = new InstituteService(repo as any, configStub);
    await expect(service.createInstitute("Demo")).rejects.toThrow("boom");
  });

  it("registerInstitute returns instituteExists when institute already exists", async () => {
    const repo = instituteRepoStub();
    repo.listInstitutes.mockResolvedValue({ total: 1, result: [] });

    const service = new InstituteService(repo as any, configStub);
    const result = await service.registerInstitute({
      instituteName: "Demo",
      email: "a@b.com",
      username: "alice",
      password: "pass",
    });

    expect(result).toEqual({ error: SharedClientErrorMessage.instituteExists });
    expect((createUser as any as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("registerInstitute returns mapped conflict errors for instituteName", async () => {
    const repo = instituteRepoStub();
    repo.listInstitutes.mockResolvedValue({ total: 0, result: [] });

    (createUser as any).mockRejectedValue(
      new PersistenceConflictError("instituteName")
    );

    const service = new InstituteService(repo as any, configStub);
    const result = await service.registerInstitute({
      instituteName: "Demo",
      email: "a@b.com",
      username: "alice",
      password: "pass",
    });

    expect(result).toEqual({ error: SharedClientErrorMessage.instituteExists });
  });

  it("registerInstitute returns mapped conflict errors for email", async () => {
    const repo = instituteRepoStub();
    repo.listInstitutes.mockResolvedValue({ total: 0, result: [] });

    (createUser as any).mockRejectedValue(new PersistenceConflictError("email"));

    const service = new InstituteService(repo as any, configStub);
    const result = await service.registerInstitute({
      instituteName: "Demo",
      email: "a@b.com",
      username: "alice",
      password: "pass",
    });

    expect(result).toEqual({ error: SharedClientErrorMessage.emailExists });
  });

  it("registerInstitute returns mapped conflict errors for username", async () => {
    const repo = instituteRepoStub();
    repo.listInstitutes.mockResolvedValue({ total: 0, result: [] });

    (createUser as any).mockRejectedValue(new PersistenceConflictError("username"));

    const service = new InstituteService(repo as any, configStub);
    const result = await service.registerInstitute({
      instituteName: "Demo",
      email: "a@b.com",
      username: "alice",
      password: "pass",
    });

    expect(result).toEqual({ error: SharedClientErrorMessage.usernameExists });
  });

  it("registerInstitute rethrows errors that are not persistence conflicts", async () => {
    const repo = instituteRepoStub();
    repo.listInstitutes.mockResolvedValue({ total: 0, result: [] });

    (createUser as any).mockRejectedValue(new Error("network"));

    const service = new InstituteService(repo as any, configStub);
    await expect(
      service.registerInstitute({
        instituteName: "Demo",
        email: "a@b.com",
        username: "alice",
        password: "pass",
      })
    ).rejects.toThrow("network");
  });

  it("registerInstitute returns shared business error when createUser resolves with { error }", async () => {
    const repo = instituteRepoStub();
    repo.listInstitutes.mockResolvedValue({ total: 0, result: [] });

    (createUser as any).mockResolvedValue({ error: SharedClientErrorMessage.emailExists });

    const service = new InstituteService(repo as any, configStub);
    const result = await service.registerInstitute({
      instituteName: "Demo",
      email: "a@b.com",
      username: "alice",
      password: "pass",
    });

    expect(result).toEqual({ error: SharedClientErrorMessage.emailExists });
  });

  it("registerInstitute returns { data } when createUser resolves with { data }", async () => {
    const repo = instituteRepoStub();
    repo.listInstitutes.mockResolvedValue({ total: 0, result: [] });

    (createUser as any).mockResolvedValue({
      data: {
        uuid: "u1",
        instituteName: "Demo",
        username: "alice",
        email: "a@b.com",
        accessToken: "token-1",
        userRole: "administrator",
      },
    });

    const service = new InstituteService(repo as any, configStub);
    const result = await service.registerInstitute({
      instituteName: "Demo",
      email: "a@b.com",
      username: "alice",
      password: "pass",
    });

    expect("data" in result).toBe(true);
    expect((result as any).data.uuid).toBe("u1");
  });

  it("delegates verifyInstituteToken to shared application", async () => {
    const repo = instituteRepoStub();
    (verifyInstituteToken as any).mockResolvedValue({
      total: 1,
      result: [{ token: "t-ok" }],
    });

    const service = new InstituteService(repo as any, configStub);
    const result = await service.verifyInstituteToken("token-ok");

    expect(result).toEqual({ total: 1, result: [{ token: "t-ok" }] });
    expect(verifyInstituteToken).toHaveBeenCalled();
  });
});

