export interface BaseResponse<T = any, M = any> {
  code: 0 | 1;
  status: "success" | "error";
  payload: T[];
  meta: Record<string, M>;
  error?: string;
  message?: string;
}

export interface QueryResponseData<T = any> {
  total: number;
  result: T[];
}
