import { NextRequest, NextResponse } from 'next/server';
import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import type { PhysicalDeviceListPayload } from '@/lib/api/backend/physicalDevices';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }

    await syncCurrentBackendUser(user);

    const upstreamUrl = new URL(backendRoutes.physicalDevices.list(), 'http://agency.internal');
    for (const key of [
      'type',
      'capability',
      'room',
      'zone',
      'owner_id',
      'location_id',
      'lifecycle_status',
      'online',
    ]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null) {
        upstreamUrl.searchParams.set(key, value);
      }
    }

    const payload = await agencyApiClient.get<PhysicalDeviceListPayload>(
      upstreamUrl.pathname + upstreamUrl.search,
      {
        headers: currentUserHeaders(user, getInternalApiKey()),
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    return proxyErrorResponse(error);
  }
}
