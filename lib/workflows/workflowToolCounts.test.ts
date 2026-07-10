import { describe, expect, it } from 'vitest';
import {
  workflowAssignedToolIds,
  workflowToolBindingCount,
} from '@/lib/workflows/workflowToolCounts';
import type { WorkflowDefinition } from '@/types/workflows';

describe('workflow tool counts', () => {
  it('returns unique assigned tools across agents and tasks', () => {
    const workflow: WorkflowDefinition = {
      id: 'workflow-1',
      name: 'Workflow',
      agent_definitions: [
        {
          id: 'agent-1',
          name: 'Researcher',
          tool_ids: ['agency.http.request'],
        },
        {
          id: 'agent-2',
          name: 'Publisher',
          tool_ids: ['agency.discord.post'],
        },
        {
          id: 'agent-3',
          name: 'Validator',
          tool_ids: ['agency.browser.verify-content'],
        },
      ],
      task_definitions: [
        {
          id: 'task-1',
          name: 'Research',
          description: 'Fetch source material.',
          agent_id: 'agent-1',
          tool_ids: ['agency.http.request'],
        },
        {
          id: 'task-2',
          name: 'Publish',
          description: 'Send the final update.',
          agent_id: 'agent-2',
          tool_ids: ['agency.discord.post'],
        },
        {
          id: 'task-3',
          name: 'Validate',
          description: 'Check the output.',
          agent_id: 'agent-3',
          tool_ids: ['agency.browser.verify-content'],
        },
      ],
      tool_definitions: [
        {
          id: 'agency.http.request',
          name: 'HTTP request',
          description: 'Makes an HTTP request.',
        },
      ],
    };

    expect(workflowAssignedToolIds(workflow)).toEqual([
      'agency.http.request',
      'agency.discord.post',
      'agency.browser.verify-content',
    ]);
    expect(workflowToolBindingCount(workflow)).toBe(3);
  });

  it('counts unassigned task tools as task-scoped bindings', () => {
    const workflow: WorkflowDefinition = {
      id: 'workflow-1',
      name: 'Workflow',
      agent_definitions: [],
      task_definitions: [
        {
          id: 'task-1',
          name: 'Research',
          description: 'Fetch source material.',
          tool_ids: ['agency.http.request'],
        },
      ],
    };

    expect(workflowAssignedToolIds(workflow)).toEqual(['agency.http.request']);
    expect(workflowToolBindingCount(workflow)).toBe(1);
  });
});
