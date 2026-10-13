import {beforeEach, describe, expect, it, vi} from 'vitest';
import {GET} from './route';

const mocks = vi.hoisted(() => ({get: vi.fn(), user: vi.fn(), sync: vi.fn()}));
vi.mock('@/lib/api/clientInstances', () => ({agencyApiClient: {get: mocks.get}}));
vi.mock('@/lib/api/backend/identity', () => ({
  currentUserHeaders: () => ({'x-agency-user-id': 'owner'}),
}));
vi.mock('@/app/api/backend-users/utils', () => ({
  getAuthenticatedUser: mocks.user,
  getInternalApiKey: () => null,
  syncCurrentBackendUser: mocks.sync,
  unauthorizedResponse: () => Response.json({detail: 'Unauthorized'}, {status: 401}),
  proxyErrorResponse: () => Response.json({detail: 'Failed'}, {status: 500}),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({id: 'owner'});
  mocks.sync.mockResolvedValue({});
});
describe('local setup installer proxy', () => {
  it.each([
    ['windows', 'ps1'],
    ['macos', 'command'],
  ])(
    'preserves %s installer bytes and filename under authenticated owner identity',
    async (platform, extension) => {
      mocks.get.mockResolvedValue(
        new Response('synthetic-installer', {
          headers: {
            'Content-Disposition': `attachment; filename="Install-AgencyConnect.${extension}"`,
          },
        })
      );
      const result = await GET(
        new Request(`http://localhost/api/local-access/download/${platform}-installer`),
        {params: Promise.resolve({action: ['download', `${platform}-installer`]})}
      );
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('synthetic-installer');
      expect(result.headers.get('Content-Type')).toContain('text/plain');
      expect(result.headers.get('Content-Disposition')).toContain(
        `Install-AgencyConnect.${extension}`
      );
      expect(result.headers.get('Cache-Control')).toBe('no-store');
      expect(mocks.get).toHaveBeenCalledWith(
        `/local-access/download/${platform}-installer`,
        expect.objectContaining({headers: {'x-agency-user-id': 'owner'}, responseType: 'raw'})
      );
    }
  );
  it('denies signed-out and unknown download routes without backend access', async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect(
      (
        await GET(new Request('http://localhost/api/local-access/download/windows-installer'), {
          params: Promise.resolve({action: ['download', 'windows-installer']}),
        })
      ).status
    ).toBe(401);
    expect(
      (
        await GET(new Request('http://localhost/api/local-access/download/secrets'), {
          params: Promise.resolve({action: ['download', 'secrets']}),
        })
      ).status
    ).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
