import { workflowMemoryDefinitionsMetadataKey } from '@/types/workflows';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function workflowToolSecurity(security: Record<string, unknown>) {
  const connectorBindings = Array.isArray(security.connector_bindings)
    ? security.connector_bindings
    : [];
  const allowShell = typeof security.allow_shell === 'boolean' ? security.allow_shell : undefined;
  const sandboxRequired =
    typeof security.sandbox_required === 'boolean' ? security.sandbox_required : undefined;
  const requiresApproval =
    typeof security.requires_approval === 'boolean' ? security.requires_approval : undefined;

  // Shell execution is valid only when both the explicit opt-in and sandbox boundary
  // survive the BFF sanitizer. Other risk metadata remains backend-owned.
  return {
    connector_bindings: connectorBindings,
    ...(allowShell === undefined ? {} : { allow_shell: allowShell }),
    ...(sandboxRequired === undefined ? {} : { sandbox_required: sandboxRequired }),
    ...(requiresApproval === undefined ? {} : { requires_approval: requiresApproval }),
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
