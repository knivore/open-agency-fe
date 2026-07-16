import type { AgentDefinition, BehaviorTuningProfile } from '@/types/agents';
import type { JsonObject } from '@/types/api';
import type { ToolDefinition } from '@/types/tools';
import type { WorkflowDefinition } from '@/types/workflows';

export const workflowExportSchemaVersion = 'agency.workflow.export.v1';

export type WorkflowExportToolSource = 'workflow' | 'available' | 'reference';
export type WorkflowExportDependencyStatus = 'available' | 'referenced' | 'missing';

export interface WorkflowExportModelProfile extends JsonObject {
  id: string;
  name?: string;
  provider?: string;
  model?: string;
  status: WorkflowExportDependencyStatus;
}

export interface WorkflowExportTool extends JsonObject {
  id: string;
  name: string;
  display_name?: string | null;
  description: string;
  tool_type?: string;
  input_schema?: JsonObject;
  output_schema?: JsonObject;
  implementation?: JsonObject;
  security?: JsonObject;
  tags?: string[];
  framework_hints?: JsonObject;
  source: WorkflowExportToolSource;
  status: WorkflowExportDependencyStatus;
}

export interface WorkflowExportPackage {
  schemaVersion: typeof workflowExportSchemaVersion;
  exportedAt: string;
  workflow: WorkflowDefinition;
  dependencies: {
    modelProfiles: WorkflowExportModelProfile[];
    tools: WorkflowExportTool[];
  };
  importNotes: string[];
}

export interface BuildWorkflowExportPackageOptions {
  exportedAt?: string;
  availableModelProfiles?: BehaviorTuningProfile[];
  availableTools?: ToolDefinition[];
}

export interface WorkflowImportOptions {
  availableModelProfiles?: BehaviorTuningProfile[];
  availableTools?: ToolDefinition[];
  importedWorkflowId?: string;
  modelProfileMappings?: Record<string, string | null | undefined>;
  toolMappings?: Record<string, string | null | undefined>;
}

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return undefined as T;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function safeFileName(source: string | undefined | null, fallback: string) {
  const safeName = (source || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safeName || fallback;
}

function agentToolIds(agent: AgentDefinition) {
  return agent.tool_ids ?? agent.toolIds ?? [];
}

function referencedModelProfileIds(workflow: WorkflowDefinition) {
  return Array.from(
    new Set(
      (workflow.agent_definitions ?? [])
        .map((agent) => agent.model_profile_id)
        .filter((id): id is string => Boolean(id?.trim()))
    )
  );
}

function referencedToolIds(workflow: WorkflowDefinition) {
  return Array.from(
    new Set([
      ...(workflow.agent_definitions ?? []).flatMap(agentToolIds),
      ...(workflow.task_definitions ?? []).flatMap((task) => task.tool_ids ?? []),
      ...(workflow.nodes ?? [])
        .map((node) => node.tool_id)
        .filter((id): id is string => Boolean(id?.trim())),
    ])
  );
}

function sanitizeWorkflowForExport(workflow: WorkflowDefinition) {
  const workflowCopy = cloneJson(workflow);
  delete workflowCopy.monitoring;
  delete workflowCopy.runtime_governance;
  return workflowCopy;
}

function createToolExport(
  tool: ToolDefinition | undefined,
  id: string,
  source: WorkflowExportToolSource
): WorkflowExportTool {
  if (!tool) {
    return {
      id,
      name: id,
      description: '',
      source: 'reference',
      status: 'missing',
    };
  }

  return {
    id: tool.id,
    name: tool.name,
    display_name: tool.display_name ?? null,
    description: tool.description,
    tool_type: tool.tool_type,
    input_schema: cloneJson(tool.input_schema),
    output_schema: cloneJson(tool.output_schema),
    implementation: cloneJson(tool.implementation),
    security: cloneJson(tool.security),
    tags: tool.tags ? [...tool.tags] : undefined,
    framework_hints: cloneJson(tool.framework_hints),
    source,
    status: 'available',
  };
}

export function buildWorkflowExportPackage(
  workflow: WorkflowDefinition,
  options: BuildWorkflowExportPackageOptions = {}
): WorkflowExportPackage {
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const workflowCopy = sanitizeWorkflowForExport(workflow);
  const modelProfileById = new Map(
    (options.availableModelProfiles ?? []).map((profile) => [profile.id, profile])
  );
  const workflowToolById = new Map(
    (workflow.tool_definitions ?? []).map((tool) => [tool.id, tool])
  );
  const availableToolById = new Map((options.availableTools ?? []).map((tool) => [tool.id, tool]));
  const importNotes: string[] = [];

  const modelProfiles = referencedModelProfileIds(workflow).map<WorkflowExportModelProfile>(
    (id) => {
      const profile = modelProfileById.get(id);
      if (!profile) {
        importNotes.push(`Model profile "${id}" must be mapped locally during import.`);
        return {
          id,
          status: 'referenced',
        };
      }

      return {
        id,
        name: profile.name,
        provider: profile.provider,
        model: profile.model,
        status: 'available',
      };
    }
  );

  const tools = referencedToolIds(workflow).map<WorkflowExportTool>((id) => {
    const workflowTool = workflowToolById.get(id);
    if (workflowTool) {
      const exportedTool = createToolExport(workflowTool, id, 'workflow');
      if (!exportedTool.implementation) {
        importNotes.push(`Workflow tool "${id}" was exported without implementation code.`);
      }
      return exportedTool;
    }

    const availableTool = availableToolById.get(id);
    if (availableTool) {
      importNotes.push(`Catalog tool "${id}" was exported as metadata and may need local mapping.`);
      return createToolExport(availableTool, id, 'available');
    }

    importNotes.push(`Tool "${id}" was not found locally and was exported as a reference only.`);
    return createToolExport(undefined, id, 'reference');
  });

  return {
    schemaVersion: workflowExportSchemaVersion,
    exportedAt,
    workflow: workflowCopy,
    dependencies: {
      modelProfiles,
      tools,
    },
    importNotes,
  };
}

export function stringifyWorkflowExportPackage(pkg: WorkflowExportPackage) {
  return JSON.stringify(pkg, null, 2);
}

export function parseWorkflowExportPackageJson(json: string): WorkflowExportPackage {
  const parsed = JSON.parse(json) as WorkflowExportPackage;
  if (parsed.schemaVersion !== workflowExportSchemaVersion) {
    throw new Error(`Unsupported workflow export schema: ${String(parsed.schemaVersion)}`);
  }

  if (!parsed.workflow || typeof parsed.workflow.id !== 'string') {
    throw new Error('Workflow export is missing a workflow definition.');
  }

  return parsed;
}

export function workflowExportFileName(workflow: WorkflowDefinition) {
  return `${safeFileName(workflow.name || workflow.id, 'workflow')}.workflow.json`;
}

export function downloadWorkflowExportPackage(
  workflow: WorkflowDefinition,
  options: BuildWorkflowExportPackageOptions = {}
) {
  if (typeof window === 'undefined' || typeof globalThis.document === 'undefined') {
    return false;
  }

  const pkg = buildWorkflowExportPackage(workflow, options);
  const blob = new Blob([stringifyWorkflowExportPackage(pkg)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = workflowExportFileName(workflow);
  link.rel = 'noopener';
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return true;
}

export function createWorkflowDefinitionFromExportPackage(
  pkg: WorkflowExportPackage,
  options: WorkflowImportOptions = {}
): WorkflowDefinition {
  const workflow = cloneJson(pkg.workflow);
  delete workflow.monitoring;
  delete workflow.runtime_governance;
  const localModelProfileIds = new Set(
    (options.availableModelProfiles ?? []).map((profile) => profile.id)
  );
  const localToolIds = new Set((options.availableTools ?? []).map((tool) => tool.id));
  const modelProfileMappings = options.modelProfileMappings ?? {};
  const toolMappings = options.toolMappings ?? {};
  const exportedToolDefinitions = new Map(
    pkg.dependencies.tools
      .filter((tool) => tool.implementation)
      .map(
        (tool) =>
          [
            tool.id,
            {
              id: tool.id,
              name: tool.name,
              display_name: tool.display_name,
              description: tool.description,
              tool_type: tool.tool_type,
              input_schema: tool.input_schema,
              output_schema: tool.output_schema,
              implementation: tool.implementation,
              security: tool.security,
              tags: tool.tags,
              framework_hints: tool.framework_hints,
            },
          ] as const
      )
  );
  const importableToolIds = new Set([...localToolIds, ...exportedToolDefinitions.keys()]);
  const modelProfileIdForImport = (modelProfileId: string | null | undefined) => {
    if (!modelProfileId) {
      return null;
    }

    if (localModelProfileIds.has(modelProfileId)) {
      return modelProfileId;
    }

    const mappedProfileId = modelProfileMappings[modelProfileId];
    return mappedProfileId && localModelProfileIds.has(mappedProfileId) ? mappedProfileId : null;
  };
  const toolIdForImport = (toolId: string) => {
    const mappedToolId = Object.prototype.hasOwnProperty.call(toolMappings, toolId)
      ? toolMappings[toolId]
      : undefined;

    if (mappedToolId === null || mappedToolId === '') {
      return null;
    }

    if (mappedToolId && localToolIds.has(mappedToolId)) {
      return mappedToolId;
    }

    return importableToolIds.has(toolId) ? toolId : null;
  };
  const toolIdsForImport = (toolIds: string[] | undefined) =>
    Array.from(
      new Set(
        (toolIds ?? []).map(toolIdForImport).filter((toolId): toolId is string => Boolean(toolId))
      )
    );

  workflow.id = options.importedWorkflowId ?? workflow.id;
  workflow.agent_definitions = (workflow.agent_definitions ?? []).map((agent) => ({
    ...agent,
    model_profile_id: modelProfileIdForImport(agent.model_profile_id),
    tool_ids: toolIdsForImport(agentToolIds(agent)),
  }));
  workflow.task_definitions = (workflow.task_definitions ?? []).map((task) => ({
    ...task,
    tool_ids: toolIdsForImport(task.tool_ids),
  }));
  workflow.tool_definitions = Array.from(
    new Map(
      [...(workflow.tool_definitions ?? []), ...exportedToolDefinitions.values()].map((tool) => [
        tool.id,
        tool,
      ])
    ).values()
  );

  return workflow;
}
