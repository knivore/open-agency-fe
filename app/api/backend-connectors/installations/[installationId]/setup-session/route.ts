import { NextResponse } from 'next/server';
import { backendConnectorsApi } from '@/lib/api/backend/connectors';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ installationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();
    await syncCurrentBackendUser(user);
    const { installationId } = await params;
    const result = await backendConnectorsApi.resumeConnectorSetupSession(
      installationId,
      currentUserHeaders(user, getInternalApiKey())
    );
    return NextResponse.json(result);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
