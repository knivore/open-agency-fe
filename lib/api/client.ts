import { ApiError } from '@/lib/api/errors';

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue | QueryValue[]>;
type ResponseType = 'json' | 'text' | 'raw';

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  baseUrl?: string;
  query?: QueryParams;
  body?: unknown;
  timeoutMs?: number;
  responseType?: ResponseType;
  authToken?: string | null;
  includeAuthToken?: boolean;
}

export interface ApiClientOptions {
  baseUrl?: string;
  defaultHeaders?: HeadersInit;
  includeAuthToken?: boolean;
  timeoutMs?: number;
  credentials?: RequestCredentials;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function buildUrl(path: string, query?: QueryParams, baseUrl?: string) {
  const isAbsolute = /^https?:\/\//i.test(path);
  const normalizedBaseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const rawUrl = isAbsolute ? path : `${normalizedBaseUrl}${normalizedPath}`;
  const url = new URL(rawUrl, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            url.searchParams.append(key, String(item));
          }
        }
        continue;
      }

      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return isAbsolute || normalizedBaseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

function mergeAbortSignals(signal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

async function parseResponseBody(response: Response, responseType: ResponseType) {
  if (responseType === 'raw') {
    return response;
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';

  if (responseType === 'text') {
    return response.text();
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(status: number, payload: unknown) {
  if (isPlainObject(payload)) {
    const candidates = [payload.message, payload.detail, payload.error];
    const message = candidates.find((value) => typeof value === 'string');
    if (message) {
      return message;
    }
  }

  if (status === 401) {
    return 'Authentication required.';
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status >= 500) {
    return 'The server failed to process the request.';
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return 'Request failed.';
}

function normalizeError(response: Response, payload: unknown) {
  const code =
    isPlainObject(payload) && typeof payload.code === 'string'
      ? payload.code
      : isPlainObject(payload) && typeof payload.errorCode === 'string'
        ? payload.errorCode
        : undefined;

  const details =
    isPlainObject(payload) && Object.prototype.hasOwnProperty.call(payload, 'details')
      ? payload.details
      : isPlainObject(payload) && Object.prototype.hasOwnProperty.call(payload, 'detail')
        ? payload.detail
        : undefined;

  return new ApiError({
    status: response.status,
    message: getErrorMessage(response.status, payload),
    code,
    details,
    raw: payload,
  });
}

export function createApiClient(options: ApiClientOptions = {}) {
  const {
    baseUrl = '',
    defaultHeaders,
    includeAuthToken = true,
    timeoutMs = 15000,
    credentials = 'include',
  } = options;

  async function request<T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const {
      query,
      body,
      headers,
      signal,
      timeoutMs: requestTimeoutMs = timeoutMs,
      responseType = 'json',
      authToken,
      includeAuthToken: shouldIncludeAuthToken = includeAuthToken,
      baseUrl: requestBaseUrl,
      ...init
    } = requestOptions;

    const url = buildUrl(path, query, requestBaseUrl ?? baseUrl);
    const combinedHeaders = new Headers(defaultHeaders);

    if (headers) {
      new Headers(headers).forEach((value, key) => combinedHeaders.set(key, value));
    }

    let resolvedBody: BodyInit | undefined;

    if (body !== undefined && body !== null) {
      if (body instanceof FormData || body instanceof URLSearchParams || typeof body === 'string' || body instanceof Blob || body instanceof ArrayBuffer) {
        resolvedBody = body;
      } else {
        combinedHeaders.set('Content-Type', 'application/json');
        resolvedBody = JSON.stringify(body);
      }
    }

    if (!combinedHeaders.has('Accept') && responseType === 'json') {
      combinedHeaders.set('Accept', 'application/json');
    }

    const timeout = mergeAbortSignals(signal, requestTimeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        body: resolvedBody,
        headers: combinedHeaders,
        credentials,
        signal: timeout.signal,
      });

      const payload = await parseResponseBody(response, responseType);

      if (!response.ok) {
        throw normalizeError(response, payload);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError({
          status: 408,
          message: 'The request timed out or was cancelled.',
          code: 'REQUEST_ABORTED',
          raw: error,
        });
      }

      throw new ApiError({
        status: 0,
        message: error instanceof Error ? error.message : 'Network request failed.',
        code: 'NETWORK_ERROR',
        raw: error,
      });
    } finally {
      timeout.cleanup();
    }
  }

  return {
    request,
    get: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: ApiRequestOptions['body'], options?: ApiRequestOptions) =>
      request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: ApiRequestOptions['body'], options?: ApiRequestOptions) =>
      request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T>(path: string, body?: ApiRequestOptions['body'], options?: ApiRequestOptions) =>
      request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T>(path: string, options?: ApiRequestOptions) =>
      request<T>(path, { ...options, method: 'DELETE' }),
  };
}
