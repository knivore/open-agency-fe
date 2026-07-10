import { NextResponse } from 'next/server';
import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import type { PhysicalEventBusHealth } from '@/lib/api/backend/physicalDevices';
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

    const payload = await agencyApiClient.get<PhysicalEventBusHealth>(
      backendRoutes.physicalDevices.eventBusHealth(),
      {
        headers: currentUserHeaders(user, getInternalApiKey()),
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
