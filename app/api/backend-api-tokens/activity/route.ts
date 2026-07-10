import { NextResponse } from 'next/server';
import { backendApiTokensApi } from '@/lib/api/backend/apiTokens';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || '10');
    const activity = await backendApiTokensApi.listActivity(user, getInternalApiKey(), limit);
    return NextResponse.json(activity);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
