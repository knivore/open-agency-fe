import { describe, expect, it } from 'vitest';
import { preferredWorkflowRuntimeAdapterId } from '@/lib/workflows/runtimeAdapterSelection';

describe('preferredWorkflowRuntimeAdapterId', () => {
  it('prefers native when a workflow allows it even if another adapter is the default', () => {
    expect(preferredWorkflowRuntimeAdapterId(['crewai', 'native'], 'crewai')).toBe('native');
  });

  it('uses the workflow default when native is unavailable and the default is allowed', () => {
    expect(preferredWorkflowRuntimeAdapterId(['crewai'], 'crewai')).toBe('crewai');
  });

  it('falls back to the first allowed adapter when the default is not allowed', () => {
    expect(preferredWorkflowRuntimeAdapterId(['adapter-a'], 'crewai')).toBe('adapter-a');
  });
});
