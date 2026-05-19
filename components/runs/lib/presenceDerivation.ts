import type {
  ApprovalRequest,
  ExecutionEventRecord,
  ExecutionStateSnapshot,
  RunSessionSummary,
  WorkflowDefinition,
} from '@/lib/api/backend/types';

type DerivedPresence = {
  id: string;
  name: string;
  status: string;
  lastEventType: string | null;
  lastEventAt: string | null;
  metadata: Record<string, unknown>;
};

type EventIndex = {
  byAgentId: Map<string, ExecutionEventRecord[]>;
  byTaskId: Map<string, ExecutionEventRecord[]>;
};

const ACTIVE_EVENT_TYPES = new Set([
  'task.started',
  'agent.message.created',
  'llm.request.created',
  'llm.response.created',
  'tool.call.started',
  'tool.call.completed',
  'artifact.created',
]);

function pushIndexed(map: Map<string, ExecutionEventRecord[]>, key: string | null | undefined, event: ExecutionEventRecord) {
  if (!key) {
    return;
  }
  const existing = map.get(key) ?? [];
  existing.push(event);
  map.set(key, existing);
}

function buildEventIndex(events: ExecutionEventRecord[]): EventIndex {
  const byAgentId = new Map<string, ExecutionEventRecord[]>();
  const byTaskId = new Map<string, ExecutionEventRecord[]>();

  for (const event of events) {
    pushIndexed(byAgentId, event.agent_id ?? null, event);
    pushIndexed(byTaskId, event.task_id ?? null, event);
  }

  return { byAgentId, byTaskId };
}

function sortEvents(events: ExecutionEventRecord[]) {
  return [...events].sort((left, right) => left.sequence - right.sequence);
}

function currentNodeContext(workflow: WorkflowDefinition | undefined, currentNodeId?: string | null) {
  if (!workflow || !currentNodeId) {
    return { currentTaskId: null, currentAgentId: null };
  }

  const node = (workflow.nodes ?? []).find((candidate) => candidate.id === currentNodeId);
  return {
    currentTaskId: node?.task_id ?? null,
    currentAgentId: node?.agent_id ?? null,
  };
}

function hasPendingApprovalForTask(approvals: ApprovalRequest[], taskId: string) {
  return approvals.some((approval) => {
    if (approval.status !== 'pending') {
      return false;
    }
    const metadataTaskId =
      approval.metadata && typeof approval.metadata.task_id === 'string'
        ? approval.metadata.task_id
        : null;
    return metadataTaskId === taskId;
  });
}

function hasPendingApprovalForAgent(approvals: ApprovalRequest[], agentId: string) {
  return approvals.some((approval) => {
    if (approval.status !== 'pending') {
      return false;
    }
    const metadataAgentId =
      approval.metadata && typeof approval.metadata.agent_id === 'string'
        ? approval.metadata.agent_id
        : null;
    return metadataAgentId === agentId || approval.requested_by_agent_id === agentId;
  });
}

function deriveStatus(params: {
  run: RunSessionSummary;
  isCurrent: boolean;
  hasEvents: boolean;
  lastEventType: string | null;
  hasPendingApproval: boolean;
}) {
  const { run, isCurrent, hasEvents, lastEventType, hasPendingApproval } = params;

  if (hasPendingApproval || (isCurrent && run.status === 'waiting_for_approval')) {
    return 'waiting_for_approval';
  }
  if (isCurrent) {
    if (run.status === 'paused') {
      return 'paused';
    }
    if (run.status === 'failed') {
      return 'failed';
    }
    if (run.status === 'cancelled') {
      return 'cancelled';
    }
    return 'running';
  }
  if (run.status === 'completed' && hasEvents) {
    return 'completed';
  }
  if (run.status === 'failed' && hasEvents) {
    return 'failed';
  }
  if (lastEventType && ACTIVE_EVENT_TYPES.has(lastEventType)) {
    return 'active';
  }
  return hasEvents ? 'seen' : 'idle';
}

export function deriveTaskPresences(params: {
  run: RunSessionSummary;
  workflow?: WorkflowDefinition;
  state: ExecutionStateSnapshot;
  events: ExecutionEventRecord[];
  approvals: ApprovalRequest[];
}): DerivedPresence[] {
  const { run, workflow, state, events, approvals } = params;
  const { byTaskId } = buildEventIndex(events);
  const { currentTaskId } = currentNodeContext(workflow, state.current_node_id ?? null);
  const knownTasks = workflow?.task_definitions ?? [];

  return knownTasks.map((task) => {
    const taskEvents = sortEvents(byTaskId.get(task.id) ?? []);
    const lastEvent = taskEvents.at(-1) ?? null;
    const isCurrent = currentTaskId === task.id;
    const hasPendingApproval = hasPendingApprovalForTask(approvals, task.id);

    return {
      id: task.id,
      name: task.name,
      status: deriveStatus({
        run,
        isCurrent,
        hasEvents: taskEvents.length > 0,
        lastEventType: lastEvent?.event_type ?? null,
        hasPendingApproval,
      }),
      lastEventType: lastEvent?.event_type ?? null,
      lastEventAt: lastEvent?.timestamp ?? null,
      metadata: {
        agentId: task.agent_id ?? null,
        dependencyCount: (task.depends_on_task_ids ?? []).length,
        humanApprovalRequired: Boolean(task.human_approval_required),
        eventCount: taskEvents.length,
      },
    };
  });
}

export function deriveAgentPresences(params: {
  run: RunSessionSummary;
  workflow?: WorkflowDefinition;
  state: ExecutionStateSnapshot;
  events: ExecutionEventRecord[];
  approvals: ApprovalRequest[];
}): DerivedPresence[] {
  const { run, workflow, state, events, approvals } = params;
  const { byAgentId } = buildEventIndex(events);
  const { currentAgentId } = currentNodeContext(workflow, state.current_node_id ?? null);
  const knownAgents = workflow?.agent_definitions ?? [];

  return knownAgents.map((agent) => {
    const agentEvents = sortEvents(byAgentId.get(agent.id) ?? []);
    const lastEvent = agentEvents.at(-1) ?? null;
    const isCurrent = currentAgentId === agent.id;
    const hasPendingApproval = hasPendingApprovalForAgent(approvals, agent.id);

    return {
      id: agent.id,
      name: agent.name,
      status: deriveStatus({
        run,
        isCurrent,
        hasEvents: agentEvents.length > 0,
        lastEventType: lastEvent?.event_type ?? null,
        hasPendingApproval,
      }),
      lastEventType: lastEvent?.event_type ?? null,
      lastEventAt: lastEvent?.timestamp ?? null,
      metadata: {
        role: agent.role ?? null,
        toolCount: (agent.tool_ids ?? []).length,
        handoffCount: (agent.handoff_agent_ids ?? []).length,
        eventCount: agentEvents.length,
      },
    };
  });
}
