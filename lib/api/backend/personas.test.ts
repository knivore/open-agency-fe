import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personasApi } from '@/lib/api/backend/personas';

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/lib/api/clientInstances', () => ({
  agencyApiClient: {
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}));

describe('personasApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses canonical persona and persona-factory routes', async () => {
    getMock.mockResolvedValue({ items: [] });
    postMock.mockResolvedValue({ ok: true });
    patchMock.mockResolvedValue({ ok: true });

    await personasApi.listPersonas();
    await personasApi.getGovernanceLabels();
    await personasApi.getItemTypes();
    await personasApi.distill({
      name: 'Audit Persona',
      source_memory_ids: ['memory-1'],
      persona_type: 'professional',
    });
    await personasApi.updateItem('item-1', { title: 'Reviewed item' } as never);
    await personasApi.approveItem('item-1');
    await personasApi.rejectItem('item-2', 'Duplicate');
    await personasApi.normalizeRun('run-1');
    await personasApi.synthesizeRun('run-1');
    await personasApi.updateRunPackage('run-1', { schema_version: 1 } as never);
    await personasApi.approveRun('run-1');
    await personasApi.publishRun('run-1');
    await personasApi.rollbackVersion('persona-1', 'version-1');
    await personasApi.listWorkflowUsages('persona-1');

    expect(getMock).toHaveBeenCalledWith('/persona', { query: { include_archived: undefined } });
    expect(getMock).toHaveBeenCalledWith('/persona-factory/governance-labels');
    expect(getMock).toHaveBeenCalledWith('/persona-factory/item-types');
    expect(postMock).toHaveBeenCalledWith('/persona-factory/distill', {
      name: 'Audit Persona',
      source_memory_ids: ['memory-1'],
      persona_type: 'professional',
    });
    expect(patchMock).toHaveBeenCalledWith('/persona-factory/items/item-1', {
      patch: { title: 'Reviewed item' },
    });
    expect(postMock).toHaveBeenCalledWith('/persona-factory/items/item-1/approve', {});
    expect(postMock).toHaveBeenCalledWith('/persona-factory/items/item-2/reject', {
      reason: 'Duplicate',
    });
    expect(postMock).toHaveBeenCalledWith('/persona-factory/runs/run-1/normalize', {});
    expect(postMock).toHaveBeenCalledWith('/persona-factory/runs/run-1/synthesize-package', {});
    expect(patchMock).toHaveBeenCalledWith('/persona-factory/runs/run-1/package', {
      package: { schema_version: 1 },
    });
    expect(postMock).toHaveBeenCalledWith('/persona-factory/runs/run-1/approve', {});
    expect(postMock).toHaveBeenCalledWith('/persona-factory/runs/run-1/publish', {});
    expect(postMock).toHaveBeenCalledWith('/persona/persona-1/versions/version-1/rollback', {});
    expect(getMock).toHaveBeenCalledWith('/persona/persona-1/workflow-usages');
  });
});
