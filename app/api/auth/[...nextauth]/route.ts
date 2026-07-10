import { NextRequest } from 'next/server';
import { handlers } from '@/auth';

function normalizeLocalDevAuthHost(request: NextRequest) {
  const headers = new Headers(request.headers);
  const forwardedHost = headers.get('x-forwarded-host');
  const host = headers.get('host');
  const url = new URL(request.url);

  if (host && forwardedHost?.replace(/:\d+$/, '') === '0.0.0.0') {
    headers.set('x-forwarded-host', host);
  }

  if (host && url.hostname === '0.0.0.0') {
    url.host = host;
  }

  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method: request.method,
    headers,
    body: request.body,
    // Required by Node's Request implementation when forwarding a streamed body.
    duplex: 'half',
  };

  return new NextRequest(url, init);
}

export function GET(request: NextRequest) {
  return handlers.GET(normalizeLocalDevAuthHost(request));
}

export function POST(request: NextRequest) {
  return handlers.POST(normalizeLocalDevAuthHost(request));
}
