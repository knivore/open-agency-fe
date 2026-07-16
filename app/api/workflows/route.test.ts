import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/workflows/route';

const { backendWorkflowsApi, getAuthenticatedUser, getInternalApiKey, syncCurrentBackendUser } =
  vi.hoisted(() => ({
    backendWorkflowsApi: { listWorkflows: vi.fn() },
    getAuthenticatedUser: vi.fn(),
    getInternalApiKey: vi.fn(),
    syncCurrentBackendUser: vi.fn(),
  }));

vi.mock('@/lib/api/backend/workflows', () => ({ backendWorkflowsApi }));
vi.mock('@/app/api/backend-users/utils', () => ({
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse: vi.fn(),
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

describe('GET /api/workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUser.mockResolvedValue(user);
    getInternalApiKey.mockReturnValue('internal-key');
    syncCurrentBackendUser.mockResolvedValue({});
    backendWorkflowsApi.listWorkflows.mockResolvedValue({
      items: [{ id: 'workflow-1', metadata: { owner_ids: [user.id] } }],
    });
  });

  it('uses the authenticated backend workflow client', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(syncCurrentBackendUser).toHaveBeenCalledWith(user);
    expect(backendWorkflowsApi.listWorkflows).toHaveBeenCalledWith(user, 'internal-key');
    await expect(response.json()).resolves.toMatchObject({
      workflows: [expect.objectContaining({ id: 'workflow-1' })],
    });
  });
});
