import {NextResponse} from 'next/server';
import {agencyApiClient} from '@/lib/api/clientInstances';
import {currentUserHeaders} from '@/lib/api/backend/identity';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

type Context = { params: Promise<{ action?: string[] }> };

async function proxy(request: Request, context: Context, method: 'GET' | 'POST') {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();
    const {action = []} = await context.params;
    const download =
      method === 'GET' &&
      action.length === 2 &&
      action[0] === 'download' &&
      ['chrome', 'windows', 'windows-installer', 'macos', 'macos-installer'].includes(action[1]);
    const snapshot =
      method === 'GET' &&
      action.length === 2 &&
      action[0] === 'chrome-snapshots' &&
      /^[A-Za-z0-9_-]{20,64}$/.test(action[1]);
    const view = method === 'POST' && action.length === 1 && action[0] === 'chrome-view';
    if (action.length && !download && !snapshot && !view)
      return NextResponse.json({detail: 'Unknown local access action'}, {status: 404});
    await syncCurrentBackendUser(user);
    const path = `/local-access${download ? `/download/${action[1]}` : snapshot ? `/chrome-snapshots/${action[1]}` : view ? '/chrome-view' : ''}`;
    const options = {
      headers: currentUserHeaders(user, getInternalApiKey()),
      ...(view ? {timeoutMs: 70000} : {}),
    };
    if (download || snapshot) {
      const result = await agencyApiClient.get<Response>(path, {...options, responseType: 'raw'});
      return new NextResponse(await result.arrayBuffer(), {
        headers: {
          'Content-Type': snapshot
            ? 'image/jpeg'
            : action[1].endsWith('-installer')
              ? 'text/plain; charset=utf-8'
              : 'application/zip',
          ...(download
            ? {'Content-Disposition': result.headers.get('Content-Disposition') || 'attachment'}
            : {}),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        },
      });
    }
    const result =
      method === 'GET'
        ? await agencyApiClient.get(path, options)
        : await agencyApiClient.post(path, await request.json(), options);
    return NextResponse.json(result, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return proxyErrorResponse(error);
  }
}

export function GET(request: Request, context: Context) {
  return proxy(request, context, 'GET');
}

export function POST(request: Request, context: Context) {
  return proxy(request, context, 'POST');
}
