import { workflowMemoryDefinitionsMetadataKey } from '@/types/workflows';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function workflowToolSecurity(security: Record<string, unknown>) {
  const connectorBindings = Array.isArray(security.connector_bindings)
    ? security.connector_bindings
    : [];

  // The backend workflow schema only accepts connector binding security for tools.
  // Keep that supported shape and drop frontend-only risk metadata before validation.
  return {
    connector_bindings: connectorBindings,
  };
}

function sanitizeToolDefinitionsSecurity(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.tool_definitions)) {
    return payload;
  }

  return {
    ...payload,
    tool_definitions: payload.tool_definitions.map((tool) => {
      if (!isRecord(tool)) {
        return tool;
      }
      const security = isRecord(tool.security) ? tool.security : {};
      return {
        ...tool,
        security: workflowToolSecurity(security),
      };
    }),
  };
}

function stripMemoryIdsFromDefinitions(payload: Record<string, unknown>) {
  const nextPayload = { ...payload };

  // Memory assignments are persisted through the workflow memory-link API; the
  // backend workflow schema rejects these frontend graph draft fields.
  if (Array.isArray(nextPayload.agent_definitions)) {
    nextPayload.agent_definitions = nextPayload.agent_definitions.map((agent) => {
      if (!isRecord(agent)) {
        return agent;
      }
      const nextAgent = { ...agent };
      delete nextAgent.memory_ids;
      delete nextAgent.memoryIds;
      return nextAgent;
    });
  }

  if (Array.isArray(nextPayload.task_definitions)) {
    nextPayload.task_definitions = nextPayload.task_definitions.map((task) => {
      if (!isRecord(task)) {
        return task;
      }
      const nextTask = { ...task };
      delete nextTask.memory_ids;
      delete nextTask.memoryIds;
      return nextTask;
    });
  }

  return nextPayload;
}

export function sanitizeWorkflowDefinitionPayload(payload: Record<string, unknown>) {
  const updatePayload = sanitizeToolDefinitionsSecurity(stripMemoryIdsFromDefinitions(payload));
  const metadata = isRecord(updatePayload.metadata) ? updatePayload.metadata : {};

  if (Array.isArray(updatePayload.memory_definitions)) {
    updatePayload.metadata = {
      ...metadata,
      [workflowMemoryDefinitionsMetadataKey]: updatePayload.memory_definitions,
    };
  }

  delete updatePayload.monitoring;
  delete updatePayload.runtime_governance;
  delete updatePayload.memory_definitions;
  return updatePayload;
}
