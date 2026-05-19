export const AGENCY_RUNTIME_EVENT_SCHEMA_VERSION = 'agency.runtime-event.v1';

export type ObservatoryRuntimeSourceType =
  | 'agency'
  | 'hermes'
  | 'claude_code'
  | 'codex'
  | 'custom'
  | 'local';

export type ObservatoryRuntimeLevel = 'debug' | 'info' | 'warning' | 'error' | 'success';

export type ObservatoryNormalizedEventType =
  | 'AGENT_STATUS_CHANGED'
  | 'AGENT_SPOKE'
  | 'TASK_STARTED'
  | 'TASK_PROGRESS'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TOOL_STARTED'
  | 'TOOL_COMPLETED'
  | 'TOOL_FAILED'
  | 'LOG_RECEIVED'
  | 'APPROVAL_REQUIRED'
  | 'FILE_CHANGED'
  | 'WORKFLOW_TRANSITIONED';

export interface ObservatoryExternalRuntimeEvent {
  id: string;
  schemaVersion?: string;
  source: string;
  sourceType: ObservatoryRuntimeSourceType;
  type: string;
  timestamp: string;
  actor?: {
    id: string;
    name?: string;
    role?: string;
    avatarAssetId?: string;
  };
  workflow?: {
    id: string;
    name?: string;
    roomId?: string;
  };
  task?: {
    id: string;
    title?: string;
    progress?: number;
  };
  level?: ObservatoryRuntimeLevel;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ObservatoryNormalizedOfficeEvent {
  id: string;
  source: string;
  type: ObservatoryNormalizedEventType;
  timestamp: string;
  agentId?: string;
  workflowId?: string;
  taskId?: string;
  roomId?: string;
  level: ObservatoryRuntimeLevel;
  title?: string;
  message?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

export interface ObservatoryEventValidationIssue {
  path: string;
  reason: string;
}

export interface ObservatoryValidatedExternalRuntimeEvent {
  event?: ObservatoryExternalRuntimeEvent;
  issues: ObservatoryEventValidationIssue[];
}

export interface ObservatoryEventNormalizationResult {
  event?: ObservatoryNormalizedOfficeEvent;
  issues: ObservatoryEventValidationIssue[];
}

export interface ObservatoryRuntimeEventNormalizer {
  normalize(event: ObservatoryExternalRuntimeEvent): ObservatoryEventNormalizationResult;
}
