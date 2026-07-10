import { NextRequest, NextResponse } from 'next/server';
import { agencyApiClient } from '@/lib/api/clientInstances';
import { backendRoutes } from '@/lib/api/backend/routes';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import type { SmartHomeEntityListPayload } from '@/lib/api/backend/smartHome';
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

    const upstreamUrl = new URL(backendRoutes.smartHome.entities(), 'http://agency.internal');
    const domain = request.nextUrl.searchParams.get('domain');
    const roomName = request.nextUrl.searchParams.get('room_name');

    if (domain) {
      upstreamUrl.searchParams.set('domain', domain);
    }
    if (roomName) {
      upstreamUrl.searchParams.set('room_name', roomName);
    }

    const payload = await agencyApiClient.get<SmartHomeEntityListPayload>(
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
