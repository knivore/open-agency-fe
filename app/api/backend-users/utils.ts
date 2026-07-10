import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { backendUsersApi } from '@/lib/api/backend/users';
import { isApiError } from '@/lib/api/errors';
import type { AuthUser } from '@/types/auth';

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await auth();
  const user = session?.user as AuthUser | undefined;
  if (!user?.id || !user.email) {
    return null;
  }
  return user;
}

export function getInternalApiKey() {
  return (
    process.env.AGENCY_FE_BFF_IDENTITY_KEY ||
    process.env.AGENCY_INTERNAL_API_KEY ||
    process.env.BACKEND_INTERNAL_API_KEY ||
    null
  );
}

export function unauthorizedResponse() {
  return NextResponse.json({ message: 'Unauthorized', status: 401 }, { status: 401 });
}

export function proxyErrorResponse(error: unknown) {
  if (isApiError(error)) {
    const status = error.status >= 200 && error.status <= 599 ? error.status : 502;
    return NextResponse.json(
      { message: error.message, status, upstreamStatus: error.status, code: error.code, details: error.details },
      { status }
    );
  }
  const message = error instanceof Error ? error.message : 'Backend user request failed.';
  return NextResponse.json({ message, status: 500 }, { status: 500 });
}

export async function syncCurrentBackendUser(user: AuthUser) {
  return backendUsersApi.syncCurrentUser(user, getInternalApiKey());
}
