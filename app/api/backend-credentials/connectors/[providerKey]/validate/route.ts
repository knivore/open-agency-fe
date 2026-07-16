import { NextResponse } from 'next/server';
import { backendCredentialsApi } from '@/lib/api/backend/credentials';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function POST(req: Request, { params }: { params: Promise<{ providerKey: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { providerKey } = await params;
    const payload = await req.json();
    const validation = await backendCredentialsApi.validateConnectorCredential(
      providerKey,
      payload,
      user,
      getInternalApiKey()
    );
    return NextResponse.json(validation);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
