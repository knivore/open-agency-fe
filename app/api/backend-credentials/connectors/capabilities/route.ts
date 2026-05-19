import { NextResponse } from 'next/server';
import { agencyApiClient } from '@/lib/api';
import { backendRoutes } from '@/lib/api/backend';
import type { ConnectorCapabilitiesPayload } from '@/types/integrations';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

function currentUserHeaders(user: Awaited<ReturnType<typeof getAuthenticatedUser>>, internalApiKey?: string | null): HeadersInit {
  if (!user) {
    return {};
  }

  return {
    'x-agency-user-id': user.id,
    'x-agency-user-email': user.email,
    'x-agency-user-name': user.name,
    'x-agency-auth-provider': user.authMode === 'dev' ? 'dev-auth' : 'nextauth',
    'x-agency-provider-subject': user.id,
    'x-agency-provider-account-id': user.email,
    ...(internalApiKey ? { 'x-agency-internal-api-key': internalApiKey } : {}),
  };
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }

    await syncCurrentBackendUser(user);

    const payload = await agencyApiClient.get<ConnectorCapabilitiesPayload>(
      backendRoutes.connectorRegistry.capabilities(),
      {
        headers: currentUserHeaders(user, getInternalApiKey()),
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
