import { randomUUID } from 'node:crypto';
import { getAgencyApiBaseUrl } from '@/lib/api/config';
import type { LoginRequest, LoginResponse, User } from '@/types/auth';

type BackendUserPayload = {
  id?: unknown;
  user_id?: unknown;
  sub?: unknown;
  email?: unknown;
  name?: unknown;
  display_name?: unknown;
  image?: unknown;
  avatar_url?: unknown;
};

type BackendLoginPayload = BackendUserPayload & {
  access_token?: unknown;
  accessToken?: unknown;
  token?: unknown;
  user?: BackendUserPayload;
};

const DEFAULT_LOGIN_PATHS = ['/auth/login', '/api/auth/login'];
const DEFAULT_ME_PATHS = ['/auth/me', '/api/auth/me', '/me'];

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured for dev auth.`);
  }
  return value;
}

function assertDevAuthEnabled() {
  const isEnabled =
    process.env.NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_APP_ENV === 'local';

  if (!isEnabled) {
    throw new Error('Dev auth is disabled.');
  }
}

function authPaths(envName: string, defaults: string[]) {
  const configured = process.env[envName]?.trim();
  if (!configured) {
    return defaults;
  }

  return configured
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);
}

function backendAuthBaseUrl() {
  const baseUrl = getAgencyApiBaseUrl();
  return baseUrl || 'http://127.0.0.1:8000';
}

function backendAuthEnabled() {
  return process.env.AGENCY_DEV_AUTH_BACKEND_ENABLED !== 'false';
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeBackendUser(payload: BackendUserPayload | undefined): User | null {
  if (!payload) {
    return null;
  }

  const id = stringValue(payload.id) || stringValue(payload.user_id) || stringValue(payload.sub);
  const email = stringValue(payload.email)?.toLowerCase();
  if (!id || !email) {
    return null;
  }

  const name = stringValue(payload.name) || stringValue(payload.display_name) || email;
  const image = stringValue(payload.image) || stringValue(payload.avatar_url);

  return {
    id,
    name,
    email,
    image,
  };
}

function normalizeBackendLogin(payload: BackendLoginPayload): LoginResponse | null {
  const accessToken =
    stringValue(payload.access_token) ||
    stringValue(payload.accessToken) ||
    stringValue(payload.token);
  const user = normalizeBackendUser(payload.user || payload);

  if (!accessToken || !user) {
    return null;
  }

  return {
    accessToken,
    user,
  };
}

function buildBackendAuthUrl(path: string) {
  return new URL(path, `${backendAuthBaseUrl().replace(/\/+$/, '')}/`).toString();
}

function shouldUseLocalFallback(status: number) {
  return status === 404 || status === 405 || status === 501;
}

function isCredentialRejection(status: number) {
  return status === 400 || status === 401 || status === 403 || status === 422;
}

async function readJson(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text) as unknown;
}

async function requestBackendAuth(path: string, init: RequestInit) {
  try {
    const response = await fetch(buildBackendAuthUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });

    if (response.ok) {
      return { status: response.status, payload: await readJson(response) };
    }

    if (shouldUseLocalFallback(response.status) || isCredentialRejection(response.status)) {
      return { status: response.status, payload: null };
    }

    throw new Error(`Backend auth request failed with status ${response.status}.`);
  } catch (error) {
    if (error instanceof TypeError) {
      return { status: 0, payload: null };
    }
    throw error;
  }
}

async function loginWithBackendCredentials(
  credentials: LoginRequest
): Promise<{ result: LoginResponse | null; authoritative: boolean }> {
  if (!backendAuthEnabled()) {
    return { result: null, authoritative: false };
  }

  for (const path of authPaths('AGENCY_AUTH_LOGIN_PATH', DEFAULT_LOGIN_PATHS)) {
    const response = await requestBackendAuth(path, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.payload) {
      return {
        result: normalizeBackendLogin(response.payload as BackendLoginPayload),
        authoritative: true,
      };
    }

    if (isCredentialRejection(response.status)) {
      return { result: null, authoritative: true };
    }
  }

  return { result: null, authoritative: false };
}

async function getBackendCurrentUser(accessToken: string): Promise<User | null> {
  if (!backendAuthEnabled()) {
    return null;
  }

  for (const path of authPaths('AGENCY_AUTH_ME_PATH', DEFAULT_ME_PATHS)) {
    const response = await requestBackendAuth(path, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.payload) {
      return normalizeBackendUser(response.payload as BackendUserPayload);
    }

    if (isCredentialRejection(response.status)) {
      return null;
    }
  }

  return null;
}

function loginWithConfiguredDevCredentials(credentials: LoginRequest): LoginResponse | null {
  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  if (!email || !password) {
    return null;
  }

  const configuredEmail = getRequiredEnv('DEV_AUTH_EMAIL').trim().toLowerCase();
  const configuredPassword = getRequiredEnv('DEV_AUTH_PASSWORD');
  const configuredName = process.env.DEV_AUTH_NAME?.trim() || 'Dev User';
  const configuredUserId = process.env.DEV_AUTH_USER_ID?.trim() || 'dev-user';

  if (email !== configuredEmail || password !== configuredPassword) {
    return null;
  }

  return {
    accessToken: `dev-${randomUUID()}`,
    user: {
      id: configuredUserId,
      name: configuredName,
      email: configuredEmail,
      image: null,
    },
  };
}

export async function loginWithDevCredentials(
  credentials: LoginRequest
): Promise<LoginResponse | null> {
  assertDevAuthEnabled();

  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  if (!email || !password) {
    return null;
  }

  const backendLogin = await loginWithBackendCredentials({ email, password });
  if (backendLogin.authoritative) {
    return backendLogin.result;
  }

  // Keep the env-backed login as a compatibility bridge for local backend
  // versions that have not exposed the auth endpoints yet.
  return loginWithConfiguredDevCredentials({ email, password });
}

export async function getDevCurrentUser(accessToken: string): Promise<User | null> {
  if (!accessToken) {
    return null;
  }

  if (!accessToken.startsWith('dev-')) {
    return getBackendCurrentUser(accessToken);
  }

  return {
    id: process.env.DEV_AUTH_USER_ID?.trim() || 'dev-user',
    name: process.env.DEV_AUTH_NAME?.trim() || 'Dev User',
    email: getRequiredEnv('DEV_AUTH_EMAIL').trim().toLowerCase(),
    image: null,
  } satisfies User;
}
