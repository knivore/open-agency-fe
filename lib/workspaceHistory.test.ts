import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearWorkspaceHistory,
  readWorkspaceHistory,
  rememberWorkspaceItem,
} from '@/lib/workspaceHistory';

describe('workspace history', () => {
  beforeEach(() => {
    clearWorkspaceHistory();
  });

  it('keeps the latest visit first and removes duplicate paths', () => {
    rememberWorkspaceItem({ path: '/workflows', label: 'Workflows', visitedAt: '2026-01-01' });
    rememberWorkspaceItem({ path: '/runs', label: 'Runs', visitedAt: '2026-01-02' });
    rememberWorkspaceItem({
      path: '/workflows',
      label: 'Workflow library',
      visitedAt: '2026-01-03',
    });

    expect(readWorkspaceHistory()).toEqual([
      {
        path: '/workflows',
        label: 'Workflow library',
        visitedAt: '2026-01-03',
      },
      { path: '/runs', label: 'Runs', visitedAt: '2026-01-02' },
    ]);
  });

  it('caps history at eight items', () => {
    for (let index = 0; index < 10; index += 1) {
      rememberWorkspaceItem({ path: `/route-${index}`, label: `Route ${index}` });
    }

    expect(readWorkspaceHistory()).toHaveLength(8);
    expect(readWorkspaceHistory()[0]?.path).toBe('/route-9');
  });
});
