import { NextResponse } from 'next/server';
import { backendApiTokensApi } from '@/lib/api/backend/apiTokens';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const token = await backendApiTokensApi.revokeToken(id, user, getInternalApiKey());
    return NextResponse.json(token);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
