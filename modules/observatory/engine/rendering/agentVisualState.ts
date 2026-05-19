import type {
  ObservatoryCharacterActionName,
  ObservatoryCharacterDirection,
} from '@/modules/observatory/engine/assets/assetRegistry';
import type { ObservatoryAgentStatus } from '@/modules/observatory/engine/world/layoutTypes';

export interface ObservatoryAgentVisualState {
  action?: ObservatoryCharacterActionName;
  attention?: 'approval' | 'error' | 'thinking';
  direction?: ObservatoryCharacterDirection;
  agentId: string;
  movementKey?: string;
  status?: ObservatoryAgentStatus;
  speechDurationMs?: number;
  speechGroupKey?: string;
  speechKey?: string;
  speechMessage?: string;
  speechTone?: 'chat' | 'computer' | 'pantry' | 'planning' | 'runtime' | 'storage';
  targetPoint?: { x: number; y: number };
  targetRoomId?: string;
  taskEffectKey?: string;
  taskOutcome?: 'complete' | 'error';
  taskProgress?: number;
  taskTitle?: string;
}

export interface ObservatoryRoomVisualState {
  roomId: string;
  status: ObservatoryAgentStatus;
  workflowId: string;
}

export const OBSERVATORY_AGENT_VISUAL_STATE_EVENT = 'observatory:agent-visual-state';

export interface ObservatoryAgentVisualStateEventDetail {
  agents: ObservatoryAgentVisualState[];
  rooms?: ObservatoryRoomVisualState[];
}

export function dispatchObservatoryAgentVisualState(
  agents: ObservatoryAgentVisualState[],
  rooms: ObservatoryRoomVisualState[] = []
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ObservatoryAgentVisualStateEventDetail>(OBSERVATORY_AGENT_VISUAL_STATE_EVENT, {
      detail: { agents, rooms },
    })
  );
}
