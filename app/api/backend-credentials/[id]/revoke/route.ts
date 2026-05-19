import { NextResponse } from 'next/server';
import { backendCredentialsApi } from '@/lib/api/backend';
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
    const credential = await backendCredentialsApi.revokeCredential(id, user, getInternalApiKey());
    return NextResponse.json(credential);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
