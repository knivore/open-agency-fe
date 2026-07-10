import { NextResponse } from 'next/server';
import { backendApiTokensApi } from '@/lib/api/backend/apiTokens';
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
    await syncCurrentBackendUser(user);
    const scopes = await backendApiTokensApi.listScopes(user, getInternalApiKey());
    return NextResponse.json(scopes);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
