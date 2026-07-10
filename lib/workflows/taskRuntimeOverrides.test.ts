import { describe, expect, it } from 'vitest';
import {
  normalizeWorkflowTaskRuntimeOverrides,
  workflowTaskRuntimeOverridePatch,
  workflowTaskMetadataWithRuntimeOverrides,
  workflowTaskRuntimeOverridesFromMetadata,
  workflowTaskRuntimeOverridesFromTask,
} from '@/lib/workflows/taskRuntimeOverrides';

describe('task runtime overrides', () => {
  it('normalizes supported task runtime override fields', () => {
    expect(
      normalizeWorkflowTaskRuntimeOverrides({
        timeout_seconds: '120.9',
        max_retries: '0',
        model_profile_id: ' profile-1 ',
        max_tokens: 4096.8,
        approval_policy: 'required',
        ignored: 'value',
      })
    ).toEqual({
      timeout_seconds: 120,
      max_retries: 0,
      model_profile_id: 'profile-1',
      max_tokens: 4096,
      approval_policy: 'required',
    });
  });

  it('reads and removes task runtime override metadata', () => {
    const metadata = workflowTaskMetadataWithRuntimeOverrides(
      { existing: true },
      {
        timeout_seconds: 60,
        approval_policy: 'none',
      }
    );

    expect(metadata).toEqual({
      existing: true,
      task_runtime_overrides: {
        timeout_seconds: 60,
        approval_policy: 'none',
      },
    });
    expect(workflowTaskRuntimeOverridesFromMetadata(metadata)).toEqual({
      timeout_seconds: 60,
      approval_policy: 'none',
    });
    expect(workflowTaskMetadataWithRuntimeOverrides(metadata, {})).toEqual({ existing: true });
  });

  it('prefers first-class task runtime override fields over legacy metadata', () => {
    expect(
      workflowTaskRuntimeOverridesFromTask({
        timeout_seconds: 120,
        max_retries: 0,
        model_profile_id: 'profile-first-class',
        max_tokens: 2048,
        approval_policy: 'required',
        metadata: {
          task_runtime_overrides: {
            timeout_seconds: 60,
            model_profile_id: 'profile-legacy',
            approval_policy: 'none',
          },
        },
      })
    ).toEqual({
      timeout_seconds: 120,
      max_retries: 0,
      model_profile_id: 'profile-first-class',
      max_tokens: 2048,
      approval_policy: 'required',
    });
  });

  it('builds a promoted task patch and removes legacy runtime override metadata', () => {
    expect(
      workflowTaskRuntimeOverridePatch(
        {
          existing: true,
          task_runtime_overrides: {
            timeout_seconds: 60,
          },
        },
        {
          timeout_seconds: 90,
          approval_policy: 'required',
        }
      )
    ).toEqual({
      timeout_seconds: 90,
      max_retries: null,
      model_profile_id: null,
      max_tokens: null,
      approval_policy: 'required',
      metadata: { existing: true },
    });
  });
});
