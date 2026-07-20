import { beforeEach, describe, expect, it, vi } from "vitest";

const postgresRepositoryCtorMock = vi.fn();

vi.mock("../persistence.repository.postgres", () => ({
  PostgresPersistenceRepository: function PostgresPersistenceRepository(this: unknown, ...args: unknown[]) {
    return postgresRepositoryCtorMock.apply(this, args);
  },
}));

describe("createPersistenceRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates postgres repository when DATABASE_URL is present", async () => {
    postgresRepositoryCtorMock.mockImplementation(function MockedRepo(this: { databaseUrl?: string }, databaseUrl: string) {
      this.databaseUrl = databaseUrl;
    });

    const configService = {
      get: vi.fn(() => "postgres://user:pass@localhost:5432/db"),
    } as any;

    const { createPersistenceRepository } = await import("../persistence.repository");
    const repository = createPersistenceRepository(configService);

    expect(configService.get).toHaveBeenCalledWith("DATABASE_URL");
    expect(postgresRepositoryCtorMock).toHaveBeenCalledWith("postgres://user:pass@localhost:5432/db");
    expect(repository).toBeTruthy();
  });

  it("throws when DATABASE_URL is missing", async () => {
    const configService = {
      get: vi.fn(() => undefined),
    } as any;

    const { createPersistenceRepository } = await import("../persistence.repository");

    expect(() => createPersistenceRepository(configService)).toThrow(/DATABASE_URL is required for persistence/);
  });
});
