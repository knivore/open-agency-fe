import { NextResponse } from 'next/server';
import { backendCredentialsApi } from '@/lib/api/backend/credentials';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ providerKey: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { providerKey } = await params;
    const capability = await backendCredentialsApi.getConnectorCredentialSchema(providerKey, user, getInternalApiKey());
    return NextResponse.json(capability);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
