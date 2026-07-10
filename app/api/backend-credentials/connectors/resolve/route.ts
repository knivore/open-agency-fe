import { NextResponse } from 'next/server';
import { backendCredentialsApi } from '@/lib/api/backend/credentials';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const payload = await req.json();
    const result = await backendCredentialsApi.resolveConnectorCredential(
      payload,
      user,
      getInternalApiKey()
    );
    return NextResponse.json(result);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
