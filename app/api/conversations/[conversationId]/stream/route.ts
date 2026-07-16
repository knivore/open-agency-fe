import { NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';
import { currentUserHeaders } from '@/lib/api/backend/identity';
import { backendRoutes } from '@/lib/api/backend/routes';
import { getAgencyApiBaseUrl } from '@/lib/api/config';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const userPromise = getAuthenticatedUser();
  const paramsPromise = params;
  const backendBaseUrl = getAgencyApiBaseUrl();
  const [user, { conversationId }] = await Promise.all([userPromise, paramsPromise]);

  if (!user) {
    return unauthorizedResponse();
  }

  if (!backendBaseUrl) {
    return NextResponse.json(
      {
        message: 'Backend API base URL is not configured for conversation streaming.',
        status: 503,
      },
      { status: 503 }
    );
  }

  const incomingUrl = new URL(request.url);
  const streamUrl = new URL(
    `${backendBaseUrl.replace(/\/+$/, '')}${backendRoutes.conversations.stream(conversationId)}`
  );
  streamUrl.search = incomingUrl.search;

  // EventSource cannot attach the trusted identity headers used by regular API fetches,
  // so the authenticated BFF owns the upstream stream connection.
  const response = await fetch(streamUrl, {
    headers: {
      ...currentUserHeaders(user, getInternalApiKey()),
      Accept: 'text/event-stream',
      ...(request.headers.get('last-event-id')
        ? { 'Last-Event-ID': request.headers.get('last-event-id') as string }
        : {}),
    },
    cache: 'no-store',
    signal: request.signal,
  });

  if (!response.body) {
    return NextResponse.json(
      { message: 'Backend conversation stream returned no response body.', status: 502 },
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
