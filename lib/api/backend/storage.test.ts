import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backendStorageApi } from '@/lib/api/backend/storage';

const { agencyPostMock } = vi.hoisted(() => ({ agencyPostMock: vi.fn() }));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: { post: agencyPostMock },
}));

const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  accessToken: null,
  authMode: 'dev' as const,
};

describe('backendStorageApi identity forwarding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes trusted user claims when requesting a presigned URL', async () => {
    agencyPostMock.mockResolvedValue({ url: 'https://storage.example/file' });

    await backendStorageApi.getPresignedUrl(
      { filename: 'file.txt', operation: 'download' },
      user,
      'internal-key'
    );

    expect(agencyPostMock).toHaveBeenCalledWith(
      '/storage/presigned',
      { filename: 'file.txt', operation: 'download' },
      {
        headers: expect.objectContaining({
          'x-agency-user-id': user.id,
          'x-agency-internal-api-key': 'internal-key',
        }),
      }
    );
  });
});
