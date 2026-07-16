import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backendUsersApi } from '@/lib/api/backend/users';

const { agencyGetMock, agencyPostMock } = vi.hoisted(() => ({
  agencyGetMock: vi.fn(),
  agencyPostMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: agencyGetMock,
    post: agencyPostMock,
  },
  appApiClient: {},
}));

const user = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  accessToken: 'agt-session',
  authMode: 'dev' as const,
};

describe('backendUsersApi identity forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes trusted user claims when synchronizing the current user', async () => {
    agencyPostMock.mockResolvedValue({ id: user.id });

    await backendUsersApi.syncCurrentUser(user, 'internal-key');

    expect(agencyPostMock).toHaveBeenCalledWith(
      '/users/sync',
      expect.objectContaining({ id: user.id, email: user.email }),
      {
        headers: expect.objectContaining({
          'x-agency-user-id': user.id,
          'x-agency-user-email': user.email,
          'x-agency-internal-api-key': 'internal-key',
        }),
      }
    );
  });

  it.each([
    ['getUser', () => backendUsersApi.getUser('target-user', user, 'internal-key')],
    ['searchUsers', () => backendUsersApi.searchUsers('target@example.com', user, 'internal-key')],
  ])('includes trusted user claims for %s', async (_name, request) => {
    agencyGetMock.mockResolvedValue({});

    await request();

    const options = agencyGetMock.mock.calls.at(-1)?.at(-1);
    expect(options).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-agency-user-id': user.id,
          'x-agency-internal-api-key': 'internal-key',
        }),
      })
    );
  });
});
