import { vi, type Mock, type Mocked } from "vitest";
const axios: {
  get: Mock;
  post: Mock;
  put: Mock;
  delete: Mock;
  patch: Mock;
  create: Mock;
  interceptors: {
    request: { use: Mock; eject: Mock };
    response: { use: Mock; eject: Mock };
  };
} = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  create: vi.fn(),
  interceptors: {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() },
  },
};
axios.create.mockReturnValue(axios);
export default axios;
