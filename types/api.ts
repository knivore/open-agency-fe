export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface CrudListResponse<T> {
  items: T[];
}

export interface DeleteResponse {
  deleted: boolean;
  id: string;
}

export interface HealthResponse {
  ok: boolean;
}

export interface DatabaseHealthResponse extends HealthResponse {
  configured?: boolean;
  detail?: string;
}

export interface RootInfoResponse {
  message: string;
  docs?: string;
  openapi?: string;
  redoc?: string;
}

export interface ValidationErrorItem {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export interface BackendErrorResponse {
  detail?: string | ValidationErrorItem[];
  message?: string;
  error?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
  raw?: unknown;
}
