import { describe, expect, it } from 'vitest';
import {
  buildSyntheticMainAgentRun,
  MAIN_AGENT_SYNTHETIC_RUN_ID,
} from '@/components/runs/lib/mainAgentPresence';

describe('buildSyntheticMainAgentRun', () => {
  it('keeps the main agent visible without a default workflow and lets it roam when idle', () => {
    const run = buildSyntheticMainAgentRun({
      mainAgent: {
        id: 'main-agent',
        name: 'Main Agent',
        description: 'Executive coordinator',
        agent_id: 'agent-main',
        default_workflow_id: '',
        updated_at: '2026-05-09T08:00:00.000Z',
      },
      workflowName: null,
      hasActiveWorkflowRun: false,
      now: new Date('2026-05-09T09:00:00.000Z').getTime(),
    });

    expect(run.id).toBe(MAIN_AGENT_SYNTHETIC_RUN_ID);
    expect(run.workflowId).toBeNull();
    expect(run.status).toBe('paused');
    expect(run.runtimeAdapterId).toBe('office-open-workspace');
    expect(run.metadata?.office_presence_kind).toBe('ambient_agent');
    expect(run.metadata?.office_activity).toBe('walking');
    expect(run.metadata?.office_agent_names).toEqual(['Main Agent']);
  });

  it('places the main agent in the executive room while a workflow is active', () => {
    const run = buildSyntheticMainAgentRun({
      mainAgent: {
        id: 'main-agent',
        name: 'Main Agent',
        description: 'Executive coordinator',
        agent_id: 'agent-main',
        default_workflow_id: 'workflow-main',
        updated_at: '2026-05-09T08:00:00.000Z',
      },
      workflowName: 'Default Workflow',
      hasActiveWorkflowRun: true,
      now: new Date('2026-05-09T09:00:00.000Z').getTime(),
    });

    expect(run.status).toBe('running');
    expect(run.runtimeAdapterId).toBe('office-executive-room');
    expect(run.metadata?.office_presence_kind).toBe('main_agent');
    expect(run.metadata?.office_activity).toBe('typing');
    expect(run.metadata?.office_run_title).toBe('Default Workflow');
    expect(run.metadata?.office_active_agent_names).toEqual(['Main Agent']);
  });
});
