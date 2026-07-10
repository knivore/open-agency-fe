import type { AgentDefinition } from '@/types/agents';
import type { ToolDefinition } from '@/types/tools';
import type {
  TaskDefinition,
  WorkflowArtifactDefinition,
  WorkflowDefinition,
  WorkflowEdgeDefinition,
  WorkflowMemoryDefinition,
} from '@/types/workflows';
import { workflowArtifactDefinitionsFor, workflowMemoryDefinitionsFor } from '@/types/workflows';

export interface WorkflowChangeSummaryGroup {
  id: string;
  label: string;
  added: number;
  removed: number;
  changed: number;
  details: string[];
}

export interface WorkflowChangeSummary {
  groups: WorkflowChangeSummaryGroup[];
  totalAdded: number;
  totalRemoved: number;
  totalChanged: number;
  totalChanges: number;
  hasChanges: boolean;
}

interface ComparableRecord {
  id: string;
  label: string;
  value: unknown;
}

function comparableString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
}

function sortedStrings(values: unknown): string[] {
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string').toSorted()
    : [];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value ?? null);
}

function workflowSettingsRecord(workflow: WorkflowDefinition): ComparableRecord {
  return {
    id: workflow.id || 'workflow',
    label: workflow.name || workflow.id || 'Workflow',
    value: {
      name: comparableString(workflow.name),
      description: comparableString(workflow.description),
      entrypoint: comparableString(workflow.entrypoint),
      default_runtime_adapter_id: comparableString(workflow.default_runtime_adapter_id),
      allowed_runtime_adapter_ids: sortedStrings(workflow.allowed_runtime_adapter_ids),
      execution_host:
        workflow.metadata && typeof workflow.metadata.execution_host === 'string'
          ? workflow.metadata.execution_host
          : '',
      restart_active_executions:
        workflow.metadata && typeof workflow.metadata.restart_active_executions === 'boolean'
          ? workflow.metadata.restart_active_executions
          : null,
    },
  };
}

function taskRecord(task: TaskDefinition): ComparableRecord {
  return {
    id: task.id,
    label: task.name || task.id,
    value: {
      name: comparableString(task.name),
      description: comparableString(task.description),
      instructions: comparableString(task.instructions),
      expected_output: comparableString(task.expected_output),
      agent_id: comparableString(task.agent_id),
      tool_ids: sortedStrings(task.tool_ids),
      memory_ids: sortedStrings(task.memory_ids),
      depends_on_task_ids: sortedStrings(task.depends_on_task_ids),
      human_approval_required: Boolean(task.human_approval_required),
      metadata: task.metadata ?? null,
    },
  };
}

function agentRecord(agent: AgentDefinition): ComparableRecord {
  return {
    id: agent.id,
    label: agent.name || agent.id,
    value: {
      name: comparableString(agent.name),
      description: comparableString(agent.description),
      instructions: comparableString(agent.instructions),
      system_prompt: comparableString(agent.system_prompt),
      role: comparableString(agent.role),
      backstory: comparableString(agent.backstory),
      model_profile_id: comparableString(agent.model_profile_id),
      tool_ids: sortedStrings(agent.tool_ids ?? agent.toolIds),
      memory_ids: sortedStrings(agent.memory_ids ?? agent.memoryIds),
      handoff_agent_ids: sortedStrings(agent.handoff_agent_ids ?? agent.handoffAgentIds),
      metadata: agent.metadata ?? null,
    },
  };
}

function toolRecord(tool: ToolDefinition): ComparableRecord {
  return {
    id: tool.id,
    label: tool.display_name || tool.name || tool.id,
    value: {
      name: comparableString(tool.name),
      display_name: comparableString(tool.display_name),
      description: comparableString(tool.description),
      tool_type: comparableString(tool.tool_type),
      tags: sortedStrings(tool.tags),
      input_schema: tool.input_schema ?? null,
      output_schema: tool.output_schema ?? null,
      implementation: tool.implementation ?? null,
      security: tool.security ?? null,
    },
  };
}

function memoryRecord(memory: WorkflowMemoryDefinition): ComparableRecord {
  return {
    id: memory.id,
    label: memory.name || memory.id,
    value: {
      name: comparableString(memory.name),
      description: comparableString(memory.description),
      memory_type: comparableString(memory.memory_type),
      scope: comparableString(memory.scope),
      metadata: memory.metadata ?? null,
    },
  };
}

function artifactRecord(artifact: WorkflowArtifactDefinition): ComparableRecord {
  return {
    id: artifact.id,
    label: artifact.name || artifact.id,
    value: {
      name: comparableString(artifact.name),
      description: comparableString(artifact.description),
      artifact_type: comparableString(artifact.artifact_type),
      media_type: comparableString(artifact.media_type),
      producer_task_id: comparableString(artifact.producer_task_id),
      metadata: artifact.metadata ?? null,
    },
  };
}

function edgeRecord(edge: WorkflowEdgeDefinition): ComparableRecord {
  return {
    id: edge.id,
    label: edge.id,
    value: {
      source_node_id: comparableString(edge.source_node_id),
      target_node_id: comparableString(edge.target_node_id),
      edge_type: comparableString(edge.edge_type),
      condition: comparableString(edge.condition),
      metadata: edge.metadata ?? null,
    },
  };
}

function summarizeRecords(
  id: string,
  label: string,
  baselineRecords: ComparableRecord[],
  draftRecords: ComparableRecord[]
): WorkflowChangeSummaryGroup {
  const baselineById = new Map(baselineRecords.map((record) => [record.id, record]));
  const draftById = new Map(draftRecords.map((record) => [record.id, record]));
  const details: string[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const draft of draftRecords) {
    const baseline = baselineById.get(draft.id);
    if (!baseline) {
      added += 1;
      details.push(`Added ${label.toLowerCase()} "${draft.label}".`);
      continue;
    }

    if (stableJson(baseline.value) !== stableJson(draft.value)) {
      changed += 1;
      details.push(`Changed ${label.toLowerCase()} "${draft.label}".`);
    }
  }

  for (const baseline of baselineRecords) {
    if (!draftById.has(baseline.id)) {
      removed += 1;
      details.push(`Removed ${label.toLowerCase()} "${baseline.label}".`);
    }
  }

  return { id, label, added, removed, changed, details };
}

export function createWorkflowChangeSummary(
  baseline: WorkflowDefinition,
  draft: WorkflowDefinition
): WorkflowChangeSummary {
  const groups = [
    summarizeRecords(
      'workflow',
      'Workflow setting',
      [workflowSettingsRecord(baseline)],
      [workflowSettingsRecord(draft)]
    ),
    summarizeRecords(
      'tasks',
      'Task',
      (baseline.task_definitions ?? []).map(taskRecord),
      (draft.task_definitions ?? []).map(taskRecord)
    ),
    summarizeRecords(
      'agents',
      'Agent',
      (baseline.agent_definitions ?? []).map(agentRecord),
      (draft.agent_definitions ?? []).map(agentRecord)
    ),
    summarizeRecords(
      'tools',
      'Tool',
      (baseline.tool_definitions ?? []).map(toolRecord),
      (draft.tool_definitions ?? []).map(toolRecord)
    ),
    summarizeRecords(
      'memory',
      'Memory',
      workflowMemoryDefinitionsFor(baseline).map(memoryRecord),
      workflowMemoryDefinitionsFor(draft).map(memoryRecord)
    ),
    summarizeRecords(
      'artifacts',
      'Artifact',
      workflowArtifactDefinitionsFor(baseline).map(artifactRecord),
      workflowArtifactDefinitionsFor(draft).map(artifactRecord)
    ),
    summarizeRecords(
      'edges',
      'Edge',
      (baseline.edges ?? []).map(edgeRecord),
      (draft.edges ?? []).map(edgeRecord)
    ),
  ].filter((group) => group.added > 0 || group.removed > 0 || group.changed > 0);

  const totalAdded = groups.reduce((total, group) => total + group.added, 0);
  const totalRemoved = groups.reduce((total, group) => total + group.removed, 0);
  const totalChanged = groups.reduce((total, group) => total + group.changed, 0);
  const totalChanges = totalAdded + totalRemoved + totalChanged;

  return {
    groups,
    totalAdded,
    totalRemoved,
    totalChanged,
    totalChanges,
    hasChanges: totalChanges > 0,
  };
}
