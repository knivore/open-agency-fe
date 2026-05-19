import type {
  ObservatoryAgentVisualState,
  ObservatoryRoomVisualState,
} from '@/modules/observatory/engine/rendering/agentVisualState';
import type {
  ObservatoryCharacterActionName,
  ObservatoryCharacterDirection,
} from '@/modules/observatory/engine/assets/assetRegistry';
import type { ObservatoryAgentStatus } from '@/modules/observatory/engine/world/layoutTypes';
import type { ObservatoryRuntimeEntityStatus, ObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';

export function mapRuntimeStateToAgentVisualStates(
  state: ObservatoryRuntimeVisualState,
): ObservatoryAgentVisualState[] {
  return Object.values(state.agentsById).map((agent) => ({
    action: agent.visualAction ?? mapRuntimeAgentToAction(agent.status, agent.taskTitle),
    agentId: agent.id,
    attention: mapRuntimeStatusToAttention(agent.status),
    direction: agent.visualDirection ?? mapRuntimeAgentToDirection(agent.id, agent.status, agent.taskTitle),
    movementKey: agent.currentRoomId && agent.currentTaskId ? `${agent.currentRoomId}:${agent.currentTaskId}` : undefined,
    speechMessage: agent.speechBubble?.message,
    status: mapRuntimeStatusToAgentStatus(agent.status),
    targetRoomId: agent.currentRoomId,
    taskEffectKey:
      (agent.status === 'complete' || agent.status === 'error') && agent.currentTaskId
        ? `${agent.currentTaskId}:${agent.status}:${agent.lastEventId}`
        : undefined,
    taskOutcome: agent.status === 'complete' || agent.status === 'error' ? agent.status : undefined,
    taskProgress: agent.taskProgress,
    taskTitle: agent.taskTitle,
  }));
}

export function mapRuntimeStateToRoomVisualStates(
  state: ObservatoryRuntimeVisualState,
): ObservatoryRoomVisualState[] {
  return Object.values(state.workflowsById).flatMap((workflow) => {
    if (!workflow.roomId || workflow.status === 'unknown' || workflow.status === 'idle') {
      return [];
    }

    return [
      {
        roomId: workflow.roomId,
        status: mapRuntimeStatusToAgentStatus(workflow.status),
        workflowId: workflow.id,
      },
    ];
  });
}

function mapRuntimeAgentToAction(
  status: ObservatoryRuntimeEntityStatus,
  taskTitle: string | undefined,
): ObservatoryCharacterActionName {
  if (status === 'working') {
    const normalizedTaskTitle = taskTitle?.toLowerCase() ?? '';
    if (/(review|read|plan|design|spec|architect|scope|brief|whiteboard)/.test(normalizedTaskTitle)) {
      return 'reading';
    }

    return 'phone';
  }

  return 'idle';
}

function mapRuntimeAgentToDirection(
  agentId: string,
  status: ObservatoryRuntimeEntityStatus,
  taskTitle: string | undefined,
): ObservatoryCharacterDirection {
  const normalizedTaskTitle = taskTitle?.toLowerCase() ?? '';

  if (status === 'blocked' || /(plan|design|spec|architect|scope|brief|whiteboard)/.test(normalizedTaskTitle)) {
    return 'up';
  }

  if (status === 'working') {
    const directions: ObservatoryCharacterDirection[] = ['left', 'right', 'up'];
    return directions[hashString(agentId) % directions.length] ?? 'right';
  }

  const directions: ObservatoryCharacterDirection[] = ['down', 'left', 'right'];
  return directions[hashString(`${agentId}:${status}`) % directions.length] ?? 'down';
}

function mapRuntimeStatusToAttention(status: ObservatoryRuntimeEntityStatus): ObservatoryAgentVisualState['attention'] {
  if (status === 'working') {
    return 'thinking';
  }

  if (status === 'blocked') {
    return 'approval';
  }

  if (status === 'error') {
    return 'error';
  }

  return undefined;
}

function mapRuntimeStatusToAgentStatus(status: ObservatoryRuntimeEntityStatus): ObservatoryAgentStatus {
  if (status === 'unknown') {
    return 'idle';
  }

  return status;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
