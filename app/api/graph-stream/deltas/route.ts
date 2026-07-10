import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';
import { getAgencyApiBaseUrl } from '@/lib/api/config';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';

export async function GET(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const backendBaseUrl = getAgencyApiBaseUrl();
  if (!backendBaseUrl) {
    return NextResponse.json(
      { message: 'Backend API base URL is not configured for graph streaming.', status: 503 },
      { status: 503 }
    );
  }

  const incomingUrl = new URL(req.url);
  const streamUrl = new URL(
    `${backendBaseUrl.replace(/\/+$/, '')}${backendRoutes.graphStream.deltas()}`
  );
  streamUrl.search = incomingUrl.search;

  const response = await fetch(streamUrl, {
    headers: {
      ...currentUserHeaders(user, getInternalApiKey()),
      Accept: 'text/event-stream',
      ...(req.headers.get('last-event-id')
        ? { 'Last-Event-ID': req.headers.get('last-event-id') as string }
        : {}),
    },
    cache: 'no-store',
  });

  if (!response.body) {
    return NextResponse.json(
      { message: 'Backend graph stream returned no response body.', status: 502 },
      { status: 502 }
    );
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
