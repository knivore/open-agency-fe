import type { MainAgent, RunSessionSummary } from '@/types';

export const MAIN_AGENT_SYNTHETIC_RUN_ID = 'main-agent-presence';

const MAIN_AGENT_CHAT_ACTIVE_WINDOW_MS = 15 * 60 * 1000;

function toRecentLabel(value?: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  });
}

function isRecentActivity(value: string | null | undefined, now: number) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return now - timestamp <= MAIN_AGENT_CHAT_ACTIVE_WINDOW_MS;
}

export function buildSyntheticMainAgentRun(params: {
  mainAgent: MainAgent;
  workflowName?: string | null;
  hasActiveWorkflowRun: boolean;
  now?: number;
}): RunSessionSummary {
  const { mainAgent, workflowName, hasActiveWorkflowRun, now = Date.now() } = params;
  const hasRecentChatActivity = isRecentActivity(mainAgent.updated_at ?? mainAgent.created_at ?? null, now);
  const isWorking = hasActiveWorkflowRun || hasRecentChatActivity;
  const recentLabel = toRecentLabel(mainAgent.updated_at ?? mainAgent.created_at ?? null);
  const mainAgentName = mainAgent.name?.trim() || 'Main Agent';
  const workflowLabel = workflowName?.trim() || mainAgentName;
  const agentStatus =
    hasActiveWorkflowRun ? 'running'
      : hasRecentChatActivity ? 'seen'
      : 'idle';

  return {
    id: MAIN_AGENT_SYNTHETIC_RUN_ID,
    workflowId: mainAgent.default_workflow_id?.trim() || null,
    runtimeAdapterId: isWorking ? 'office-executive-room' : 'office-open-workspace',
    status: isWorking ? 'running' : 'paused',
    updatedAt: mainAgent.updated_at ?? mainAgent.created_at ?? null,
    metadata: {
      office_zone_title: isWorking ? 'Executive Room' : 'Open Workspace',
      office_run_title: workflowLabel,
      office_subtitle: recentLabel
        ? `Assistant conversation · active ${recentLabel}`
        : 'Assistant conversation',
      office_href: '/assistant',
      office_presence: 'synthetic',
      office_presence_kind: isWorking ? 'main_agent' : 'ambient_agent',
      office_state_label:
        hasActiveWorkflowRun ? 'Leading workflow execution'
          : hasRecentChatActivity ? 'Handling assistant chat'
          : 'Moving through office',
      office_runtime_label:
        hasActiveWorkflowRun ? 'Executive room · workflow lead'
          : hasRecentChatActivity ? 'Executive room · active conversation'
          : 'Agent presence · roaming',
      office_activity:
        hasActiveWorkflowRun ? 'typing'
          : hasRecentChatActivity ? 'reading'
          : 'walking',
      office_motion_phase: isWorking ? 0 : Math.abs(Math.floor(now / 15000)) % 6,
      office_worker_count: 1,
      office_task_count: 0,
      office_agent_names: [mainAgentName],
      office_active_agent_names: isWorking ? [mainAgentName] : [],
      office_task_names: [],
      office_focus_task_names: [],
      office_agent_entities: [{
        recentActivity: [],
        name: mainAgentName,
        agentId: mainAgent.agent_id ?? null,
        status: agentStatus,
        lastEventLabel: hasActiveWorkflowRun
          ? 'workflow.execution'
          : hasRecentChatActivity ? 'assistant.message'
          : null,
        lastEventAt: mainAgent.updated_at ?? mainAgent.created_at ?? null,
        role: mainAgent.description ?? null,
        toolCount: null,
        handoffCount: null,
        eventCount: 0,
        linkedTaskNames: [],
        pendingApprovalCount: 0,
      }],
      office_task_entities: [],
      office_pending_approval_count: 0,
      office_pending_approvals: [],
      office_recent_event_label:
        hasActiveWorkflowRun ? 'workflow.execution'
          : hasRecentChatActivity ? 'assistant.message'
          : undefined,
      main_agent_id: mainAgent.agent_id ?? null,
    },
  } satisfies RunSessionSummary;
}
