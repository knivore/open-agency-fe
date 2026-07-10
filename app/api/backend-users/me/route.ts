import { NextResponse } from 'next/server';
import { backendUsersApi } from '@/lib/api/backend/users';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }

    try {
      const backendUser = await backendUsersApi.getCurrentUser(user, getInternalApiKey());
      return NextResponse.json(backendUser);
    } catch {
      const syncedUser = await syncCurrentBackendUser(user);
      return NextResponse.json(syncedUser);
    }
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
