import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const {
  currentUserHeaders,
  fetchMock,
  getAgencyApiBaseUrl,
  getAuthenticatedUser,
  getInternalApiKey,
} = vi.hoisted(() => ({
  currentUserHeaders: vi.fn(),
  fetchMock: vi.fn(),
  getAgencyApiBaseUrl: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  getInternalApiKey: vi.fn(),
}));

vi.mock('@/app/api/backend-users/utils', () => ({
  getAuthenticatedUser,
  getInternalApiKey,
  unauthorizedResponse: () => Response.json({ message: 'Unauthorized' }, { status: 401 }),
}));

vi.mock('@/lib/api/config', () => ({
  getAgencyApiBaseUrl,
}));

vi.mock('@/lib/api/backend/identity', () => ({
  currentUserHeaders,
}));

const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  accessToken: null,
  authMode: 'dev' as const,
};

describe('graph stream delta BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    getAgencyApiBaseUrl.mockReturnValue('http://backend.test');
    currentUserHeaders.mockReturnValue({
      'x-agency-user-id': 'user-1',
      'x-agency-internal-api-key': 'internal-key',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated graph stream requests', async () => {
    getAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/graph-stream/deltas?execution_id=run-1')
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards identity headers and streams backend SSE bytes', async () => {
    fetchMock.mockResolvedValue(
      new Response('event: graph_delta\ndata: {"ok":true}\n\n', {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
        },
      })
    );

    const response = await GET(
      new Request('http://localhost/api/graph-stream/deltas?execution_id=run-1&poll_seconds=1', {
        headers: {
          'last-event-id': 'projection-event-1',
        },
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://backend.test/graph/stream/deltas?execution_id=run-1&poll_seconds=1'),
      {
        headers: {
          'x-agency-user-id': 'user-1',
          'x-agency-internal-api-key': 'internal-key',
          Accept: 'text/event-stream',
          'Last-Event-ID': 'projection-event-1',
        },
        cache: 'no-store',
      }
    );
    expect(currentUserHeaders).toHaveBeenCalledWith(user, 'internal-key');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    await expect(response.text()).resolves.toBe('event: graph_delta\ndata: {"ok":true}\n\n');
  });

  it('returns service unavailable when no backend base URL is configured', async () => {
    getAgencyApiBaseUrl.mockReturnValue('');

    const response = await GET(new Request('http://localhost/api/graph-stream/deltas'));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      message: 'Backend API base URL is not configured for graph streaming.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves backend error status and body for stream failures', async () => {
    fetchMock.mockResolvedValue(
      new Response('upstream failed', {
        status: 502,
        headers: {
          'content-type': 'text/plain',
        },
      })
    );

    const response = await GET(new Request('http://localhost/api/graph-stream/deltas'));

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toBe('text/plain');
    await expect(response.text()).resolves.toBe('upstream failed');
  });
});
