import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/file/route';

const { backendStorageApi, getAuthenticatedUser, getInternalApiKey, syncCurrentBackendUser } =
  vi.hoisted(() => ({
    backendStorageApi: { getPresignedUrl: vi.fn() },
    getAuthenticatedUser: vi.fn(),
    getInternalApiKey: vi.fn(),
    syncCurrentBackendUser: vi.fn(),
  }));

vi.mock('@/lib/api/backend/storage', () => ({ backendStorageApi }));
vi.mock('@/app/api/backend-users/utils', () => ({
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse: (error: unknown) =>
    Response.json({ message: error instanceof Error ? error.message : 'failed' }, { status: 500 }),
  syncCurrentBackendUser,
  unauthorizedResponse: () => Response.json({ message: 'Unauthorized' }, { status: 401 }),
}));

const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  accessToken: null,
  authMode: 'dev' as const,
};

describe('GET /api/file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    backendStorageApi.getPresignedUrl.mockResolvedValue({
      url: 'https://storage.example/file',
    });
  });

  it('forwards the authenticated identity for file capabilities', async () => {
    const response = await GET(new Request('http://localhost/api/file?key=documents/report.pdf'));

    expect(response.status).toBe(200);
    expect(syncCurrentBackendUser).toHaveBeenCalledWith(user);
    expect(backendStorageApi.getPresignedUrl).toHaveBeenCalledWith(
      { filename: 'documents/report.pdf', operation: 'download' },
      user,
      'internal-key'
    );
  });
});
