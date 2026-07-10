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

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }

    await syncCurrentBackendUser(user);

    const url = new URL(req.url);
    const result = await backendConnectorsApi.getAggregateConnectorHistory(
      currentUserHeaders(user, getInternalApiKey()),
      {
        limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
        offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
        provider: url.searchParams.get('provider') ?? undefined,
        status: url.searchParams.get('status') ?? undefined,
        started_after: url.searchParams.get('started_after') ?? undefined,
        started_before: url.searchParams.get('started_before') ?? undefined,
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
