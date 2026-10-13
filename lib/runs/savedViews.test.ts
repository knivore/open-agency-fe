import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSavedRunViews,
  createSavedRunView,
  readSavedRunViews,
  removeSavedRunView,
  saveRunView,
} from '@/lib/runs/savedViews';

describe('saved run views', () => {
  beforeEach(() => clearSavedRunViews());

  it('creates a readable label and avoids duplicate filters', () => {
    const first = saveRunView(createSavedRunView('certificate', 'failed'));
    const duplicate = saveRunView(createSavedRunView('certificate', 'failed'));

    expect(first.label).toBe('failed · certificate');
    expect(duplicate.id).toBe(first.id);
    expect(readSavedRunViews()).toHaveLength(1);
  });

  it('retains workflow and date filters without colliding with legacy views', () => {
    const legacy = saveRunView(createSavedRunView('', 'failed'));
    const filtered = saveRunView(
      createSavedRunView('', 'failed', {
        workflowId: 'workflow-1',
        workflowLabel: 'Research',
        dateRange: '7',
      })
    );
    const duplicate = saveRunView(
      createSavedRunView('', 'failed', { workflowId: 'workflow-1', dateRange: '7' })
    );
    expect(filtered.id).not.toBe(legacy.id);
    expect(duplicate.id).toBe(filtered.id);
    expect(filtered).toMatchObject({ workflowId: 'workflow-1', dateRange: '7' });
    expect(filtered.label).toContain('Research');
    expect(readSavedRunViews()).toHaveLength(2);
  });

  it('removes a saved view without changing the active filters', () => {
    const view = saveRunView(createSavedRunView('', 'running'));
    removeSavedRunView(view.id);
    expect(readSavedRunViews()).toEqual([]);
  });

  it('persists the composite active-runs filter', () => {
    const view = saveRunView(createSavedRunView('', 'active'));

    expect(view.label).toBe('active');
    expect(readSavedRunViews()).toEqual([expect.objectContaining({ status: 'active' })]);
  });
});
