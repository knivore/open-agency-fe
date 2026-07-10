import { describe, expect, it } from 'vitest';
import {
  workflowTaskInputSourcesFromMetadata,
  workflowTaskMetadataWithInputSources,
} from '@/lib/workflows/taskInputSources';

describe('taskInputSources', () => {
  it('reads only supported task input source ids from metadata', () => {
    expect(
      workflowTaskInputSourcesFromMetadata({
        task_input_sources: ['memory', 'unsupported', 'human_input', 42],
      })
    ).toEqual(['memory', 'human_input']);
  });

  it('writes task input source metadata without dropping unrelated metadata', () => {
    expect(
      workflowTaskMetadataWithInputSources({ task_template_id: 'research' }, [
        'previous_task_output',
        'uploaded_documents',
      ])
    ).toEqual({
      task_template_id: 'research',
      task_input_sources: ['previous_task_output', 'uploaded_documents'],
    });
  });
});
