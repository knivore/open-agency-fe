import type { ObservatoryEventValidationIssue } from '@/modules/observatory/runtime/events';
import type { ObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';

export type ObservatoryStreamAdapterStatus =
  | 'closed'
  | 'connected'
  | 'connecting'
  | 'error'
  | 'idle'
  | 'reconnecting';

export interface ObservatoryStreamAdapterStatusSnapshot {
  attempt: number;
  sourceId: string;
  status: ObservatoryStreamAdapterStatus;
  url: string;
}

export interface ObservatoryStreamAdapterReconnectOptions {
  baseDelayMs?: number;
  enabled?: boolean;
  maxAttempts?: number;
}

export interface ObservatoryStreamAdapterStateOptions {
  getState: () => ObservatoryRuntimeVisualState;
  onAcceptedEvent?: () => void;
  onIssues?: (issues: ObservatoryEventValidationIssue[]) => void;
  onStatusChange?: (status: ObservatoryStreamAdapterStatusSnapshot) => void;
  setState: (state: ObservatoryRuntimeVisualState) => void;
}

export interface ObservatoryStreamAdapter {
  connect(): void;
  disconnect(): void;
  getStatus(): ObservatoryStreamAdapterStatusSnapshot;
}
