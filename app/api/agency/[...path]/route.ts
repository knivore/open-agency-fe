import {currentUserHeaders} from '@/lib/api/backend/identity';
import {getAgencyApiBaseUrl} from '@/lib/api/config';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type', 'last-event-id', 'range'];
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

async function proxy(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return unauthorizedResponse();
  }

  // The backend identity bridge creates the user on first use. Do this before
  // forwarding normal API calls so a fresh local/dev session is immediately usable.
  await syncCurrentBackendUser(user);

  const {path} = await context.params;
  if (!path.length) {
    return Response.json({message: 'Backend path is required.'}, {status: 400});
  }

  const backendBaseUrl = getAgencyApiBaseUrl().replace(/\/+$/, '');
  const upstreamUrl = new URL(`${backendBaseUrl}/${path.join('/')}`);
  upstreamUrl.search = new URL(request.url).search;

  const headers = new Headers(currentUserHeaders(user, getInternalApiKey()));
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(name.toLowerCase())) {
      responseHeaders.set(name, value);
    }
  });
  return new Response(upstream.body, {status: upstream.status, headers: responseHeaders});
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
