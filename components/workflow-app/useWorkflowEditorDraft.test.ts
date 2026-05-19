import { describe, expect, it } from 'vitest';
import { extractGraphNodePositions } from '@/components/workflow-app/useWorkflowEditorDraft';
import type { TaskDefinition } from '@/types/workflows';

function task(id: string, dependsOnTaskIds: string[] = []): TaskDefinition {
  return {
    id,
    name: id,
    description: '',
    depends_on_task_ids: dependsOnTaskIds,
  };
}

describe('extractGraphNodePositions', () => {
  it('replaces legacy compact positions with dependency-aware spacing', () => {
    const tasks = [task('task-a'), task('task-b', ['task-a']), task('task-c', ['task-a'])];

    expect(
      extractGraphNodePositions({
        task_definitions: tasks,
        nodes: [
          { task_id: 'task-a', metadata: { position: { x: 80, y: 60 } } },
          { task_id: 'task-b', metadata: { position: { x: 360, y: 60 } } },
          { task_id: 'task-c', metadata: { position: { x: 640, y: 60 } } },
        ],
      })
    ).toEqual({
      'task-a': { x: 80, y: 60 },
      'task-b': { x: 500, y: 60 },
      'task-c': { x: 500, y: 480 },
    });
  });

  it('preserves custom non-overlapping positions', () => {
    const tasks = [task('task-a'), task('task-b', ['task-a'])];

    expect(
      extractGraphNodePositions({
        task_definitions: tasks,
        nodes: [
          { task_id: 'task-a', metadata: { position: { x: 120, y: 140 } } },
          { task_id: 'task-b', metadata: { position: { x: 600, y: 420 } } },
        ],
      })
    ).toEqual({
      'task-a': { x: 120, y: 140 },
      'task-b': { x: 600, y: 420 },
    });
  });
});
