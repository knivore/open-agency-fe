'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRegisterAssistantPageContext } from '@/components/assistant/AssistantPageContext';
import { agentsApi } from '@/lib/api/backend/agents';
import { behaviorProfilesApi } from '@/lib/api/backend/behaviorProfiles';
import { conversationsApi } from '@/lib/api/backend/conversations';
import { credentialsApi } from '@/lib/api/backend/credentials';
import { logsApi } from '@/lib/api/backend/logs';
import { memoriesApi } from '@/lib/api/backend/memory';
import { observabilityApi } from '@/lib/api/backend/observability';
import { runsApi } from '@/lib/api/backend/runs';
import { runtimeAdaptersApi } from '@/lib/api/backend/runtimeAdapters';
import { schedulesApi } from '@/lib/api/backend/schedules';
import { toolsApi } from '@/lib/api/backend/tools';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { integrationConnectorHrefForProviderKey } from '@/lib/integrations/connectorNavigation';
import {
  readWorkflowCapabilityTags,
  WORKFLOW_CAPABILITY_OPTIONS,
  writeWorkflowCapabilityTags,
} from '@/lib/workflows/capabilities';
import {
  createWorkflowAgentGuardrailDraft,
  normalizeWorkflowAgentGuardrails,
  workflowAgentGuardrailModes,
} from '@/lib/workflows/agentGuardrails';
import {
  sortToolsForWorkflowCapabilities,
  toolsRecommendedForWorkflowCapabilities,
} from '@/lib/workflows/capabilityTooling';
import { cn } from '@/lib/utils';
import { useWorkflowRunLauncher } from '@/lib/workflows/useWorkflowRunLauncher';
import {
  createWorkflowChangeSummary,
  type WorkflowChangeSummary,
} from '@/lib/workflows/workflowChangeSummary';
import {
  normalizeWorkflowAgentDefinition,
  resolveWorkflowExecutionHost,
} from '@/lib/workflows/executionPayload';
import { toolDisplayName } from '@/lib/tools/displayName';
import { rebuildWorkflowGraph } from '@/lib/workflows/workflowDefinitionMutations';
import {
  applyPersonaAgentSnapshot,
  findPersonaSourceAgent,
  isPersonaAgentFieldFromSnapshot,
  isPersonaAgentFieldOverridden,
  markPersonaAgentFieldOverrides,
  normalizeBackendPersonaVersionNotices,
  personaAgentSnapshotFields,
  shortPersonaVersionId,
  type PersonaAgentSnapshotField,
  type PersonaAgentVersionNotice,
} from '@/lib/workflows/personaVersioning';
import {
  createWorkflowGraphDraftAgentDefinition,
  validateWorkflowResourceReferences,
  validateWorkflowRuntimeWarnings,
  workflowActivityToGraphRuntimeEvents,
  workflowDefinitionToGraphDocument,
  workflowGraphEdgeTypes,
  workflowGraphNodeTypes,
  workflowGraphToolListSelectionId,
  type WorkflowGraphValidationIssue,
} from '@/lib/workflows/workflowGraphAdapter';
import { downloadWorkflowExportPackage } from '@/lib/workflows/workflowExport';
import {
  applyEdgeDraftMetadata,
  labelForEntrypointTask,
  resolveRestartActiveExecutions,
  useWorkflowEditorDraft,
} from '@/components/workflow/useWorkflowEditorDraft';
import WorkflowDetailHeader from '@/components/workflow/WorkflowDetailHeader';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import WorkflowDetailStatus from '@/components/workflow/WorkflowDetailStatus';
import WorkflowOperationError from '@/components/workflow/WorkflowOperationError';
import WorkflowEdgeMetadataEditor from '@/components/workflow/WorkflowEdgeMetadataEditor';
import WorkflowGraphCanvas from '@/components/workflow/WorkflowGraphCanvas';
import WorkflowMetadataEditor from '@/components/workflow/WorkflowMetadataEditor';
import WorkflowMonitoringControls from '@/components/workflow/WorkflowMonitoringControls';
import WorkflowMonitoringProposals from '@/components/workflow/WorkflowMonitoringProposals';
import WorkflowGovernancePanel from '@/components/workflow/WorkflowGovernancePanel';
import WorkflowObservabilitySummary from '@/components/workflow/WorkflowObservabilitySummary';
import WorkflowRuntimeGovernanceControls from '@/components/workflow/WorkflowRuntimeGovernanceControls';
import WorkflowSchedulesPanel from '@/components/workflow/WorkflowSchedulesPanel';
import {
  WorkflowReadOnlySummaryField,
  WorkflowSettingsSection,
  WorkflowStateValue,
  WorkflowToneDot,
} from '@/components/workflow/WorkflowSettingsPrimitives';
import WorkflowSharedMemoryControls from '@/components/workflow/WorkflowSharedMemoryControls';
import WorkflowTaskFocusPanel from '@/components/workflow/WorkflowTaskFocusPanel';
import DocumentIngestionControl from '@/components/memory-app/DocumentIngestionControl';
import UploadedDocumentsList from '@/components/memory-app/UploadedDocumentsList';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../library/shadcn/accordion';
import { Tabs, TabsList, TabsTrigger } from '../library/shadcn/tabs';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import { Textarea } from '../library/shadcn/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import { EmptyCard, ErrorAlert, LoadingCard } from '@/components/agent-app/StatePanels';
import { toast } from 'sonner';
import type { AgentDefinition } from '@/types/agents';
import type { JsonObject, JsonValue } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import type { ExecutionEventRecord, WorkflowRun } from '@/types/runtime';
import type { ConnectorBindingDefinition, ToolDefinition } from '@/types/tools';
import type {
  ConnectorCapabilitiesPayload,
  ConnectorCapabilityDefinition,
  ConnectorMetadataRequirementDefinition,
  CredentialDefinition,
} from '@/types/integrations';
import type { ObservabilityAgentMetrics } from '@/lib/api/backend/observability';
import type {
  WorkflowDefinition,
  WorkflowAgentToolConfig,
  WorkflowArtifactDefinition,
  WorkflowCapabilityTag,
  WorkflowMemoryDefinition,
  WorkflowMonitoringOperatorPayload,
  WorkflowRuntimeGovernanceOperatorPayload,
} from '@/types/workflows';
import {
  workflowArtifactDefinitionsFor,
  workflowArtifactDefinitionsMetadataKey,
  workflowMemoryDefinitionsFor,
} from '@/types/workflows';
import type { GraphEdge, GraphRuntimeEvent } from '@/modules/react-flow-graph/types';
import { MEMORY_TYPE_TABS, memoryTypeLabel } from '@/types/memory';
import type {
  MemoryCatalogGroupKey,
  MemoryCatalogItem,
  MemoryCatalogRefType,
  MemoryTypeTabId,
  WorkflowMemoryLinkTargetType,
} from '@/types/memory';

type WorkflowExecutionHost = 'local' | 'docker';
type WorkflowAutoSaveStatus = 'idle' | 'saving' | 'saved' | 'blocked' | 'error';
type ToolParameterFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
type ToolParameterFieldFilledBy = 'user' | 'agent' | 'user_or_agent';
type WorkflowGraphReviewTargetType = 'task' | 'approval' | 'agent' | 'tool' | 'memory' | 'artifact';
type WorkflowScopedState<T> = {
  workflowId: string;
  value: T;
};
interface WorkflowGraphReviewTarget {
  type: WorkflowGraphReviewTargetType;
  id: string;
  label: string;
}
interface WorkflowGraphReviewNote extends JsonObject {
  target_type: WorkflowGraphReviewTargetType;
  target_id: string;
  note: string;
  updated_at: string;
  updated_by?: string | null;
}
interface ToolParameterField {
  name: string;
  type: ToolParameterFieldType;
  required: boolean;
  description?: string;
  enumValues?: string[];
  defaultValue?: JsonValue;
  filledBy: ToolParameterFieldFilledBy;
  userVisible: boolean;
}
interface SelectedGraphEdgeReference {
  id: string;
  agentId: string | null;
  taskId: string | null;
  toolId: string | null;
  toolIds: string[];
  memoryId: string | null;
  sourceTaskId: string | null;
  targetTaskId: string | null;
}
interface WorkflowUpdateOverrides {
  defaultRuntimeAdapterId?: string;
  allowedRuntimeAdapterIds?: string[];
  executionHost?: WorkflowExecutionHost;
  keepEditing?: boolean;
}

const connectorBindingMetadataKeys = [
  'workspace_id',
  'workspace_name',
  'tenant_id',
  'team_id',
  'channel_id',
  'default_channel_id',
  'guild_id',
  'default_guild_id',
  'bot_user_id',
  'bot_username',
  'phone_number_id',
  'display_phone_number',
  'mailbox',
  'owner',
  'repo',
  'bucket',
  'region',
  'folder_id',
] as const;

const workflowGraphReviewNotesMetadataKey = 'workflow_graph_review_notes';

function credentialBindingLabel(credential: CredentialDefinition) {
  const metadata = credential.metadata ?? {};
  const summary = connectorBindingMetadataKeys
    .flatMap((key) => {
      const value = metadata[key];
      if (typeof value === 'string' && value.trim()) {
        return [`${key}: ${value.trim()}`];
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return [`${key}: ${String(value)}`];
      }
      return [];
    })
    .slice(0, 3)
    .join(' | ');
  return summary ? `${credential.name} (${summary})` : credential.name;
}

function firstConnectorBinding(tool: ToolDefinition | null): ConnectorBindingDefinition | null {
  const bindings = tool?.security?.connector_bindings;
  return Array.isArray(bindings) && bindings.length > 0
    ? (bindings[0] as ConnectorBindingDefinition)
    : null;
}

function parseTargetScopeJson(value: string): JsonObject {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Target scope must be a JSON object.');
  }
  return parsed as JsonObject;
}

function parseConnectorTargetScopeForm(
  data: FormData,
  provider: string,
  connectorCapabilities: Record<string, ConnectorCapabilityDefinition>,
  previousTargetScope: JsonObject = {}
): JsonObject {
  const targetFields = connectorCapabilities[provider]?.targetScopeMetadata ?? [];
  if (targetFields.length === 0) {
    return parseTargetScopeJson(String(data.get('target_scope') ?? ''));
  }

  const fieldKeys = new Set(targetFields.map((field) => field.key));
  const nextTargetScope: JsonObject = { ...previousTargetScope };
  for (const field of targetFields) {
    const rawValue = String(data.get(`target_scope.${field.key}`) ?? '').trim();
    if (rawValue) {
      nextTargetScope[field.key] = rawValue;
    } else {
      delete nextTargetScope[field.key];
    }
  }

  // Preserve custom target keys operators already saved for this same provider.
  for (const key of Object.keys(previousTargetScope)) {
    if (!fieldKeys.has(key)) {
      nextTargetScope[key] = previousTargetScope[key];
    }
  }
  return nextTargetScope;
}

function connectorRequirementLabel(field: { key: string; label?: unknown }) {
  return typeof field.label === 'string' && field.label.trim() ? field.label : field.key;
}

function normalizeConnectorHint(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function compactConnectorSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function resolveConnectorProviderHint(
  value: unknown,
  connectorCapabilities: Record<string, ConnectorCapabilityDefinition>
) {
  const normalized = normalizeConnectorHint(value);
  if (!normalized) {
    return '';
  }
  if (connectorCapabilities[normalized]) {
    return normalized;
  }
  return (
    Object.values(connectorCapabilities).find((capability) =>
      [capability.backendKey, capability.displayName, ...(capability.providerAliases ?? [])]
        .map(normalizeConnectorHint)
        .includes(normalized)
    )?.backendKey ?? ''
  );
}

function connectorProviderHintForTool(
  tool: ToolDefinition,
  connectorCapabilities: Record<string, ConnectorCapabilityDefinition>
) {
  const config =
    tool.implementation?.config && typeof tool.implementation.config === 'object'
      ? (tool.implementation.config as Record<string, unknown>)
      : {};
  for (const key of ['provider', 'provider_key', 'connector', 'connector_provider']) {
    const provider = resolveConnectorProviderHint(config[key], connectorCapabilities);
    if (provider) {
      return provider;
    }
  }

  const toolSearchText = compactConnectorSearchText(
    [tool.id, tool.name, tool.display_name, tool.description].filter(Boolean).join(' ')
  );
  return (
    Object.values(connectorCapabilities).find((capability) =>
      [capability.backendKey, capability.displayName, ...(capability.providerAliases ?? [])]
        .map((value) => compactConnectorSearchText(String(value)))
        .some((value) => value && toolSearchText.includes(value))
    )?.backendKey ?? ''
  );
}

function connectorCredentialMetadataValue(credential: CredentialDefinition | null, key: string) {
  if (!credential) {
    return '';
  }

  const metadata = credential.metadata ?? {};
  const candidateKeys = new Set([
    key,
    key.startsWith('default_') ? key.slice('default_'.length) : `default_${key}`,
  ]);

  for (const candidateKey of candidateKeys) {
    const value = metadata[candidateKey];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return '';
}

function connectorCredentialTargetScopeDefaults(
  credential: CredentialDefinition | null,
  targetScopeFields: ConnectorMetadataRequirementDefinition[]
) {
  return targetScopeFields.reduce<Record<string, string>>((defaults, field) => {
    const value = connectorCredentialMetadataValue(credential, field.key);
    if (value) {
      defaults[field.key] = value;
    }
    return defaults;
  }, {});
}

function connectorCredentialPurposeDefault(credential: CredentialDefinition | null) {
  return (
    connectorCredentialMetadataValue(credential, 'purpose') ||
    connectorCredentialMetadataValue(credential, 'connector_purpose')
  );
}

function toolHasConnectorSignal(tool: ToolDefinition) {
  const tags = (tool.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.some((tag) => ['connector', 'integration'].includes(tag))) {
    return true;
  }
  const config =
    tool.implementation?.config && typeof tool.implementation.config === 'object'
      ? (tool.implementation.config as Record<string, unknown>)
      : {};
  return ['provider', 'provider_key', 'connector', 'connector_provider'].some(
    (key) => typeof config[key] === 'string' && Boolean((config[key] as string).trim())
  );
}

function normalizedToolSchemaType(value: unknown): ToolParameterFieldType {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    if (candidate === 'string') return 'string';
    if (candidate === 'number') return 'number';
    if (candidate === 'integer') return 'integer';
    if (candidate === 'boolean') return 'boolean';
    if (candidate === 'object') return 'object';
    if (candidate === 'array') return 'array';
  }
  return 'string';
}

function normalizedToolParameterFieldOwner(value: unknown): ToolParameterFieldFilledBy {
  if (value === 'agent' || value === 'user_or_agent') {
    return value;
  }
  return 'user';
}

function toolParameterFields(tool: ToolDefinition): ToolParameterField[] {
  const schema = tool.input_schema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return [];
  }

  const properties = schema.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return [];
  }

  const requiredSet = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((value): value is string => typeof value === 'string')
      : []
  );

  const fields = Object.entries(properties).flatMap(
    ([name, propertySchema]): ToolParameterField[] => {
      if (!propertySchema || typeof propertySchema !== 'object' || Array.isArray(propertySchema)) {
        return [];
      }

      const fieldSchema = propertySchema as Record<string, unknown>;
      const enumValues = Array.isArray(fieldSchema.enum)
        ? fieldSchema.enum.filter((value): value is string => typeof value === 'string')
        : undefined;

      return [
        {
          name,
          type: normalizedToolSchemaType(fieldSchema.type),
          required: requiredSet.has(name),
          description:
            typeof fieldSchema.description === 'string' ? fieldSchema.description : undefined,
          enumValues: enumValues && enumValues.length > 0 ? enumValues : undefined,
          defaultValue: fieldSchema.default as JsonValue | undefined,
          filledBy: normalizedToolParameterFieldOwner(fieldSchema['x-agency-filled-by']),
          userVisible: fieldSchema['x-agency-user-visible'] !== false,
        },
      ];
    }
  );

  return fields.filter((field) => field.userVisible);
}

function formatToolParameterDraftValue(
  value: JsonValue | undefined,
  field: ToolParameterField
): string {
  const resolvedValue = value ?? field.defaultValue;
  if (resolvedValue === undefined || resolvedValue === null) {
    return '';
  }
  if (field.type === 'object' || field.type === 'array') {
    return JSON.stringify(resolvedValue, null, 2);
  }
  if (typeof resolvedValue === 'boolean') {
    return resolvedValue ? 'true' : 'false';
  }
  return String(resolvedValue);
}

function parseToolParameterDraftValue(
  value: string,
  field: ToolParameterField
): { parsed?: JsonValue; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { parsed: undefined };
  }

  if (field.enumValues?.length && !field.enumValues.includes(trimmed)) {
    return { error: `${field.name} must be one of ${field.enumValues.join(', ')}.` };
  }

  if (field.type === 'number' || field.type === 'integer') {
    const numericValue = field.type === 'integer' ? Number.parseInt(trimmed, 10) : Number(trimmed);
    if (Number.isNaN(numericValue)) {
      return {
        error: `${field.name} must be a valid ${field.type === 'integer' ? 'integer' : 'number'}.`,
      };
    }
    return { parsed: numericValue };
  }

  if (field.type === 'boolean') {
    if (trimmed !== 'true' && trimmed !== 'false') {
      return { error: `${field.name} must be true or false.` };
    }
    return { parsed: trimmed === 'true' };
  }

  if (field.type === 'object' || field.type === 'array') {
    try {
      const parsed = JSON.parse(trimmed) as JsonValue;
      if (
        field.type === 'object' &&
        (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      ) {
        return { error: `${field.name} must be a JSON object.` };
      }
      if (field.type === 'array' && !Array.isArray(parsed)) {
        return { error: `${field.name} must be a JSON array.` };
      }
      return { parsed };
    } catch {
      return { error: `${field.name} must be valid JSON.` };
    }
  }

  return { parsed: trimmed };
}

function runtimeToolConfigsForAgent(agent: AgentDefinition | null): WorkflowAgentToolConfig[] {
  const runtimeConfig = agent?.metadata?.runtime_config;
  if (!runtimeConfig || typeof runtimeConfig !== 'object' || Array.isArray(runtimeConfig)) {
    return [];
  }
  const toolConfigs = (runtimeConfig as Record<string, unknown>).tool_configs;
  return Array.isArray(toolConfigs)
    ? toolConfigs.filter(
        (value): value is WorkflowAgentToolConfig =>
          Boolean(value) &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          typeof (value as { id?: unknown }).id === 'string'
      )
    : [];
}

function runtimeParametersForTool(
  agent: AgentDefinition | null,
  toolId: string
): Record<string, JsonValue> {
  const config = runtimeToolConfigsForAgent(agent).find((candidate) => candidate.id === toolId);
  return config?.parameters && typeof config.parameters === 'object' ? config.parameters : {};
}

function withAgentToolRuntimeConfig(
  agent: AgentDefinition,
  tool: ToolDefinition,
  parameters: Record<string, JsonValue>
): AgentDefinition {
  const currentConfigs = runtimeToolConfigsForAgent(agent).filter(
    (candidate) => candidate.id !== tool.id
  );
  const runtimeConfig =
    agent.metadata?.runtime_config &&
    typeof agent.metadata.runtime_config === 'object' &&
    !Array.isArray(agent.metadata.runtime_config)
      ? { ...(agent.metadata.runtime_config as Record<string, unknown>) }
      : {};

  return {
    ...agent,
    metadata: {
      ...(agent.metadata ?? {}),
      runtime_config: {
        ...(runtimeConfig as JsonObject),
        tool_configs: [
          ...currentConfigs,
          {
            id: tool.id,
            name: tool.display_name ?? tool.name,
            description: tool.description,
            parameters,
          } as unknown as JsonObject,
        ] as unknown as JsonValue,
      } as JsonObject,
    },
  };
}

function withoutAgentToolRuntimeConfig(agent: AgentDefinition, toolIds: string[]): AgentDefinition {
  const currentConfigs = runtimeToolConfigsForAgent(agent);
  if (currentConfigs.length === 0) {
    return agent;
  }

  const nextConfigs = currentConfigs.filter((candidate) => !toolIds.includes(candidate.id));
  if (nextConfigs.length === currentConfigs.length) {
    return agent;
  }

  const runtimeConfig =
    agent.metadata?.runtime_config &&
    typeof agent.metadata.runtime_config === 'object' &&
    !Array.isArray(agent.metadata.runtime_config)
      ? { ...(agent.metadata.runtime_config as Record<string, unknown>) }
      : {};

  if (nextConfigs.length === 0) {
    delete runtimeConfig.tool_configs;
  } else {
    runtimeConfig.tool_configs = nextConfigs;
  }

  return {
    ...agent,
    metadata: {
      ...(agent.metadata ?? {}),
      runtime_config: runtimeConfig as JsonObject,
    },
  };
}

function toolParameterFieldsForEditing(
  fields: ToolParameterField[],
  mode: 'default' | 'runtime-only' = 'default'
) {
  if (mode === 'runtime-only') {
    return {
      editableFields: [] as ToolParameterField[],
      runtimeFields: fields,
    };
  }

  return {
    editableFields: fields.filter((field) => field.filledBy !== 'agent'),
    runtimeFields: fields.filter((field) => field.filledBy === 'agent'),
  };
}

function ToolParameterRuntimeHints({
  fields,
  description,
}: {
  fields: ToolParameterField[];
  description: string;
}) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-neutral-200 bg-neutral-50/80 p-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
          Filled by agent at runtime
        </p>
        <p className="mt-1 text-xs text-neutral-500">{description}</p>
      </div>
      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.name} className="rounded-md border border-neutral-200 bg-white px-3 py-2">
            <p className="text-sm font-medium text-neutral-900">
              {field.name}
              {field.required ? ' *' : ''}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {field.description || 'This value is supplied by the agent when the tool runs.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolParameterEditor({
  tool,
  agent,
  isEditing,
  onSave,
  onClear,
  mode = 'default',
}: {
  tool: ToolDefinition;
  agent: AgentDefinition;
  isEditing: boolean;
  onSave: (parameters: Record<string, JsonValue>) => void;
  onClear: () => void;
  mode?: 'default' | 'runtime-only';
}) {
  const fields = useMemo(() => toolParameterFields(tool), [tool]);
  const { editableFields, runtimeFields } = useMemo(
    () => toolParameterFieldsForEditing(fields, mode),
    [fields, mode]
  );
  const [draftValues, setDraftValues] = useState<Record<string, string>>(() => {
    const currentParameters = runtimeParametersForTool(agent, tool.id);
    return editableFields.reduce<Record<string, string>>((draft, field) => {
      draft[field.name] = formatToolParameterDraftValue(currentParameters[field.name], field);
      return draft;
    }, {});
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  if (editableFields.length === 0 && runtimeFields.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-white p-3 text-xs text-neutral-500">
        This tool does not expose configurable input parameters.
      </div>
    );
  }

  if (editableFields.length === 0) {
    return (
      <ToolParameterRuntimeHints
        fields={runtimeFields}
        description="These values are expected from the agent when the tool executes."
      />
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border border-neutral-200 bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const nextParameters: Record<string, JsonValue> = {};

        for (const field of editableFields) {
          const rawValue = draftValues[field.name] ?? '';
          if (!rawValue.trim()) {
            if (field.required) {
              setValidationError(`${field.name} is required.`);
              return;
            }
            continue;
          }

          const parsed = parseToolParameterDraftValue(rawValue, field);
          if (parsed.error) {
            setValidationError(parsed.error);
            return;
          }
          if (parsed.parsed !== undefined) {
            nextParameters[field.name] = parsed.parsed;
          }
        }

        setValidationError(null);
        onSave(nextParameters);
      }}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
          Tool parameters
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Save default parameter values for this tool on {agent.name || agent.id}.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {editableFields.map((field) => (
          <label
            key={field.name}
            className={
              field.type === 'object' || field.type === 'array'
                ? 'space-y-1 md:col-span-2'
                : 'space-y-1'
            }
          >
            <span className="text-xs font-medium text-neutral-500">
              {field.name}
              {field.required ? ' *' : ''}
            </span>
            {field.enumValues?.length ? (
              <select
                value={draftValues[field.name] ?? ''}
                disabled={!isEditing}
                className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:bg-neutral-100 disabled:text-neutral-500"
                onChange={(event) =>
                  setDraftValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
              >
                <option value="">Select value</option>
                {field.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : field.type === 'object' || field.type === 'array' ? (
              <Textarea
                value={draftValues[field.name] ?? ''}
                disabled={!isEditing}
                className="min-h-24 font-mono text-xs"
                placeholder={field.type === 'object' ? '{\n  \n}' : '[\n  \n]'}
                onChange={(event) =>
                  setDraftValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
              />
            ) : field.type === 'boolean' ? (
              <select
                value={draftValues[field.name] ?? ''}
                disabled={!isEditing}
                className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:bg-neutral-100 disabled:text-neutral-500"
                onChange={(event) =>
                  setDraftValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
              >
                <option value="">Select value</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <Input
                type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
                step={field.type === 'integer' ? '1' : 'any'}
                value={draftValues[field.name] ?? ''}
                disabled={!isEditing}
                onChange={(event) =>
                  setDraftValues((current) => ({ ...current, [field.name]: event.target.value }))
                }
              />
            )}
            {field.description ? (
              <span className="block text-xs text-neutral-500">{field.description}</span>
            ) : null}
          </label>
        ))}
      </div>

      <ToolParameterRuntimeHints
        fields={runtimeFields}
        description="These values remain the agent's responsibility when the tool runs."
      />

      {validationError ? <p className="text-xs text-red-600">{validationError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!isEditing}>
          Save parameters
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!isEditing} onClick={onClear}>
          Clear parameters
        </Button>
      </div>
    </form>
  );
}

function integrationSetupHrefForProvider(providerKey: string) {
  return integrationConnectorHrefForProviderKey(providerKey);
}

function ConnectorBindingFields({
  binding,
  defaultProvider,
  connectorCredentials,
  connectorCapabilities,
  isEditing,
  purposePlaceholder,
}: {
  binding: ConnectorBindingDefinition | null;
  defaultProvider?: string;
  connectorCredentials: CredentialDefinition[];
  connectorCapabilities: Record<string, ConnectorCapabilityDefinition>;
  isEditing: boolean;
  purposePlaceholder: string;
}) {
  const [draftProvider, setDraftProvider] = useState(binding?.provider ?? defaultProvider ?? '');
  const [draftCredentialId, setDraftCredentialId] = useState(binding?.credential_id ?? '');

  const selectedProvider = binding?.provider ?? draftProvider ?? '';
  const selectedCapability = selectedProvider ? connectorCapabilities[selectedProvider] : null;
  const selectedProviderName = selectedCapability?.displayName ?? selectedProvider;
  const providerCredentials = useMemo(
    () =>
      connectorCredentials.filter((credential) =>
        selectedProvider ? credential.provider === selectedProvider : false
      ),
    [connectorCredentials, selectedProvider]
  );
  const providerCredentialIds = useMemo(
    () => providerCredentials.map((credential) => credential.id),
    [providerCredentials]
  );
  const preferredCredentialId =
    binding?.credential_id ??
    (providerCredentialIds.length === 1 && !draftCredentialId
      ? providerCredentialIds[0]
      : providerCredentialIds.includes(draftCredentialId)
        ? draftCredentialId
        : '');

  const selectedCredential =
    providerCredentials.find((credential) => credential.id === preferredCredentialId) ?? null;
  const setupHref = selectedProvider ? integrationSetupHrefForProvider(selectedProvider) : null;
  const targetScopeFields = selectedProvider
    ? (connectorCapabilities[selectedProvider]?.targetScopeMetadata ?? [])
    : [];
  const credentialPurposeDefault = selectedCredential
    ? connectorCredentialPurposeDefault(selectedCredential)
    : '';
  const targetScopeDefaults = binding?.target_scope
    ? (binding.target_scope as Record<string, unknown>)
    : connectorCredentialTargetScopeDefaults(selectedCredential, targetScopeFields);

  return (
    <>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs font-medium text-neutral-500">Provider</span>
          {binding?.provider || defaultProvider ? (
            <>
              <Input aria-label="Provider" value={selectedProviderName} readOnly />
              <input type="hidden" name="provider" value={selectedProvider} />
            </>
          ) : (
            <select
              aria-label="Provider"
              name="provider"
              value={draftProvider}
              disabled={!isEditing}
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:bg-neutral-100 disabled:text-neutral-500"
              onChange={(event) => setDraftProvider(event.target.value)}
            >
              <option value="">Select provider</option>
              {Object.values(connectorCapabilities)
                .slice()
                .sort((left, right) =>
                  (left.displayName ?? left.backendKey).localeCompare(
                    right.displayName ?? right.backendKey
                  )
                )
                .map((capability) => (
                  <option key={capability.backendKey} value={capability.backendKey}>
                    {capability.displayName ?? capability.backendKey}
                  </option>
                ))}
            </select>
          )}
        </div>
        <label className="space-y-1">
          <span className="text-xs font-medium text-neutral-500">Credential</span>
          <select
            name="credential_id"
            value={preferredCredentialId}
            required
            disabled={!isEditing || !selectedProvider || providerCredentials.length === 0}
            className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:bg-neutral-100 disabled:text-neutral-500"
            onChange={(event) => setDraftCredentialId(event.target.value)}
          >
            <option value="">
              {providerCredentials.length > 0
                ? `Select ${selectedProviderName} credential`
                : `No ${selectedProviderName} credentials available`}
            </option>
            {providerCredentials.map((credential) => (
              <option key={credential.id} value={credential.id}>
                {credentialBindingLabel(credential)}
              </option>
            ))}
          </select>
          {providerCredentials.length === 0 && setupHref ? (
            <span className="flex flex-wrap items-center gap-2 text-xs text-amber-700">
              <span>No {selectedProviderName} credentials are saved yet.</span>
              <Link
                href={setupHref}
                className="inline-flex h-8 items-center justify-center rounded-md border border-amber-200 bg-white px-3 text-xs font-medium text-amber-800 shadow-sm hover:bg-amber-100"
              >
                Set up {selectedProviderName}
              </Link>
            </span>
          ) : null}
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-xs font-medium text-neutral-500">Purpose</span>
        <Input
          key={`purpose-${preferredCredentialId || 'none'}`}
          name="purpose"
          defaultValue={binding?.purpose ?? credentialPurposeDefault}
          disabled={!isEditing}
          readOnly={Boolean(credentialPurposeDefault)}
          placeholder={purposePlaceholder}
        />
      </label>
      {targetScopeFields.length > 0 ? (
        <div
          key={`${selectedProvider || 'provider'}-${preferredCredentialId || 'credential'}-target-scope`}
          className="grid gap-2 md:grid-cols-2"
        >
          {targetScopeFields.map((field) => (
            <label key={field.key} className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">
                {connectorRequirementLabel(field)}
              </span>
              <Input
                name={`target_scope.${field.key}`}
                defaultValue={String(targetScopeDefaults[field.key] ?? '')}
                disabled={!isEditing}
                readOnly={Boolean(connectorCredentialMetadataValue(selectedCredential, field.key))}
                required={Boolean(field.required)}
                aria-label={connectorRequirementLabel(field)}
              />
              {field.description ? (
                <span className="block text-xs text-neutral-500">{field.description}</span>
              ) : null}
            </label>
          ))}
        </div>
      ) : (
        <label className="space-y-1">
          <span className="text-xs font-medium text-neutral-500">Target scope JSON</span>
          <Textarea
            name="target_scope"
            defaultValue={JSON.stringify(binding?.target_scope ?? {}, null, 2)}
            disabled={!isEditing}
            className="min-h-24 font-mono text-xs"
          />
        </label>
      )}
    </>
  );
}

function applyMonitoringPatch(
  monitoring: WorkflowMonitoringOperatorPayload,
  patch: Record<string, unknown>
): WorkflowMonitoringOperatorPayload {
  const next: WorkflowMonitoringOperatorPayload = {
    ...monitoring,
    controls: {
      ...monitoring.controls,
    },
  };

  if (typeof patch.enabled === 'boolean') {
    next.enabled = patch.enabled;
    next.exempted = !patch.enabled;
    next.controls.enabled = patch.enabled;
  }
  if (typeof patch.reason === 'string') {
    next.reason = patch.reason;
  }
  if (typeof patch.level === 'string') {
    next.level = patch.level;
    next.controls.level = patch.level;
  }
  if (typeof patch.allow_self_monitoring === 'boolean') {
    next.controls.allow_self_monitoring = patch.allow_self_monitoring;
  }

  (
    [
      'allow_improvement_proposals',
      'route_improvement_proposals_to_approval',
      'supervise_token_usage',
      'supervise_context_health',
      'supervise_subagents',
      'supervise_tool_failures',
      'delegate_hitl_to_main_agent',
      'route_steering_requests_to_approval',
    ] as const
  ).forEach((key) => {
    if (typeof patch[key] === 'boolean') {
      next.controls[key] = patch[key];
    }
  });

  (
    [
      'excluded_subagent_ids',
      'excluded_task_ids',
      'allowed_steering_actions',
      'auto_apply_steering_actions',
    ] as const
  ).forEach((key) => {
    const value = patch[key];
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      next.controls[key] = value;
    }
  });

  return next;
}

function personaNoticeKey(notice: PersonaAgentVersionNotice) {
  return `${notice.agentId}:${notice.workflowPersonaVersionId ?? 'unknown'}:${notice.currentPersonaVersionId}`;
}

function applyRuntimeGovernancePatch(
  governance: WorkflowRuntimeGovernanceOperatorPayload,
  patch: Record<string, unknown>
): WorkflowRuntimeGovernanceOperatorPayload {
  const next: WorkflowRuntimeGovernanceOperatorPayload = {
    ...governance,
    token_budget: {
      ...governance.token_budget,
    },
    context_compaction: {
      ...governance.context_compaction,
    },
    execution_policy: {
      ...(governance.execution_policy ?? {
        configured: false,
        approval_mode: 'task_policy',
        effective_concurrency_limit: 1,
      }),
    },
  };
  const tokenBudget = patch.tokenBudget ?? patch.token_budget;
  const contextCompaction = patch.contextCompaction ?? patch.context_compaction;
  const executionPolicy = patch.executionPolicy ?? patch.execution_policy;

  if (tokenBudget && typeof tokenBudget === 'object' && !Array.isArray(tokenBudget)) {
    const tokenPatch = tokenBudget as Record<string, unknown>;
    const hasTokenField = (key: string) => Object.prototype.hasOwnProperty.call(tokenPatch, key);
    const assignNumber = (
      camelKey: string,
      snakeKey: keyof WorkflowRuntimeGovernanceOperatorPayload['token_budget']
    ) => {
      if (hasTokenField(camelKey)) {
        const value = tokenPatch[camelKey];
        next.token_budget[snakeKey] = typeof value === 'number' ? value : null;
      }
    };
    assignNumber('runTotalTokens', 'run_total_tokens');
    assignNumber('workflowTotalTokens', 'workflow_total_tokens');
    assignNumber('agentTotalTokens', 'agent_total_tokens');
    assignNumber('warnRatio', 'warn_ratio');
    assignNumber('hardRatio', 'hard_ratio');
    if (typeof tokenPatch.action === 'string') {
      next.token_budget.action = tokenPatch.action;
    }
    // Keep the explicit-config signal aligned with backend semantics so
    // default display values are not mistaken for saved workflow policy.
    next.token_budget.configured = Boolean(
      next.token_budget.run_total_tokens !== null ||
      next.token_budget.workflow_total_tokens !== null ||
      next.token_budget.agent_total_tokens !== null ||
      hasTokenField('action') ||
      hasTokenField('warnRatio') ||
      hasTokenField('hardRatio')
    );
  }

  if (
    contextCompaction &&
    typeof contextCompaction === 'object' &&
    !Array.isArray(contextCompaction)
  ) {
    const compactionPatch = contextCompaction as Record<string, unknown>;
    const assignNumber = (
      camelKey: string,
      snakeKey: keyof WorkflowRuntimeGovernanceOperatorPayload['context_compaction']
    ) => {
      if (Object.prototype.hasOwnProperty.call(compactionPatch, camelKey)) {
        const value = compactionPatch[camelKey];
        // Clearing a compaction field means "let the backend restore its default",
        // not "force the UI cache to zero" before the response arrives.
        if (typeof value === 'number') {
          next.context_compaction[snakeKey] = value;
        }
      }
    };
    if (typeof compactionPatch.enabled === 'boolean') {
      next.context_compaction.enabled = compactionPatch.enabled;
    }
    if (typeof compactionPatch.persistContextPack === 'boolean') {
      next.context_compaction.persist_context_pack = compactionPatch.persistContextPack;
      next.context_compaction.persist_context_pack_source = 'workflow';
    }
    assignNumber('preserveRecentMessages', 'preserve_recent_messages');
    assignNumber('oversizedMessageTokens', 'oversized_message_tokens');
    assignNumber('minEstimatedTokensSaved', 'min_estimated_tokens_saved');
    assignNumber('maxSummaryChars', 'max_summary_chars');
  }

  if (executionPolicy && typeof executionPolicy === 'object' && !Array.isArray(executionPolicy)) {
    const policyPatch = executionPolicy as Record<string, unknown>;
    const hasPolicyField = (key: string) => Object.prototype.hasOwnProperty.call(policyPatch, key);
    const assignNumber = (
      camelKey: string,
      snakeKey: 'max_runtime_seconds' | 'max_retries' | 'concurrency_limit'
    ) => {
      if (hasPolicyField(camelKey)) {
        const value = policyPatch[camelKey];
        next.execution_policy![snakeKey] = typeof value === 'number' ? value : null;
      }
    };
    assignNumber('maxRuntimeSeconds', 'max_runtime_seconds');
    assignNumber('maxRetries', 'max_retries');
    assignNumber('concurrencyLimit', 'concurrency_limit');
    if (typeof policyPatch.approvalMode === 'string') {
      next.execution_policy!.approval_mode = policyPatch.approvalMode;
    }
    next.execution_policy!.configured = Boolean(
      next.execution_policy!.max_runtime_seconds !== null ||
      next.execution_policy!.max_retries !== null ||
      next.execution_policy!.concurrency_limit !== null ||
      hasPolicyField('approvalMode')
    );
  }

  return next;
}

function normalizeWorkflowTab(value: string | null) {
  void value;
  return 'graph' as const;
}

function isWorkflowMode(value: string | null): value is 'edit' {
  return value === 'edit';
}

function toolDefinitionWithBackendSecurityDefaults(tool: ToolDefinition): ToolDefinition {
  if (tool.tool_type !== 'shell_command') {
    return tool;
  }

  return {
    ...tool,
    security: {
      ...(tool.security ?? {}),
      allow_shell: true,
      sandbox_required: true,
      requires_approval: true,
    },
  };
}

function mergeToolDefinitions(...toolGroups: ToolDefinition[][]) {
  const toolById = new Map<string, ToolDefinition>();
  toolGroups.flat().forEach((tool) => {
    toolById.set(tool.id, toolDefinitionWithBackendSecurityDefaults(tool));
  });
  return Array.from(toolById.values());
}

function toolDefinitionsForAssignedAgents(
  agents: Array<{ tool_ids?: string[] }>,
  workflowTools: ToolDefinition[],
  availableTools: ToolDefinition[]
) {
  const availableToolById = new Map(
    mergeToolDefinitions(workflowTools, availableTools).map((tool) => [tool.id, tool])
  );
  const assignedToolIds = new Set(agents.flatMap((agent) => agent.tool_ids ?? []));
  return Array.from(assignedToolIds)
    .map((toolId) => availableToolById.get(toolId))
    .filter((tool): tool is ToolDefinition => Boolean(tool));
}

function toolSearchText(tool: ToolDefinition) {
  return [
    tool.id,
    tool.name,
    tool.display_name,
    toolDisplayName(tool),
    tool.description,
    tool.tool_type,
    ...(tool.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
}

function readableToolGroupName(groupName: string) {
  return groupName.replace(/[_-]+/g, ' ');
}

function memoryDisplayName(memory: WorkflowMemoryDefinition) {
  return memory.name || memory.id;
}

function readableMemoryValue(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : 'unknown';
}

function memoryCatalogItemKey(item: Pick<MemoryCatalogItem, 'refType' | 'id'>) {
  return `${item.refType}:${item.id}`;
}

function isMemoryCatalogRefType(value: unknown): value is MemoryCatalogRefType {
  return value === 'memory' || value === 'memory_collection';
}

function workflowGraphReviewNoteKey(target: Pick<WorkflowGraphReviewTarget, 'type' | 'id'>) {
  return `${target.type}:${target.id}`;
}

function isWorkflowGraphReviewTargetType(value: unknown): value is WorkflowGraphReviewTargetType {
  return (
    value === 'task' ||
    value === 'approval' ||
    value === 'agent' ||
    value === 'tool' ||
    value === 'memory' ||
    value === 'artifact'
  );
}

function isWorkflowGraphReviewNote(value: unknown): value is WorkflowGraphReviewNote {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isWorkflowGraphReviewTargetType((value as { target_type?: unknown }).target_type) &&
    typeof (value as { target_id?: unknown }).target_id === 'string' &&
    typeof (value as { note?: unknown }).note === 'string' &&
    typeof (value as { updated_at?: unknown }).updated_at === 'string'
  );
}

function workflowGraphReviewNotesFor(
  workflow: Pick<WorkflowDefinition, 'metadata'> | null | undefined
) {
  const notes = workflow?.metadata?.[workflowGraphReviewNotesMetadataKey];
  return Array.isArray(notes) ? notes.filter(isWorkflowGraphReviewNote) : [];
}

function nextWorkflowGraphReviewNotes(
  currentNotes: WorkflowGraphReviewNote[],
  target: WorkflowGraphReviewTarget,
  note: string,
  actorUserId: string
) {
  const nextNote = note.trim();
  const targetKey = workflowGraphReviewNoteKey(target);
  const retainedNotes = currentNotes.filter(
    (candidate) =>
      workflowGraphReviewNoteKey({ type: candidate.target_type, id: candidate.target_id }) !==
      targetKey
  );

  if (!nextNote) {
    return retainedNotes;
  }

  return [
    ...retainedNotes,
    {
      target_type: target.type,
      target_id: target.id,
      note: nextNote,
      updated_at: new Date().toISOString(),
      updated_by: actorUserId,
    },
  ];
}

function workflowMemoryLinkTargetValue(
  targetType: WorkflowMemoryLinkTargetType,
  targetId?: string | null
) {
  return `${targetType}:${targetId ?? ''}`;
}

function memoryCatalogNodeMetadata(item: MemoryCatalogItem) {
  return {
    catalog_ref_type: item.refType,
    catalog_ref_id: item.id,
    catalog_memory_type: item.memoryType ?? null,
    catalog_mode: item.mode ?? null,
    catalog_sensitive: item.sensitive,
    catalog_embedded: item.embedded,
    catalog_document_id: item.documentId ?? null,
    catalog_conversation_id: item.conversationId ?? null,
    catalog_workflow_id: item.workflowId ?? null,
    catalog_agent_id: item.agentId ?? null,
  };
}

function memoryCatalogItemMatchesTab(
  item: MemoryCatalogItem,
  groupKey: MemoryCatalogGroupKey,
  tabId: MemoryTypeTabId
) {
  if (tabId === 'all') {
    return true;
  }

  const tab = MEMORY_TYPE_TABS.find((candidate) => candidate.id === tabId);
  if (!tab) {
    return true;
  }

  return (
    (item.memoryType ? tab.memoryTypes.includes(item.memoryType) : false) ||
    tab.catalogGroups.includes(groupKey)
  );
}

function readGraphEdgeDataString(edge: GraphEdge | null | undefined, key: string) {
  const value = edge?.data?.[key];
  return typeof value === 'string' ? value : null;
}

function readGraphEdgeDataStringArray(edge: GraphEdge | null | undefined, key: string) {
  const value = edge?.data?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function readGraphRuntimeEventString(event: GraphRuntimeEvent, key: string) {
  const metadataValue = event.metadata?.[key];
  if (typeof metadataValue === 'string') {
    return metadataValue;
  }

  const payloadValue = event.payload?.[key];
  return typeof payloadValue === 'string' ? payloadValue : null;
}

function graphRuntimeEventRunId(event: GraphRuntimeEvent) {
  return (
    readGraphRuntimeEventString(event, 'runId') ??
    readGraphRuntimeEventString(event, 'executionId') ??
    null
  );
}

function graphRuntimeEventToolId(event: GraphRuntimeEvent) {
  const payloadEvidence = event.payload?.evidence;
  const evidenceTool =
    payloadEvidence && typeof payloadEvidence === 'object' && !Array.isArray(payloadEvidence)
      ? ((payloadEvidence as Record<string, unknown>).toolId ??
        (payloadEvidence as Record<string, unknown>).tool_id ??
        (payloadEvidence as Record<string, unknown>).tool)
      : null;

  return (
    readGraphRuntimeEventString(event, 'toolId') ??
    readGraphRuntimeEventString(event, 'tool_id') ??
    readGraphRuntimeEventString(event, 'tool') ??
    (typeof evidenceTool === 'string' ? evidenceTool : null)
  );
}

function graphRuntimeEventPendingApprovalTool(event: GraphRuntimeEvent, runId: string) {
  if (graphRuntimeEventRunId(event) !== runId) {
    return null;
  }

  const normalizedType = event.type.replace(/_/g, '.').toLowerCase();
  if (
    !normalizedType.includes('approval') ||
    normalizedType.endsWith('.granted') ||
    normalizedType.endsWith('.approved') ||
    normalizedType.endsWith('.rejected') ||
    normalizedType.endsWith('.resolved')
  ) {
    return null;
  }

  return graphRuntimeEventToolId(event);
}

function graphEdgeReference(edge: GraphEdge): SelectedGraphEdgeReference {
  return {
    id: edge.id,
    agentId: readGraphEdgeDataString(edge, 'agentId'),
    taskId: readGraphEdgeDataString(edge, 'taskId'),
    toolId: readGraphEdgeDataString(edge, 'toolId'),
    toolIds: readGraphEdgeDataStringArray(edge, 'toolIds'),
    memoryId: readGraphEdgeDataString(edge, 'memoryId'),
    sourceTaskId: readGraphEdgeDataString(edge, 'sourceTaskId'),
    targetTaskId: readGraphEdgeDataString(edge, 'targetTaskId'),
  };
}

const noModelProfileValue = '__no-model-profile__';
const noGraphEdgeAgentValue = '__no-graph-edge-agent__';
const workflowGraphRunEventLimit = 5;
const terminalWorkflowRunStatuses = new Set(['completed', 'failed', 'cancelled']);

interface BackendWorkflowValidationIssue {
  code?: unknown;
  message?: unknown;
  severity?: unknown;
}

interface BackendWorkflowValidationSummary {
  errors: string[];
  warnings: string[];
}

function workflowRunTimestamp(run: WorkflowRun) {
  return run.updatedAt ?? run.completedAt ?? run.startedAt ?? run.createdAt ?? '';
}

function workflowRunHasEnded(run: WorkflowRun) {
  return terminalWorkflowRunStatuses.has(run.status);
}

function workflowTaskNodesInRuntimeOrder(workflow: WorkflowDefinition | null | undefined) {
  const nodes = workflow?.nodes ?? [];
  if (nodes.length === 0) {
    return [];
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  (workflow?.edges ?? []).forEach((edge) => {
    outgoing.set(edge.source_node_id, [
      ...(outgoing.get(edge.source_node_id) ?? []),
      edge.target_node_id,
    ]);
    indegree.set(edge.target_node_id, (indegree.get(edge.target_node_id) ?? 0) + 1);
  });

  const queue: string[] = [];
  if (workflow?.entrypoint && nodeById.has(workflow.entrypoint)) {
    queue.push(workflow.entrypoint);
  }
  nodes.forEach((node) => {
    if ((indegree.get(node.id) ?? 0) === 0 && node.id !== workflow?.entrypoint) {
      queue.push(node.id);
    }
  });

  const ordered: typeof nodes = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const nodeId = queue.shift() as string;
    const node = nodeById.get(nodeId);
    if (!node || seen.has(nodeId)) {
      continue;
    }
    seen.add(nodeId);
    ordered.push(node);
    (outgoing.get(nodeId) ?? []).forEach((targetId) => {
      indegree.set(targetId, (indegree.get(targetId) ?? 0) - 1);
      if ((indegree.get(targetId) ?? 0) <= 0) {
        queue.push(targetId);
      }
    });
  }

  nodes.forEach((node) => {
    if (!seen.has(node.id)) {
      ordered.push(node);
    }
  });

  return ordered.filter((node) => node.node_type === 'task' && typeof node.task_id === 'string');
}

function workflowCheckpointResumeTaskId(
  workflow: WorkflowDefinition | null | undefined,
  run: WorkflowRun | null | undefined
) {
  const nodeOutputs = run?.outputPayload?.node_outputs;
  if (!nodeOutputs || typeof nodeOutputs !== 'object' || Array.isArray(nodeOutputs)) {
    return null;
  }

  const completedNodeIds = new Set(Object.keys(nodeOutputs as JsonObject));
  const orderedTaskNodes = workflowTaskNodesInRuntimeOrder(workflow);
  const completedIndices = orderedTaskNodes
    .map((node, index) => (completedNodeIds.has(node.id) ? index : -1))
    .filter((index) => index >= 0);
  if (completedIndices.length === 0) {
    return null;
  }

  const lastCompletedIndex = Math.max(...completedIndices);
  const resumeNode = orderedTaskNodes
    .slice(lastCompletedIndex + 1)
    .find((node) => !completedNodeIds.has(node.id));
  return resumeNode?.task_id ?? null;
}

function profileNameFor(
  profileId: string | null | undefined,
  profiles: Array<{ id: string; name: string }>
) {
  if (!profileId) {
    return 'No profile';
  }

  return profiles.find((profile) => profile.id === profileId)?.name || profileId;
}

function personaSlugFromAgent(agent: AgentDefinition) {
  const slug = agent.metadata?.persona_slug;
  const generatedFromPersonaFactory = agent.metadata?.generated_from_persona_factory === true;
  return typeof slug === 'string' && slug.trim()
    ? slug.trim()
    : generatedFromPersonaFactory
      ? agent.name
      : null;
}

function isPersonaBackedAgent(agent: AgentDefinition) {
  return Boolean(personaSlugFromAgent(agent) || agent.metadata?.persona_id);
}

function graphAgentOptionLabel(agent: AgentDefinition, notice?: PersonaAgentVersionNotice) {
  const personaSlug = notice?.personaSlug ?? personaSlugFromAgent(agent);
  if (!personaSlug) {
    return agent.name;
  }

  const versionId = notice?.workflowPersonaVersionId;
  return `${agent.name} (@${personaSlug}${versionId ? ` ${shortPersonaVersionId(versionId)}` : ''})`;
}

function personaSnapshotFieldLabel(field: PersonaAgentSnapshotField) {
  if (field === 'model_profile_id') {
    return 'Model profile';
  }
  if (field === 'tool_ids') {
    return 'Tools';
  }
  if (field === 'memory_ids') {
    return 'Memory';
  }
  if (field === 'handoff_agent_ids') {
    return 'Handoffs';
  }
  if (field === 'system_prompt') {
    return 'System prompt';
  }
  return field.replace(/_/g, ' ').replace(/^\w/, (value) => value.toUpperCase());
}

function formatRuntimeJson(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function backendValidationIssueMessage(issue: BackendWorkflowValidationIssue) {
  const message = typeof issue.message === 'string' && issue.message.trim() ? issue.message : null;
  const code = typeof issue.code === 'string' && issue.code.trim() ? issue.code : null;

  if (message && code) {
    return `${message} (${code})`;
  }

  return message ?? code ?? 'Backend validation issue';
}

function summarizeBackendValidation(value: unknown): BackendWorkflowValidationSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { errors: [], warnings: [] };
  }

  const payload = value as Record<string, unknown>;
  const errors = Array.isArray(payload.validation_errors)
    ? payload.validation_errors.map((issue) =>
        backendValidationIssueMessage(issue as BackendWorkflowValidationIssue)
      )
    : [];
  const warnings = Array.isArray(payload.validation_warnings)
    ? payload.validation_warnings.map((issue) =>
        backendValidationIssueMessage(issue as BackendWorkflowValidationIssue)
      )
    : [];

  return { errors, warnings };
}

function runtimeEventSummary(event: GraphRuntimeEvent) {
  const payload = event.payload ?? {};
  const preferredKeys = ['message', 'summary', 'error', 'output', 'result', 'input', 'data'];
  const entry =
    preferredKeys
      .map((key) => [key, payload[key]] as const)
      .find(([, value]) => value !== undefined && value !== null) ??
    Object.entries(payload).find(([, value]) => value !== undefined && value !== null);

  if (!entry) {
    return null;
  }

  const [key, value] = entry;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${String(value)}`;
  }

  const serializedValue = formatRuntimeJson(value)?.replace(/\s+/g, ' ');
  return serializedValue
    ? `${key}: ${serializedValue.length > 96 ? `${serializedValue.slice(0, 93)}...` : serializedValue}`
    : null;
}

export default function WorkflowDetailWorkspace({ workflowId }: { workflowId: string }) {
  const { data: session } = useSession();
  const user = session?.user as AuthUser | undefined;
  const actorUserId = user?.id || user?.email || 'web-user';
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedGraphAgentId, setSelectedGraphAgentId] = useState<string | null>(null);
  const [selectedGraphToolId, setSelectedGraphToolId] = useState<string | null>(null);
  const [selectedGraphToolIds, setSelectedGraphToolIds] = useState<string[]>([]);
  const [selectedGraphToolNodeId, setSelectedGraphToolNodeId] = useState<string | null>(null);
  const [toolDrawerSearch, setToolDrawerSearch] = useState('');
  const [httpRequestSetupModeByToolId, setHttpRequestSetupModeByToolId] = useState<
    Record<string, 'binding' | 'parameters'>
  >({});
  const [selectedGraphMemoryId, setSelectedGraphMemoryId] = useState<string | null>(null);
  const [selectedGraphArtifactId, setSelectedGraphArtifactId] = useState<string | null>(null);
  const [selectedGraphApprovalTaskId, setSelectedGraphApprovalTaskId] = useState<string | null>(
    null
  );
  const [selectedMemoryTypeTab, setSelectedMemoryTypeTab] = useState<MemoryTypeTabId>('all');
  const [personaQuickCreateAgentId, setPersonaQuickCreateAgentId] = useState('');
  const [agentPromotionState, setAgentPromotionState] = useState({
    agentId: '',
    editorOpen: false,
    globalId: '',
    replaceWorkflowAgent: false,
  });
  const [selectedGraphEdgeRef, setSelectedGraphEdgeRef] =
    useState<SelectedGraphEdgeReference | null>(null);
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get('tab');
  const activeTab = normalizeWorkflowTab(requestedTab);
  const shouldRefreshRuntimeActivity = activeTab === 'graph';

  const workflowQuery = useQuery({
    queryKey: queryKeys.backendWorkflow(workflowId),
    queryFn: () => workflowsApi.getWorkflow(workflowId),
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowRuns(workflowId),
    queryFn: () => runsApi.listRunsForWorkflow(workflowId),
    refetchInterval: shouldRefreshRuntimeActivity ? 3000 : false,
  });
  const monitoringEventsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
    queryFn: () => workflowsApi.listWorkflowMonitoringEvents(workflowId),
    refetchInterval: shouldRefreshRuntimeActivity ? 3000 : false,
  });
  const runtimeGovernanceQuery = useQuery({
    queryKey: queryKeys.backendWorkflowRuntimeGovernance(workflowId),
    queryFn: () => workflowsApi.getWorkflowRuntimeGovernance(workflowId),
  });
  const workflowObservabilityMetricsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowObservabilityMetrics(workflowId),
    queryFn: () => observabilityApi.getWorkflowMetrics(workflowId),
    refetchInterval: shouldRefreshRuntimeActivity ? 5000 : false,
  });
  const workflowModelUsageQuery = useQuery({
    queryKey: queryKeys.backendWorkflowModelUsage(workflowId),
    queryFn: () => observabilityApi.getModelUsage({ workflowId }),
    refetchInterval: shouldRefreshRuntimeActivity ? 5000 : false,
  });
  const recentWorkflowRuns = useMemo(
    () =>
      shouldRefreshRuntimeActivity
        ? [...(runsQuery.data ?? [])]
            .sort((left, right) =>
              workflowRunTimestamp(right).localeCompare(workflowRunTimestamp(left))
            )
            .slice(0, workflowGraphRunEventLimit)
        : [],
    [runsQuery.data, shouldRefreshRuntimeActivity]
  );
  const workflowRunEventsQueries = useQueries({
    queries: recentWorkflowRuns.map((run) => ({
      queryKey: queryKeys.backendRunEvents(run.id),
      queryFn: () => logsApi.listRunEvents(run.id),
      enabled: Boolean(run.id) && shouldRefreshRuntimeActivity,
      refetchInterval: workflowRunHasEnded(run) ? false : 3000,
    })),
  });
  const sharedMemoryQuery = useQuery({
    queryKey: queryKeys.backendWorkflowSharedMemory(workflowId),
    queryFn: () => workflowsApi.getWorkflowSharedMemory(workflowId),
  });
  const workflowMemoriesQuery = useQuery({
    queryKey: queryKeys.backendWorkflowMemories(workflowId),
    queryFn: async () => {
      const response = await memoriesApi.listMemories({
        scope: 'workflow',
        workflow_id: workflowId,
        status: ['active'],
        limit: 10,
      });
      return response.items;
    },
  });
  const workflowMemoryLinksQuery = useQuery({
    queryKey: queryKeys.backendWorkflowMemoryLinks(workflowId),
    queryFn: () => workflowsApi.listWorkflowMemoryLinks(workflowId),
    enabled: activeTab === 'graph',
  });
  const memoryCatalogQuery = useQuery({
    queryKey: [
      ...queryKeys.backendMemoryCatalog(),
      workflowId,
      selectedGraphMemoryId,
      'workflow',
    ] as const,
    queryFn: () =>
      memoriesApi.listMemoryCatalog({
        workflow_id: workflowId,
        target_type: 'workflow',
        status: ['active'],
        limit_per_group: 8,
      }),
    enabled: activeTab === 'graph' && Boolean(selectedGraphMemoryId),
  });
  const agentMemoryCatalogQuery = useQuery({
    queryKey: [
      ...queryKeys.backendMemoryCatalog(),
      workflowId,
      selectedGraphAgentId,
      'agent-assignment',
    ] as const,
    queryFn: () =>
      memoriesApi.listMemoryCatalog({
        workflow_id: workflowId,
        target_type: 'agent',
        target_id: selectedGraphAgentId ?? undefined,
        status: ['active'],
        limit_per_group: 8,
      }),
    enabled: activeTab === 'graph' && Boolean(selectedGraphAgentId),
  });
  const schedulesQuery = useQuery({
    queryKey: queryKeys.backendWorkflowSchedules(workflowId),
    queryFn: async () => {
      const response = await schedulesApi.listSchedules();
      return response.items.filter((schedule) => schedule.workflow_id === workflowId);
    },
  });
  const profilesQuery = useQuery({
    queryKey: queryKeys.backendBehaviorProfiles(),
    queryFn: () => behaviorProfilesApi.listProfiles(),
  });
  const agentsQuery = useQuery({
    queryKey: queryKeys.backendAgentDefinitions(),
    queryFn: async () => {
      const response = await agentsApi.listAgents();
      return response.items;
    },
  });
  const personaVersionNoticesQuery = useQuery({
    queryKey: queryKeys.backendWorkflowPersonaVersionNotices(workflowId),
    queryFn: () => workflowsApi.listWorkflowPersonaVersionNotices(workflowId),
  });
  const runtimeAdaptersQuery = useQuery({
    queryKey: queryKeys.backendRuntimeAdapters(),
    queryFn: () => runtimeAdaptersApi.listRuntimeAdapters(),
  });
  const toolsQuery = useQuery({
    queryKey: queryKeys.tools(),
    queryFn: async () => {
      const response = await toolsApi.listTools();
      return response.items;
    },
  });
  const credentialsQuery = useQuery({
    queryKey: ['connectorCredentials', workflowId],
    queryFn: async () => {
      const response = await credentialsApi.listCredentials();
      return response.items;
    },
  });
  const connectorCapabilitiesQuery = useQuery({
    queryKey: ['connectorCapabilities', workflowId],
    queryFn: async (): Promise<ConnectorCapabilitiesPayload> =>
      credentialsApi.getConnectorCredentialCapabilities(),
  });

  const requestedMode = searchParams.get('mode');
  const activeMode: 'edit' | null = isWorkflowMode(requestedMode) ? requestedMode : null;
  const isEditModeRequested = activeMode === 'edit';
  const requestedTaskId = searchParams.get('task');
  const [autoSavePhase, setAutoSavePhase] = useState<'idle' | 'saving' | 'error'>('idle');
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [backendValidationSummary, setBackendValidationSummary] =
    useState<BackendWorkflowValidationSummary>({
      errors: [],
      warnings: [],
    });
  const [lastAutoSavedState, setLastAutoSavedState] = useState<WorkflowScopedState<Date | null>>({
    workflowId,
    value: null,
  });
  const [monitoringExemptionReasonState, setMonitoringExemptionReasonState] = useState<
    WorkflowScopedState<string>
  >({
    workflowId,
    value: '',
  });
  const [monitoringDisplayPatchState, setMonitoringDisplayPatchState] = useState<
    WorkflowScopedState<Record<string, unknown>>
  >({
    workflowId,
    value: {},
  });
  const [runtimeGovernanceDisplayPatch, setRuntimeGovernanceDisplayPatch] = useState<
    Record<string, unknown>
  >({});
  const suppressEditModeStartRef = useRef(false);
  const graphEdgeConditionInputRef = useRef<HTMLInputElement | null>(null);

  const updateMutation = useMutation({
    mutationFn: async (overrides?: WorkflowUpdateOverrides) => {
      const nextDefaultRuntimeAdapterId =
        overrides?.defaultRuntimeAdapterId ?? defaultRuntimeAdapterId;
      const nextAllowedRuntimeAdapterIds = nextDefaultRuntimeAdapterId
        ? [nextDefaultRuntimeAdapterId]
        : (overrides?.allowedRuntimeAdapterIds ?? allowedRuntimeAdapterIds);
      const nextExecutionHost = overrides?.executionHost ?? executionHost;
      const normalizedAgentDefinitions = agentDefinitions.map((agent) => {
        const agentDefinition = { ...agent };
        delete agentDefinition.objective;
        return normalizeWorkflowAgentDefinition({
          ...agentDefinition,
          name: agent.name?.trim() || agent.id,
          description: agent.description?.trim() || null,
          instructions: agent.instructions?.trim() || null,
          system_prompt: agent.system_prompt?.trim() || null,
          role: agent.role?.trim() || null,
          backstory: agent.backstory?.trim() || null,
        });
      });
      const normalizedTaskDefinitions = taskDefinitions.map((task) => ({
        ...task,
        name: task.name?.trim() || task.id,
        description: task.description?.trim() || '',
        instructions: task.instructions?.trim() || task.description?.trim() || '',
        expected_output: task.expected_output?.trim() || null,
      }));
      const assignedToolDefinitions = toolDefinitionsForAssignedAgents(
        normalizedAgentDefinitions,
        workflowPreview?.tool_definitions ?? workflow?.tool_definitions ?? [],
        toolsQuery.data ?? []
      );
      const rebuiltWorkflow = rebuildWorkflowGraph({
        ...workflow,
        id: workflowId,
        name: name.trim(),
        description: description.trim() || null,
        entrypoint: entrypoint.trim() || undefined,
        default_runtime_adapter_id: nextDefaultRuntimeAdapterId.trim() || null,
        allowed_runtime_adapter_ids: nextAllowedRuntimeAdapterIds,
        agent_definitions: normalizedAgentDefinitions,
        task_definitions: normalizedTaskDefinitions,
        nodes: workflowNodes,
        memory_definitions: workflowMemoryDefinitionsFor(workflowPreview ?? workflow),
        tool_definitions: mergeToolDefinitions(toolDefinitions, assignedToolDefinitions),
        metadata: {
          ...(workflowPreview?.metadata ?? workflow?.metadata ?? {}),
          execution_host: nextExecutionHost,
          restart_active_executions: restartActiveExecutions,
        },
      });
      const nextWorkflow = applyEdgeDraftMetadata(rebuiltWorkflow, edgeMetadataByTaskPair);
      return workflowsApi.updateWorkflow(workflowId, nextWorkflow);
    },
    onSuccess: async (nextWorkflow, variables) => {
      setAutoSavePhase('idle');
      setBackendValidationSummary({ errors: [], warnings: [] });
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), nextWorkflow);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowVersions(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowPersonaVersionNotices(workflowId),
        }),
      ]);
      if (variables?.keepEditing) {
        applyWorkflowDefinition(nextWorkflow);
        return;
      }
      suppressEditModeStartRef.current = true;
      stopEditing();
      updateWorkflowUrl({ nextMode: null });
    },
    onError: () => {
      setAutoSavePhase('error');
    },
  });

  const useLatestPersonaMutation = useMutation({
    mutationFn: (notice: PersonaAgentVersionNotice) =>
      workflowsApi.useLatestPersonaAgent(workflowId, notice.agentId),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowPersonaVersionNotices(workflowId),
        }),
      ]);
      toast.success('Updated the workflow to the latest persona agent.', {
        position: 'top-right',
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update persona agent.', {
        position: 'top-right',
      });
    },
  });

  const keepPersonaVersionMutation = useMutation({
    mutationFn: (notice: PersonaAgentVersionNotice) =>
      workflowsApi.keepCurrentPersonaAgent(workflowId, notice.agentId),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowPersonaVersionNotices(workflowId),
        }),
      ]);
      toast.success('Kept the current workflow persona snapshot.', {
        position: 'top-right',
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to keep persona snapshot.', {
        position: 'top-right',
      });
    },
  });

  const promoteWorkflowAgentMutation = useMutation({
    mutationFn: ({
      agentId,
      payload,
    }: {
      agentId: string;
      payload: {
        global_agent_id?: string | null;
        replace_workflow_agent?: boolean;
      };
    }) => workflowsApi.promoteWorkflowAgent(workflowId, agentId, payload),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendAgentDefinitions() }),
      ]);
      if (response.workflow_updated) {
        applyWorkflowDefinition(response.workflow);
        setSelectedGraphAgentId(response.agent.id);
      }
      setAgentPromotionEditorOpen(false);
      setAgentPromotionGlobalId(response.agent.id);
      setAgentPromotionReplaceWorkflowAgent(false);
      toast.success(
        response.workflow_updated
          ? 'Workflow agent promoted and replaced with the global catalog agent.'
          : 'Workflow agent promoted to the global catalog.',
        {
          position: 'top-right',
        }
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to promote workflow agent.', {
        position: 'top-right',
      });
    },
  });

  const updateMonitoringMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      workflowsApi.updateWorkflowMonitoring(workflowId, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.backendWorkflow(workflowId) });
      const previousWorkflow = queryClient.getQueryData<WorkflowDefinition>(
        queryKeys.backendWorkflow(workflowId)
      );
      const previousDisplayPatch = monitoringDisplayPatch;

      setMonitoringDisplayPatch((current) => ({
        ...current,
        ...patch,
      }));

      if (previousWorkflow?.monitoring) {
        queryClient.setQueryData<WorkflowDefinition>(queryKeys.backendWorkflow(workflowId), {
          ...previousWorkflow,
          monitoring: applyMonitoringPatch(previousWorkflow.monitoring, patch),
        });
      }

      return { previousWorkflow, previousDisplayPatch };
    },
    onSuccess: async (response, patch) => {
      queryClient.setQueryData<WorkflowDefinition | undefined>(
        queryKeys.backendWorkflow(workflowId),
        (previousWorkflow) => {
          const responseMonitoring = response.monitoring ?? response.workflow.monitoring;

          if (!previousWorkflow) {
            return responseMonitoring
              ? {
                  ...response.workflow,
                  monitoring: applyMonitoringPatch(responseMonitoring, patch),
                }
              : response.workflow;
          }

          const mergedMonitoring =
            responseMonitoring ?? response.workflow.monitoring ?? previousWorkflow.monitoring;

          return {
            ...previousWorkflow,
            ...response.workflow,
            metadata: {
              ...(previousWorkflow.metadata ?? {}),
              ...(response.workflow.metadata ?? {}),
            },
            monitoring: mergedMonitoring
              ? applyMonitoringPatch(mergedMonitoring, patch)
              : previousWorkflow.monitoring,
          };
        }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
        }),
      ]);
    },
    onError: (_error, _patch, context) => {
      if (context?.previousWorkflow) {
        queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), context.previousWorkflow);
      }
      setMonitoringDisplayPatch(context?.previousDisplayPatch ?? {});
    },
  });

  const updateRuntimeGovernanceMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      workflowsApi.updateWorkflowRuntimeGovernance(workflowId, patch),
    onMutate: async (patch) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.cancelQueries({
          queryKey: queryKeys.backendWorkflowRuntimeGovernance(workflowId),
        }),
      ]);
      const previousWorkflow = queryClient.getQueryData<WorkflowDefinition>(
        queryKeys.backendWorkflow(workflowId)
      );
      const previousRuntimeGovernance =
        queryClient.getQueryData<WorkflowRuntimeGovernanceOperatorPayload>(
          queryKeys.backendWorkflowRuntimeGovernance(workflowId)
        );
      const previousDisplayPatch = runtimeGovernanceDisplayPatch;

      setRuntimeGovernanceDisplayPatch((current) => ({
        ...current,
        ...patch,
      }));

      const currentGovernance = previousRuntimeGovernance ?? previousWorkflow?.runtime_governance;
      if (currentGovernance) {
        const optimisticGovernance = applyRuntimeGovernancePatch(currentGovernance, patch);
        queryClient.setQueryData(
          queryKeys.backendWorkflowRuntimeGovernance(workflowId),
          optimisticGovernance
        );
        if (previousWorkflow) {
          queryClient.setQueryData<WorkflowDefinition>(queryKeys.backendWorkflow(workflowId), {
            ...previousWorkflow,
            runtime_governance: optimisticGovernance,
          });
        }
      }

      return { previousWorkflow, previousRuntimeGovernance, previousDisplayPatch };
    },
    onSuccess: async (response, patch) => {
      const responseGovernance =
        response.runtime_governance ?? response.workflow.runtime_governance;

      if (responseGovernance) {
        const mergedGovernance = applyRuntimeGovernancePatch(responseGovernance, patch);
        queryClient.setQueryData(
          queryKeys.backendWorkflowRuntimeGovernance(workflowId),
          mergedGovernance
        );
      }

      queryClient.setQueryData<WorkflowDefinition | undefined>(
        queryKeys.backendWorkflow(workflowId),
        (previousWorkflow) => {
          if (!previousWorkflow) {
            return {
              ...response.workflow,
              runtime_governance: responseGovernance
                ? applyRuntimeGovernancePatch(responseGovernance, patch)
                : response.workflow.runtime_governance,
            };
          }

          const mergedGovernance =
            responseGovernance ??
            response.workflow.runtime_governance ??
            previousWorkflow.runtime_governance;

          return {
            ...previousWorkflow,
            ...response.workflow,
            metadata: {
              ...(previousWorkflow.metadata ?? {}),
              ...(response.workflow.metadata ?? {}),
            },
            runtime_governance: mergedGovernance
              ? applyRuntimeGovernancePatch(mergedGovernance, patch)
              : previousWorkflow.runtime_governance,
          };
        }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowRuntimeGovernance(workflowId),
        }),
      ]);
    },
    onError: (_error, _patch, context) => {
      if (context?.previousWorkflow) {
        queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), context.previousWorkflow);
      }
      if (context?.previousRuntimeGovernance) {
        queryClient.setQueryData(
          queryKeys.backendWorkflowRuntimeGovernance(workflowId),
          context.previousRuntimeGovernance
        );
      }
      setRuntimeGovernanceDisplayPatch(context?.previousDisplayPatch ?? {});
    },
  });

  const updateSharedMemoryMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      workflowsApi.updateWorkflowSharedMemory(workflowId, patch),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      queryClient.setQueryData(
        queryKeys.backendWorkflowSharedMemory(workflowId),
        response.shared_memory
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowSharedMemory(workflowId),
        }),
      ]);
    },
  });

  const addWorkflowMemoryLinkMutation = useMutation({
    mutationFn: ({
      targetType,
      targetId,
      refId,
      refType,
    }: {
      targetType: WorkflowMemoryLinkTargetType;
      targetId: string | null;
      refId: string;
      refType: MemoryCatalogRefType;
    }) =>
      workflowsApi.addWorkflowMemoryLink(workflowId, {
        targetType,
        targetId,
        refType,
        refId,
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.backendWorkflowMemoryLinks(workflowId), {
        workflowId,
        items: response.items,
      });
      queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowMemoryLinks(workflowId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
      ]);
      toast.success('Memory linked.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to link memory.');
    },
  });

  const deleteWorkflowMemoryLinkMutation = useMutation({
    mutationFn: (linkId: string) => workflowsApi.deleteWorkflowMemoryLink(workflowId, linkId),
    onSuccess: async (_, linkId) => {
      queryClient.setQueryData(
        queryKeys.backendWorkflowMemoryLinks(workflowId),
        workflowMemoryLinksQuery.data
          ? {
              ...workflowMemoryLinksQuery.data,
              items: workflowMemoryLinksQuery.data.items.filter((link) => link.id !== linkId),
            }
          : undefined
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowMemoryLinks(workflowId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
      ]);
      toast.success('Memory link removed.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove memory link.');
    },
  });

  const monitorApprovalMutation = useMutation({
    mutationFn: async ({
      approvalRequestId,
      action,
      reason,
      steeringParameters,
    }: {
      approvalRequestId: string;
      action: 'approve' | 'reject' | 'request_changes' | 'split';
      reason?: string | null;
      steeringParameters?: Record<string, unknown>;
    }) => {
      if (action === 'approve') {
        return conversationsApi.approveApprovalRequest(approvalRequestId, {
          user_id: actorUserId,
          reason,
          ...(steeringParameters ? { steering_parameters: steeringParameters } : {}),
        });
      }
      if (action === 'reject') {
        return conversationsApi.rejectApprovalRequest(approvalRequestId, {
          user_id: actorUserId,
          reason,
        });
      }
      if (action === 'request_changes') {
        return conversationsApi.requestChangesToApprovalRequest(approvalRequestId, {
          user_id: actorUserId,
          reason,
        });
      }
      return conversationsApi.splitApprovalRequest(approvalRequestId, {
        user_id: actorUserId,
        reason,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowList() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
        }),
      ]);
    },
  });

  const dispatchMonitorProposalMutation = useMutation({
    mutationFn: ({
      proposalEventId,
      operatorNote,
    }: {
      proposalEventId: string;
      operatorNote?: string;
    }) =>
      workflowsApi.dispatchMonitoringProposalToMainAgent(workflowId, proposalEventId, {
        operator_note: operatorNote,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
      });
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const schedule = schedulesQuery.data?.find((item) => item.id === scheduleId);
      if (schedule?.enabled) {
        return schedulesApi.disableSchedule(scheduleId);
      }
      return schedulesApi.enableSchedule(scheduleId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowSchedules(workflowId),
      });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) => schedulesApi.deleteSchedule(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowSchedules(workflowId),
      });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ scheduleId, patch }: { scheduleId: string; patch: Record<string, unknown> }) =>
      schedulesApi.patchSchedule(scheduleId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowSchedules(workflowId),
      });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => schedulesApi.createSchedule(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowSchedules(workflowId),
      });
    },
  });

  const triggerScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) => schedulesApi.triggerNow(scheduleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowSchedules(workflowId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowRuns(workflowId) }),
      ]);
    },
  });

  const workflow = workflowQuery.data;
  const {
    state: {
      agentDefinitions,
      allowedRuntimeAdapterIds,
      defaultRuntimeAdapterId,
      description,
      edgeMetadataByTaskPair,
      entrypoint,
      executionHost,
      isEditing,
      name,
      restartActiveExecutions,
      taskDefinitions,
      toolDefinitions,
      workflowMetadata,
      workflowNodes,
      memoryDefinitions,
    },
    derived: {
      draftValidationIssues,
      effectiveEntrypointTaskId,
      hasUnsavedChanges,
      invalidEdgeConditionByTaskPair,
      invalidEdgeMetadataByTaskPair,
      visibleAgentDefinitions,
      visibleTaskDefinitions,
      workflowDescriptionInvalid,
      workflowNameInvalid,
      workflowPreview,
    },
    actions: {
      applyWorkflowDefinition,
      setDescription,
      setEntrypoint,
      setExecutionHost,
      setName,
      setRestartActiveExecutions,
      selectDefaultRuntimeAdapter,
      startEditing,
      stopEditing,
      replaceWorkflowMetadata,
      updateAgentDefinition,
      updateEdgeMetadata,
      updateTaskDefinition,
      upsertToolDefinition,
    },
  } = useWorkflowEditorDraft({ workflow, workflowId });
  const monitoringExemptionReason =
    monitoringExemptionReasonState.workflowId === workflowId
      ? monitoringExemptionReasonState.value
      : typeof workflow?.monitoring?.reason === 'string'
        ? workflow.monitoring.reason
        : '';
  const monitoringDisplayPatch =
    monitoringDisplayPatchState.workflowId === workflowId ? monitoringDisplayPatchState.value : {};
  const setMonitoringExemptionReason = useCallback(
    (value: string) => {
      setMonitoringExemptionReasonState({ workflowId, value });
    },
    [workflowId]
  );
  const setMonitoringDisplayPatch = useCallback(
    (
      value:
        | Record<string, unknown>
        | ((current: Record<string, unknown>) => Record<string, unknown>)
    ) => {
      setMonitoringDisplayPatchState((current) => {
        const currentValue = current.workflowId === workflowId ? current.value : {};
        return {
          workflowId,
          value: typeof value === 'function' ? value(currentValue) : value,
        };
      });
    },
    [workflowId]
  );
  const displayedWorkflowMonitoring = workflow?.monitoring
    ? applyMonitoringPatch(workflow.monitoring, monitoringDisplayPatch)
    : null;
  const displayedRuntimeGovernance =
    (runtimeGovernanceQuery.data ?? workflow?.runtime_governance)
      ? applyRuntimeGovernancePatch(
          (runtimeGovernanceQuery.data ??
            workflow?.runtime_governance) as WorkflowRuntimeGovernanceOperatorPayload,
          runtimeGovernanceDisplayPatch
        )
      : null;
  const workflowObservabilityAgentIds = visibleAgentDefinitions
    .map((agent) => agent.id)
    .slice(0, 8);
  const workflowAgentObservabilityQueries = useQueries({
    queries: workflowObservabilityAgentIds.map((agentId) => ({
      queryKey: queryKeys.backendAgentObservabilityMetrics(agentId),
      queryFn: () => observabilityApi.getAgentMetrics(agentId),
      enabled: Boolean(agentId),
      refetchInterval: shouldRefreshRuntimeActivity ? 5000 : false,
    })),
  });
  const workflowAgentObservabilityMetrics = workflowAgentObservabilityQueries
    .map((query) => query.data)
    .filter((item): item is ObservabilityAgentMetrics => Boolean(item));
  const workflowObservabilityLoading =
    workflowObservabilityMetricsQuery.isLoading ||
    workflowModelUsageQuery.isLoading ||
    workflowAgentObservabilityQueries.some((query) => query.isLoading);
  const workflowRunEventsDataSignature = workflowRunEventsQueries
    .map((query) => `${query.dataUpdatedAt}:${query.data?.items?.length ?? 0}`)
    .join('|');
  const workflowExecutionEvents = useMemo(
    () => workflowRunEventsQueries.flatMap((query) => query.data?.items ?? []),
    // Query result wrappers are intentionally excluded; dataUpdatedAt is the stable change signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workflowRunEventsDataSignature]
  ) as ExecutionEventRecord[];
  const workflowGraphRuntimeEvents = workflowActivityToGraphRuntimeEvents({
    runs: runsQuery.data ?? [],
    executionEvents: workflowExecutionEvents,
    monitoringEvents: monitoringEventsQuery.data ?? null,
    workflow,
  });
  const memoryLinkCountsByTarget = useMemo(() => {
    const counts: Record<string, number> = {};
    (workflowMemoryLinksQuery.data?.items ?? []).forEach((link) => {
      const key = workflowMemoryLinkTargetValue(link.targetType, link.targetId);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [workflowMemoryLinksQuery.data?.items]);
  const savedRestartActiveExecutions = resolveRestartActiveExecutions(workflow);
  const effectiveRestartActiveExecutions = isEditing
    ? restartActiveExecutions
    : savedRestartActiveExecutions;
  const autoSaveDraftSignature = JSON.stringify({
    name,
    description,
    entrypoint,
    executionHost,
    defaultRuntimeAdapterId,
    allowedRuntimeAdapterIds,
    restartActiveExecutions,
    agentDefinitions,
    taskDefinitions,
    toolDefinitions,
    memoryDefinitions,
    edgeMetadataByTaskPair,
  });

  useEffect(() => {
    if (
      !isEditing ||
      !hasUnsavedChanges ||
      draftValidationIssues.length > 0 ||
      updateMutation.isPending
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAutoSavePhase('saving');
      updateMutation
        .mutateAsync({ keepEditing: true })
        .then(() => {
          setAutoSavePhase('idle');
          setLastAutoSavedState({ workflowId, value: new Date() });
        })
        .catch(() => {
          setAutoSavePhase('error');
        });
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [
    autoSaveDraftSignature,
    draftValidationIssues.length,
    hasUnsavedChanges,
    isEditing,
    updateMutation,
    workflowId,
  ]);

  useEffect(() => {
    if (workflow && isEditModeRequested && !isEditing && !suppressEditModeStartRef.current) {
      startEditing();
    }
  }, [workflow, isEditModeRequested, isEditing, startEditing]);

  useEffect(() => {
    if (!isEditModeRequested) {
      suppressEditModeStartRef.current = false;
    }
  }, [isEditModeRequested]);

  const workflowLoaded = Boolean(workflow);
  const selectedTaskStillExists = requestedTaskId
    ? !workflowLoaded || visibleTaskDefinitions.some((task) => task.id === requestedTaskId)
    : false;

  const updateWorkflowUrl = useCallback(
    ({
      nextMode = activeMode,
      nextTaskId = requestedTaskId,
    }: {
      nextMode?: 'edit' | null;
      nextTaskId?: string | null;
    }) => {
      const nextSearchParams = new URLSearchParams(searchParams.toString());

      nextSearchParams.delete('tab');

      if (nextMode === 'edit') {
        nextSearchParams.set('mode', 'edit');
      } else {
        nextSearchParams.delete('mode');
      }

      if (nextTaskId) {
        nextSearchParams.set('task', nextTaskId);
      } else {
        nextSearchParams.delete('task');
      }

      nextSearchParams.delete('edge');

      const nextQuery = nextSearchParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [activeMode, pathname, requestedTaskId, router, searchParams]
  );

  useEffect(() => {
    if (workflowLoaded && requestedTaskId && !selectedTaskStillExists) {
      updateWorkflowUrl({ nextTaskId: null });
    }
  }, [requestedTaskId, selectedTaskStillExists, updateWorkflowUrl, workflowLoaded]);

  const behaviorProfiles = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const personaAgentDefinitions = useMemo(
    () => (agentsQuery.data ?? []).filter(isPersonaBackedAgent),
    [agentsQuery.data]
  );
  const personaVersionNotices = useMemo(
    () => normalizeBackendPersonaVersionNotices(personaVersionNoticesQuery.data?.items),
    [personaVersionNoticesQuery.data?.items]
  );
  const personaVersionNoticeByAgentId = useMemo(
    () => new Map(personaVersionNotices.map((notice) => [notice.agentId, notice])),
    [personaVersionNotices]
  );
  const outdatedPersonaVersionNotices = personaVersionNotices.filter(
    (notice) => notice.status === 'outdated'
  );
  const runtimeAdapters = runtimeAdaptersQuery.data?.items ?? [];
  const defaultExecutionHost = resolveWorkflowExecutionHost(workflow);
  const { preferredRuntimeAdapterId, launchMutation: executeMutation } = useWorkflowRunLauncher({
    workflowId,
    workflow,
    runtimeAdapters,
    additionalInvalidationKeys: (run) => [
      queryKeys.backendWorkflowMonitoringEvents(workflowId),
      queryKeys.backendRunEvents(run.id),
    ],
  });
  const selectedRunRuntimeAdapterId = preferredRuntimeAdapterId ?? '';
  const selectedExecutionHost = defaultExecutionHost;
  const autoSaveStatus: WorkflowAutoSaveStatus = !isEditing
    ? 'idle'
    : updateMutation.isPending || autoSavePhase === 'saving'
      ? 'saving'
      : draftValidationIssues.length > 0
        ? 'blocked'
        : autoSavePhase === 'error'
          ? 'error'
          : hasUnsavedChanges
            ? 'idle'
            : 'saved';
  const lastAutoSavedAt =
    lastAutoSavedState.workflowId === workflowId ? lastAutoSavedState.value : null;
  const saveErrorMessage =
    updateMutation.isError || autoSavePhase === 'error'
      ? errorMessage(updateMutation.error, 'Failed to save workflow changes.')
      : null;
  const workflowToolDefinitions =
    workflowPreview?.tool_definitions ?? workflow?.tool_definitions ?? [];
  const assignableToolDefinitions = mergeToolDefinitions(
    workflowToolDefinitions,
    toolsQuery.data ?? []
  );
  const toolMap = new Map(assignableToolDefinitions.map((tool) => [tool.id, tool]));
  const graphRuntimeControlRun = useMemo(() => {
    const runs = [...(runsQuery.data ?? [])].sort((left, right) =>
      workflowRunTimestamp(right).localeCompare(workflowRunTimestamp(left))
    );

    return (
      runs.find(
        (run) =>
          run.status === 'paused' ||
          run.status === 'waiting_for_approval' ||
          run.status === 'failed' ||
          run.status === 'cancelled'
      ) ?? null
    );
  }, [runsQuery.data]);
  const graphRuntimeControlApprovalToolId = graphRuntimeControlRun
    ? ([...workflowGraphRuntimeEvents]
        .reverse()
        .map((event) => graphRuntimeEventPendingApprovalTool(event, graphRuntimeControlRun.id))
        .find((toolId): toolId is string => Boolean(toolId)) ?? null)
    : null;
  const graphRuntimeControlApprovalLabel = graphRuntimeControlApprovalToolId
    ? toolMap.get(graphRuntimeControlApprovalToolId)
      ? toolDisplayName(toolMap.get(graphRuntimeControlApprovalToolId) as ToolDefinition)
      : graphRuntimeControlApprovalToolId
    : null;
  const graphRuntimeControlCheckpointTaskId = graphRuntimeControlRun
    ? workflowCheckpointResumeTaskId(workflowPreview ?? workflow, graphRuntimeControlRun)
    : null;
  const refreshWorkflowRuntimeGraph = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflowRuns(workflowId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
      }),
      ...recentWorkflowRuns.map((run) =>
        queryClient.invalidateQueries({ queryKey: queryKeys.backendRunEvents(run.id) })
      ),
    ]);
  };
  const graphResumeRunMutation = useMutation({
    mutationFn: (runId: string) => runsApi.resumeRun(runId),
    onSuccess: refreshWorkflowRuntimeGraph,
  });
  const graphRetryTaskMutation = useMutation({
    mutationFn: ({ runId, taskId, reason }: { runId: string; taskId: string; reason?: string }) =>
      runsApi.retryTask(runId, taskId, reason),
    onSuccess: refreshWorkflowRuntimeGraph,
  });
  const graphCheckpointResumeMutation = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason?: string }) =>
      runsApi.resumeFromCheckpoint(runId, reason),
    onSuccess: refreshWorkflowRuntimeGraph,
  });
  const graphNativeApprovalDecisionMutation = useMutation({
    mutationFn: ({
      runId,
      toolId,
      action,
      reason,
    }: {
      runId: string;
      toolId: string;
      action: 'approve' | 'reject';
      reason?: string;
    }) =>
      action === 'approve'
        ? runsApi.approveRun(runId, toolId, reason)
        : runsApi.rejectRun(runId, toolId, reason),
    onSuccess: refreshWorkflowRuntimeGraph,
  });
  const createGraphSteeringApprovalMutation = useMutation({
    mutationFn: ({ taskId, agentId }: { taskId?: string | null; agentId?: string | null }) => {
      const task = taskId
        ? visibleTaskDefinitions.find((candidate) => candidate.id === taskId)
        : null;
      const agent = agentId
        ? visibleAgentDefinitions.find((candidate) => candidate.id === agentId)
        : null;
      const nodeLabel = task?.name || agent?.name || taskId || agentId || 'graph node';
      const targetKind = taskId ? 'task' : 'agent';
      const instructions =
        targetKind === 'task'
          ? `Review and steer task "${nodeLabel}" while preserving visible task graph relationships.`
          : `Review and steer agent "${nodeLabel}" while preserving visible task assignments.`;

      return workflowsApi.createWorkflowSteeringApproval(workflowId, {
        recommendedAction: targetKind === 'task' ? 'request_replan' : 'redirect_subagent',
        title: `Steer ${nodeLabel}`,
        reason: `Graph node steering requested for ${targetKind} "${nodeLabel}".`,
        executionId: graphRuntimeControlRun?.id ?? undefined,
        targetTaskId: taskId ?? undefined,
        targetAgentId: agentId ?? undefined,
        operatorParameters: {
          instructions,
        },
        evidence: {
          graph_node_type: targetKind,
          graph_node_label: nodeLabel,
          workflow_revision: workflow?.versioning?.revision ?? null,
          run_status: graphRuntimeControlRun?.status ?? null,
        },
        metadata: {
          source: 'workflow_graph_node',
          workflow_detail_mode: isEditing ? 'edit' : 'view',
        },
        requestApproval: true,
      });
    },
    onSuccess: async (response) => {
      if (response.workflow) {
        queryClient.setQueryData(queryKeys.backendWorkflow(workflowId), response.workflow);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.backendWorkflow(workflowId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.backendWorkflowMonitoringEvents(workflowId),
        }),
      ]);
    },
  });
  const workflowMemoryDefinitions = workflowMemoryDefinitionsFor(workflowPreview ?? workflow);
  const workflowArtifactDefinitions = workflowArtifactDefinitionsFor(workflowPreview ?? workflow);
  const memoryMap = new Map(workflowMemoryDefinitions.map((memory) => [memory.id, memory]));
  const artifactMap = new Map(
    workflowArtifactDefinitions.map((artifact) => [artifact.id, artifact])
  );
  const agentMap = new Map(visibleAgentDefinitions.map((agent) => [agent.id, agent]));
  const taskMap = new Map(visibleTaskDefinitions.map((task) => [task.id, task]));
  const selectedTaskId =
    selectedGraphApprovalTaskId &&
    visibleTaskDefinitions.some((task) => task.id === selectedGraphApprovalTaskId)
      ? selectedGraphApprovalTaskId
      : requestedTaskId && visibleTaskDefinitions.some((task) => task.id === requestedTaskId)
        ? requestedTaskId
        : null;
  const selectedTask = selectedTaskId
    ? (visibleTaskDefinitions.find((task) => task.id === selectedTaskId) ?? null)
    : null;
  const selectedTaskWasOpenedFromApproval = Boolean(
    selectedGraphApprovalTaskId && selectedTask?.id === selectedGraphApprovalTaskId
  );
  const selectedGraphAgentIndex = selectedGraphAgentId
    ? visibleAgentDefinitions.findIndex((agent) => agent.id === selectedGraphAgentId)
    : -1;
  const selectedGraphAgent =
    selectedGraphAgentIndex >= 0 ? visibleAgentDefinitions[selectedGraphAgentIndex] : null;
  const selectedGraphAgentPromotionId = selectedGraphAgent?.id ?? '';
  const defaultAgentPromotionState = {
    agentId: selectedGraphAgentPromotionId,
    editorOpen: false,
    globalId: selectedGraphAgentPromotionId,
    replaceWorkflowAgent: false,
  };
  const activeAgentPromotionState =
    agentPromotionState.agentId === selectedGraphAgentPromotionId
      ? agentPromotionState
      : defaultAgentPromotionState;
  const agentPromotionEditorOpen = activeAgentPromotionState.editorOpen;
  const agentPromotionGlobalId = activeAgentPromotionState.globalId;
  const agentPromotionReplaceWorkflowAgent = activeAgentPromotionState.replaceWorkflowAgent;
  const updateAgentPromotionState = (
    patch:
      | Partial<typeof defaultAgentPromotionState>
      | ((
          currentState: typeof defaultAgentPromotionState
        ) => Partial<typeof defaultAgentPromotionState>)
  ) => {
    setAgentPromotionState((currentState) => {
      const baseState =
        currentState.agentId === selectedGraphAgentPromotionId
          ? currentState
          : defaultAgentPromotionState;
      const resolvedPatch = typeof patch === 'function' ? patch(baseState) : patch;
      return {
        ...baseState,
        ...resolvedPatch,
        agentId: selectedGraphAgentPromotionId,
      };
    });
  };
  const setAgentPromotionEditorOpen = (nextOpen: boolean | ((currentOpen: boolean) => boolean)) => {
    updateAgentPromotionState((currentState) => ({
      editorOpen: typeof nextOpen === 'function' ? nextOpen(currentState.editorOpen) : nextOpen,
    }));
  };
  const setAgentPromotionGlobalId = (globalId: string) => {
    updateAgentPromotionState({ globalId });
  };
  const setAgentPromotionReplaceWorkflowAgent = (replaceWorkflowAgent: boolean) => {
    updateAgentPromotionState({ replaceWorkflowAgent });
  };
  const selectedGraphTool = selectedGraphToolId ? (toolMap.get(selectedGraphToolId) ?? null) : null;
  const selectedGraphToolListOpen =
    selectedGraphToolId === workflowGraphToolListSelectionId || Boolean(selectedGraphToolNodeId);
  const selectedGraphMemory = selectedGraphMemoryId
    ? (memoryMap.get(selectedGraphMemoryId) ?? null)
    : null;
  const selectedGraphArtifact = selectedGraphArtifactId
    ? (artifactMap.get(selectedGraphArtifactId) ?? null)
    : null;
  const selectedTaskAgent = selectedTask?.agent_id
    ? (agentMap.get(selectedTask.agent_id) ?? null)
    : null;
  const assistantPageContext = {
    surface: 'workflow.detail' as const,
    title: workflowPreview?.name ?? workflow?.name ?? 'Workflow',
    description:
      workflowPreview?.description ?? workflow?.description ?? 'Canonical workflow detail.',
    entities: [
      {
        type: 'workflow',
        id: workflowId,
        name: workflowPreview?.name ?? workflow?.name ?? null,
      },
      ...(selectedTask
        ? [
            {
              type: 'task',
              id: selectedTask.id,
              name: selectedTask.name,
            },
          ]
        : []),
      ...(selectedTaskAgent
        ? [
            {
              type: 'agent',
              id: selectedTaskAgent.id,
              name: selectedTaskAgent.name,
            },
          ]
        : []),
      ...(selectedGraphAgent
        ? [
            {
              type: 'agent',
              id: selectedGraphAgent.id,
              name: selectedGraphAgent.name,
            },
          ]
        : []),
      ...(selectedGraphTool
        ? [
            {
              type: 'tool',
              id: selectedGraphTool.id,
              name: toolDisplayName(selectedGraphTool),
            },
          ]
        : []),
      ...(selectedGraphMemory
        ? [
            {
              type: 'memory',
              id: selectedGraphMemory.id,
              name: selectedGraphMemory.name,
            },
          ]
        : []),
    ],
    selection: {
      tab: activeTab,
      mode: activeMode,
      workflowId,
      taskId: selectedTaskId,
      agentId: selectedGraphAgentId ?? selectedTaskAgent?.id ?? null,
      toolId: selectedGraphToolId,
      toolIds: selectedGraphToolIds,
      memoryId: selectedGraphMemoryId,
      edgeId: selectedGraphEdgeRef?.id ?? null,
    },
    summary: {
      workflowId,
      isEditing,
      hasUnsavedChanges,
      validationIssueCount: draftValidationIssues.length,
      agentCount: visibleAgentDefinitions.length,
      taskCount: visibleTaskDefinitions.length,
      toolCount: workflowToolDefinitions.length,
      memoryCount: workflowMemoryDefinitions.length,
      runCount: runsQuery.data?.length ?? 0,
      selectedTaskName: selectedTask?.name ?? null,
      selectedTaskAgentName: selectedTaskAgent?.name ?? null,
    },
    allowedActions: [
      'workflow.inspect',
      'workflow.propose_update',
      'workflow.apply_update',
      'workflow.validate',
      'workflow.run',
      'workflow.configure_monitoring',
      'workflow.configure_runtime_governance',
      'workflow.configure_shared_memory',
    ],
  };
  useRegisterAssistantPageContext(assistantPageContext);
  const selectedTaskIndex = selectedTaskId
    ? visibleTaskDefinitions.findIndex((task) => task.id === selectedTaskId)
    : -1;
  const fallbackPreviousTask =
    selectedTaskIndex > 0 ? visibleTaskDefinitions[selectedTaskIndex - 1] : null;
  const fallbackNextTask =
    selectedTaskIndex >= 0 && selectedTaskIndex < visibleTaskDefinitions.length - 1
      ? visibleTaskDefinitions[selectedTaskIndex + 1]
      : null;
  const dependencyTasks = selectedTask
    ? visibleTaskDefinitions.filter((task) =>
        (selectedTask.depends_on_task_ids ?? []).includes(task.id)
      )
    : [];
  const dependentTasks = selectedTask
    ? visibleTaskDefinitions.filter((task) =>
        (task.depends_on_task_ids ?? []).includes(selectedTask.id)
      )
    : [];
  const dependencyLinks = dependencyTasks.map((task) => ({
    task,
    edgeType: edgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`]?.edgeType || 'default',
    condition: edgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`]?.condition || '',
    conditionError: invalidEdgeConditionByTaskPair[`${task.id}->${selectedTask?.id}`],
    metadataJson: edgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`]?.metadataJson || '',
    metadataError: invalidEdgeMetadataByTaskPair[`${task.id}->${selectedTask?.id}`],
  }));
  const dependentLinks = dependentTasks.map((task) => ({
    task,
    edgeType: edgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`]?.edgeType || 'default',
    condition: edgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`]?.condition || '',
    conditionError: invalidEdgeConditionByTaskPair[`${selectedTask?.id}->${task.id}`],
    metadataJson: edgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`]?.metadataJson || '',
    metadataError: invalidEdgeMetadataByTaskPair[`${selectedTask?.id}->${task.id}`],
  }));
  const previousTask = dependencyTasks[dependencyTasks.length - 1] ?? fallbackPreviousTask;
  const nextTask = dependentTasks[0] ?? fallbackNextTask;
  const previousTaskLabel = previousTask ? `${previousTask.name}` : null;
  const nextTaskLabel = nextTask
    ? `${dependentTasks.length > 0 ? 'Downstream' : 'Next'}: ${nextTask.name}`
    : null;
  const selectAdjacentTask = (direction: 'previous' | 'next') => {
    if (!selectedTask) {
      const fallbackTask =
        direction === 'next'
          ? visibleTaskDefinitions[0]
          : visibleTaskDefinitions[visibleTaskDefinitions.length - 1];
      if (fallbackTask) {
        setSelectedGraphApprovalTaskId(null);
        updateWorkflowUrl({ nextTaskId: fallbackTask.id });
      }
      return;
    }

    const targetTask = direction === 'previous' ? previousTask : nextTask;
    if (targetTask) {
      setSelectedGraphApprovalTaskId(null);
      updateWorkflowUrl({ nextTaskId: targetTask.id });
    }
  };
  const focusSelectedTaskApprovalGate = () => {
    if (!selectedTask) {
      return;
    }

    setSelectedGraphApprovalTaskId(selectedTask.id);
    setSelectedGraphAgentId(null);
    setSelectedGraphToolId(null);
    setSelectedGraphToolNodeId(null);
    setSelectedGraphMemoryId(null);
    setSelectedGraphArtifactId(null);
    setSelectedGraphEdgeRef(null);
    updateWorkflowUrl({ nextTaskId: selectedTask.id });
  };
  const focusSelectedApprovalLinkedTask = () => {
    if (!selectedTask) {
      return;
    }

    setSelectedGraphApprovalTaskId(null);
    updateWorkflowUrl({ nextTaskId: selectedTask.id });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!selectedTask) {
          const fallbackTask = visibleTaskDefinitions[visibleTaskDefinitions.length - 1];
          if (fallbackTask) {
            setSelectedGraphApprovalTaskId(null);
            updateWorkflowUrl({ nextTaskId: fallbackTask.id });
          }
          return;
        }

        if (previousTask) {
          setSelectedGraphApprovalTaskId(null);
          updateWorkflowUrl({ nextTaskId: previousTask.id });
        }
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (!selectedTask) {
          const fallbackTask = visibleTaskDefinitions[0];
          if (fallbackTask) {
            setSelectedGraphApprovalTaskId(null);
            updateWorkflowUrl({ nextTaskId: fallbackTask.id });
          }
          return;
        }

        if (nextTask) {
          setSelectedGraphApprovalTaskId(null);
          updateWorkflowUrl({ nextTaskId: nextTask.id });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    nextTask,
    previousTask,
    selectedTask,
    setSelectedGraphApprovalTaskId,
    updateWorkflowUrl,
    visibleTaskDefinitions,
  ]);

  if (workflowQuery.isLoading) {
    return <LoadingCard title="Workflow" description="Native / Container workflow details" />;
  }

  if (workflowQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load workflow"
        message={workflowQuery.error.message}
        onRetry={() => workflowQuery.refetch()}
      />
    );
  }

  if (runtimeAdaptersQuery.isError) {
    return (
      <ErrorAlert
        title="Failed to load runtime adapters"
        message={runtimeAdaptersQuery.error.message}
        onRetry={() => runtimeAdaptersQuery.refetch()}
      />
    );
  }

  if (!workflow) {
    return (
      <EmptyCard
        title="Workflow not found"
        description="The backend returned no workflow detail for this ID."
      />
    );
  }
  const resolvedWorkflowPreview = workflowPreview ?? workflow;
  const draftChangeSummary = createWorkflowChangeSummary(workflow, resolvedWorkflowPreview);
  const workflowGraphDocument = workflowDefinitionToGraphDocument(resolvedWorkflowPreview, {
    includeAgents: true,
    includeTools: true,
    includeMemories: true,
    toolDefinitions: assignableToolDefinitions,
    modelProfiles: behaviorProfiles,
  });
  const workflowGraphReviewNotes = workflowGraphReviewNotesFor(resolvedWorkflowPreview);
  const workflowGraphReviewNoteByKey = new Map(
    workflowGraphReviewNotes.map((note) => [
      workflowGraphReviewNoteKey({ type: note.target_type, id: note.target_id }),
      note,
    ])
  );
  const workflowInlineWarningIssues = [
    ...validateWorkflowResourceReferences(resolvedWorkflowPreview, workflowGraphDocument, {
      toolDefinitions: assignableToolDefinitions,
    }),
    ...validateWorkflowRuntimeWarnings(resolvedWorkflowPreview, workflowGraphRuntimeEvents),
  ];
  const selectedGraphToolNode = (() => {
    const directNode = selectedGraphToolNodeId
      ? (workflowGraphDocument.nodes.find((node) => node.id === selectedGraphToolNodeId) ?? null)
      : null;
    if (directNode) {
      return directNode;
    }

    if (selectedGraphToolListOpen) {
      return (
        workflowGraphDocument.nodes
          .filter((node) => node.type === workflowGraphNodeTypes.tool)
          .at(-1) ?? null
      );
    }

    return null;
  })();
  const selectedGraphToolNodeAgentId = selectedGraphToolNode
    ? (() => {
        const edge = workflowGraphDocument.edges.find(
          (candidate) =>
            candidate.type === workflowGraphEdgeTypes.tool &&
            candidate.source === selectedGraphToolNode.id
        );
        const edgeAgentId = typeof edge?.data?.agentId === 'string' ? edge.data.agentId : undefined;
        if (edgeAgentId) {
          return edgeAgentId;
        }

        const targetNode = edge
          ? workflowGraphDocument.nodes.find((node) => node.id === edge.target)
          : null;
        return typeof targetNode?.data?.agentId === 'string' ? targetNode.data.agentId : null;
      })()
    : null;
  const selectedGraphToolNodeAgent = selectedGraphToolNodeAgentId
    ? (agentMap.get(selectedGraphToolNodeAgentId) ?? null)
    : null;
  const workflowHasToolReference = (
    definition: WorkflowDefinition | null | undefined,
    toolId: string
  ) =>
    Boolean(
      (definition?.agent_definitions ?? []).some((agent) =>
        (agent.tool_ids ?? agent.toolIds ?? []).includes(toolId)
      ) ||
      (definition?.task_definitions ?? []).some((task) => (task.tool_ids ?? []).includes(toolId))
    );
  const clearUnusedToolConnectorBindings = (
    definition: WorkflowDefinition,
    toolIds: string[]
  ): WorkflowDefinition => {
    const unusedToolIds = toolIds.filter((toolId) => !workflowHasToolReference(definition, toolId));
    if (unusedToolIds.length === 0) {
      return definition;
    }

    return {
      ...definition,
      tool_definitions: (definition.tool_definitions ?? []).map((tool) =>
        unusedToolIds.includes(tool.id)
          ? {
              ...tool,
              security: {
                ...(tool.security ?? {}),
                connector_bindings: [],
              },
            }
          : tool
      ),
    };
  };
  const clearToolConnectorBinding = (
    definition: WorkflowDefinition,
    toolId: string
  ): WorkflowDefinition => ({
    ...definition,
    tool_definitions: (definition.tool_definitions ?? []).map((tool) =>
      tool.id === toolId
        ? {
            ...tool,
            security: {
              ...(tool.security ?? {}),
              connector_bindings: [],
            },
          }
        : tool
    ),
  });
  const revokeAgentToolAccess = (agent: AgentDefinition, agentIndex: number, toolId: string) => {
    const currentToolIds = agent.tool_ids ?? agent.toolIds ?? [];
    if (!currentToolIds.includes(toolId)) {
      return;
    }

    updateAgentDefinition(agentIndex, {
      tool_ids: currentToolIds.filter((candidateId) => candidateId !== toolId),
      metadata: withoutAgentToolRuntimeConfig(agent, [toolId]).metadata,
    });

    if (
      !visibleAgentDefinitions.some((candidate, candidateIndex) =>
        candidateIndex === agentIndex
          ? false
          : (candidate.tool_ids ?? candidate.toolIds ?? []).includes(toolId)
      ) &&
      !visibleTaskDefinitions.some((task) => (task.tool_ids ?? []).includes(toolId))
    ) {
      const existingTool = toolMap.get(toolId);
      if (!existingTool) {
        return;
      }
      upsertToolDefinition({
        ...existingTool,
        security: {
          ...(existingTool.security ?? {}),
          connector_bindings: [],
        },
      });
    }
  };
  const handleExportWorkflow = () => {
    const downloaded = downloadWorkflowExportPackage(resolvedWorkflowPreview, {
      availableModelProfiles: behaviorProfiles,
      availableTools: assignableToolDefinitions,
    });

    if (downloaded) {
      toast.success('Workflow package exported.');
    } else {
      toast.error('Workflow export is unavailable in this environment.');
    }
  };
  const selectedGraphEdge =
    selectedGraphEdgeRef &&
    (workflowGraphDocument.edges.find((edge) => edge.id === selectedGraphEdgeRef.id) ??
      (selectedGraphEdgeRef.sourceTaskId && selectedGraphEdgeRef.targetTaskId
        ? workflowGraphDocument.edges.find(
            (edge) =>
              readGraphEdgeDataString(edge, 'sourceTaskId') === selectedGraphEdgeRef.sourceTaskId &&
              readGraphEdgeDataString(edge, 'targetTaskId') === selectedGraphEdgeRef.targetTaskId
          )
        : undefined) ??
      workflowGraphDocument.edges.find(
        (edge) =>
          edge.type === workflowGraphEdgeTypes.assignment &&
          readGraphEdgeDataString(edge, 'taskId') === selectedGraphEdgeRef.taskId
      ) ??
      workflowGraphDocument.edges.find(
        (edge) =>
          edge.type === workflowGraphEdgeTypes.tool &&
          readGraphEdgeDataString(edge, 'agentId') === selectedGraphEdgeRef.agentId &&
          (selectedGraphEdgeRef.toolIds.length > 0
            ? readGraphEdgeDataStringArray(edge, 'toolIds').some((toolId) =>
                selectedGraphEdgeRef.toolIds.includes(toolId)
              )
            : readGraphEdgeDataString(edge, 'toolId') === selectedGraphEdgeRef.toolId)
      ) ??
      workflowGraphDocument.edges.find(
        (edge) =>
          edge.type === workflowGraphEdgeTypes.memory &&
          readGraphEdgeDataString(edge, 'memoryId') === selectedGraphEdgeRef.memoryId &&
          (readGraphEdgeDataString(edge, 'agentId') === selectedGraphEdgeRef.agentId ||
            readGraphEdgeDataString(edge, 'taskId') === selectedGraphEdgeRef.taskId)
      ));
  const selectedTaskGraphNodeId = selectedTask
    ? workflowGraphDocument.nodes.find(
        (node) =>
          node.data?.taskId === selectedTask.id &&
          (!selectedTaskWasOpenedFromApproval || node.type === workflowGraphNodeTypes.approval)
      )?.id
    : null;
  const selectedGraphAgentNodeId = selectedGraphAgent
    ? workflowGraphDocument.nodes.find((node) => node.data?.agentId === selectedGraphAgent.id)?.id
    : null;
  const selectedTaskRuntimeEvent = selectedTaskGraphNodeId
    ? [...workflowGraphRuntimeEvents]
        .reverse()
        .find((event) => event.nodeId === selectedTaskGraphNodeId)
    : null;
  const selectedGraphAgentRuntimeEvent = selectedGraphAgentNodeId
    ? [...workflowGraphRuntimeEvents]
        .reverse()
        .find((event) => event.nodeId === selectedGraphAgentNodeId)
    : null;
  const selectedGraphEdgeRuntimeEvent = selectedGraphEdge
    ? [...workflowGraphRuntimeEvents]
        .reverse()
        .find((event) => event.edgeId === selectedGraphEdge.id)
    : null;
  const workflowDocumentOptions = [
    {
      id: workflowId,
      label: `${resolvedWorkflowPreview.name || workflowId} (${workflowId})`,
    },
  ];
  const workflowAgentOptions = visibleAgentDefinitions.map((agent) => ({
    id: agent.id,
    label: agent.name ? `${agent.name} (${agent.id})` : agent.id,
  }));
  const workflowTaskOptions = (resolvedWorkflowPreview.task_definitions ?? []).map((task) => ({
    id: task.id,
    label: task.name ? `${task.name} (${task.id})` : task.id,
  }));

  const validateWorkflowBeforeAction = async (actionLabel: string) => {
    try {
      const validation = summarizeBackendValidation(
        await workflowsApi.validateWorkflow(resolvedWorkflowPreview)
      );
      setBackendValidationSummary(validation);

      if (validation.errors.length > 0) {
        throw new Error(
          `Backend validation blocked ${actionLabel}: ${validation.errors.slice(0, 3).join('; ')}`
        );
      }
    } catch (error) {
      if (error instanceof Error && !error.message.startsWith('Backend validation blocked')) {
        setBackendValidationSummary({
          errors: [error.message],
          warnings: [],
        });
      }
      throw error;
    }
  };

  const handleSave = async () => {
    if (draftValidationIssues.length > 0) {
      toast.error('Fix the workflow validation issues before saving.', { position: 'top-right' });
      return;
    }

    try {
      await toast.promise(updateMutation.mutateAsync(undefined), {
        loading: 'Saving workflow changes...',
        success: 'Workflow updated.',
        error: (error) => (error instanceof Error ? error.message : 'Failed to update workflow.'),
        position: 'top-right',
      });
    } catch {
      // The save mutation state drives the persistent inline error and retry action.
    }
  };

  const handleExecute = async () => {
    if (isEditing && draftValidationIssues.length > 0) {
      toast.error('Fix the workflow validation issues before running.', { position: 'top-right' });
      return;
    }

    try {
      await validateWorkflowBeforeAction('run');
    } catch (error) {
      toast.error(errorMessage(error, 'Backend validation failed before running.'), {
        position: 'top-right',
      });
      return;
    }

    executeMutation.mutate(undefined);
  };

  const handleGraphResumeRun = (runId: string) => {
    void toast.promise(graphResumeRunMutation.mutateAsync(runId), {
      loading: 'Resuming workflow run...',
      success: 'Workflow run resumed.',
      error: (error) => errorMessage(error, 'Failed to resume workflow run.'),
      position: 'top-right',
    });
  };

  const handleGraphRetryTask = (runId: string, taskId: string) => {
    void toast.promise(
      graphRetryTaskMutation.mutateAsync({
        runId,
        taskId,
        reason: 'Retried from failed graph task node.',
      }),
      {
        loading: 'Retrying failed task...',
        success: 'Failed task retry queued.',
        error: (error) => errorMessage(error, 'Failed to retry task.'),
        position: 'top-right',
      }
    );
  };

  const handleGraphResumeFromCheckpoint = (runId: string) => {
    void toast.promise(
      graphCheckpointResumeMutation.mutateAsync({
        runId,
        reason: 'Resumed from latest graph checkpoint.',
      }),
      {
        loading: 'Resuming from checkpoint...',
        success: 'Checkpoint resume queued.',
        error: (error) => errorMessage(error, 'Failed to resume from checkpoint.'),
        position: 'top-right',
      }
    );
  };

  const handleGraphNativeApprovalDecision = (
    runId: string,
    toolId: string,
    action: 'approve' | 'reject'
  ) => {
    const reason =
      action === 'approve' ? undefined : window.prompt('Reason for rejecting this tool call?', '');
    if (reason === null) {
      return;
    }

    void toast.promise(
      graphNativeApprovalDecisionMutation.mutateAsync({
        runId,
        toolId,
        action,
        reason: reason?.trim() || undefined,
      }),
      {
        loading: action === 'approve' ? 'Approving tool call...' : 'Rejecting tool call...',
        success: action === 'approve' ? 'Tool call approved.' : 'Tool call rejected.',
        error: (error) =>
          errorMessage(
            error,
            action === 'approve' ? 'Failed to approve tool call.' : 'Failed to reject tool call.'
          ),
        position: 'top-right',
      }
    );
  };

  const handleGraphSteeringRequest = ({
    taskId,
    agentId,
  }: {
    taskId?: string | null;
    agentId?: string | null;
  }) => {
    void toast.promise(createGraphSteeringApprovalMutation.mutateAsync({ taskId, agentId }), {
      loading: 'Requesting main-agent steering...',
      success: 'Main-agent steering request sent for approval.',
      error: (error) => errorMessage(error, 'Failed to request main-agent steering.'),
      position: 'top-right',
    });
  };

  const handleMonitoringEnabledChange = (checked: boolean) => {
    const patch = checked
      ? { enabled: true }
      : {
          enabled: false,
          reason:
            monitoringExemptionReason.trim() ||
            'Human-managed workflow; do not monitor automatically.',
        };
    void toast.promise(updateMonitoringMutation.mutateAsync(patch), {
      loading: 'Updating monitoring controls...',
      success: checked ? 'Workflow monitoring enabled.' : 'Workflow monitoring disabled.',
      error: (error) =>
        error instanceof Error ? error.message : 'Failed to update monitoring controls.',
      position: 'top-right',
    });
  };

  const handleExemptionReasonSave = () => {
    if (workflow?.monitoring?.enabled !== false) {
      return;
    }
    void toast.promise(
      updateMonitoringMutation.mutateAsync({
        enabled: false,
        reason:
          monitoringExemptionReason.trim() ||
          'Human-managed workflow; do not monitor automatically.',
      }),
      {
        loading: 'Saving exemption reason...',
        success: 'Exemption reason saved.',
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to save exemption reason.',
        position: 'top-right',
      }
    );
  };

  const handleAllowSelfMonitoringChange = (checked: boolean) => {
    const patch = checked
      ? { enabled: true, allow_self_monitoring: true }
      : { allow_self_monitoring: false };
    void toast.promise(updateMonitoringMutation.mutateAsync(patch), {
      loading: 'Updating monitoring controls...',
      success: checked ? 'Self-monitoring enabled.' : 'Self-monitoring disabled.',
      error: (error) =>
        error instanceof Error ? error.message : 'Failed to update monitoring controls.',
      position: 'top-right',
    });
  };

  const handleMonitorControlChange = (key: string, value: boolean | string | string[]) => {
    void toast.promise(updateMonitoringMutation.mutateAsync({ [key]: value }), {
      loading: 'Updating monitoring controls...',
      success: 'Monitoring controls updated.',
      error: (error) =>
        error instanceof Error ? error.message : 'Failed to update monitoring controls.',
      position: 'top-right',
    });
  };

  const handleRuntimeGovernanceChange = (patch: Record<string, unknown>) => {
    void toast.promise(updateRuntimeGovernanceMutation.mutateAsync(patch), {
      loading: 'Updating runtime governance...',
      success: 'Runtime governance updated.',
      error: (error) =>
        error instanceof Error ? error.message : 'Failed to update runtime governance.',
      position: 'top-right',
    });
  };

  const handleSharedMemoryEnabledChange = (checked: boolean, applyToAgents: boolean) => {
    void toast.promise(
      updateSharedMemoryMutation.mutateAsync({
        enabled: checked,
        apply_to_agents: applyToAgents,
      }),
      {
        loading: 'Updating shared memory...',
        success: checked ? 'Shared memory enabled.' : 'Shared memory disabled.',
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to update shared memory.',
        position: 'top-right',
      }
    );
  };

  const handleMonitorApprovalDecision = (
    approvalRequestId: string,
    action: 'approve' | 'reject' | 'request_changes' | 'split',
    steeringParameters?: Record<string, unknown>
  ) => {
    const reason =
      action === 'approve'
        ? 'Approved from workflow monitoring panel.'
        : window.prompt(
            action === 'reject'
              ? 'Reason for rejecting this monitor proposal?'
              : action === 'request_changes'
                ? 'What should the main agent revise?'
                : 'Why split this proposal into separate approval requests?',
            ''
          );
    if (reason === null) {
      return;
    }

    const labels = {
      approve: ['Applying approved proposal...', 'Monitor proposal approved.'],
      reject: ['Rejecting proposal...', 'Monitor proposal rejected.'],
      request_changes: ['Requesting proposal changes...', 'Changes requested.'],
      split: ['Splitting proposal...', 'Proposal split into separate approvals.'],
    } as const;
    const [loading, success] = labels[action];

    void toast.promise(
      monitorApprovalMutation.mutateAsync({
        approvalRequestId,
        action,
        reason: reason.trim() || null,
        steeringParameters,
      }),
      {
        loading,
        success,
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to update monitor proposal approval.',
        position: 'top-right',
      }
    );
  };

  const handleSendMonitorProposalToMainAgent = (proposalEventId: string, operatorNote?: string) => {
    void toast.promise(
      dispatchMonitorProposalMutation.mutateAsync({ proposalEventId, operatorNote }),
      {
        loading: 'Sending proposal to main agent...',
        success: 'Proposal sent to main agent.',
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to send proposal to main agent.',
        position: 'top-right',
      }
    );
  };

  const refreshFromBackend = async () => {
    if (isEditing) {
      suppressEditModeStartRef.current = true;
      stopEditing();
      updateWorkflowUrl({ nextMode: null });
    }

    await Promise.all([workflowQuery.refetch(), runsQuery.refetch(), schedulesQuery.refetch()]);
  };

  const handleRefresh = () => {
    if (hasUnsavedChanges) {
      setRefreshConfirmOpen(true);
      return;
    }
    void refreshFromBackend();
  };

  const handleGraphValidationIssues = (issues: Array<{ severity: string; message?: string }>) => {
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    if (issues.length === 0) {
      toast.success('Workflow graph looks valid.', { position: 'top-right' });
      return;
    }

    if (issues.length === 1 && issues[0]?.message) {
      toast.error(issues[0].message, { position: 'top-right' });
      return;
    }

    toast.error(
      `${issues.length} graph issue${issues.length === 1 ? '' : 's'} found${
        errorCount > 0 ? `, including ${errorCount} error${errorCount === 1 ? '' : 's'}` : ''
      }.`,
      { position: 'top-right' }
    );
  };

  const resourceIssuesFor = (
    kind: NonNullable<WorkflowGraphValidationIssue['workflowReference']>['kind'],
    id: string
  ) =>
    workflowInlineWarningIssues.filter(
      (issue) => issue.workflowReference?.kind === kind && issue.workflowReference.id === id
    );

  const renderResourceWarnings = (issues: WorkflowGraphValidationIssue[]) =>
    issues.length > 0 ? (
      <div className="rounded-md border border-amber-200 bg-amber-50/85 p-3 text-sm text-amber-950 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-medium">Resource warnings</p>
        <div className="mt-2 space-y-1">
          {issues.slice(0, 5).map((issue) => (
            <p key={issue.id}>{issue.message}</p>
          ))}
          {issues.length > 5 ? <p>{issues.length - 5} more warnings.</p> : null}
        </div>
      </div>
    ) : null;

  const updateWorkflowGraphReviewNote = (target: WorkflowGraphReviewTarget, note: string) => {
    if (!isEditing) {
      return;
    }

    const nextNotes = nextWorkflowGraphReviewNotes(
      workflowGraphReviewNotes,
      target,
      note,
      actorUserId
    );
    const nextMetadata: JsonObject = {
      ...(resolvedWorkflowPreview.metadata ?? {}),
    };

    if (nextNotes.length > 0) {
      nextMetadata[workflowGraphReviewNotesMetadataKey] = nextNotes;
    } else {
      delete nextMetadata[workflowGraphReviewNotesMetadataKey];
    }

    applyWorkflowDefinition({
      ...resolvedWorkflowPreview,
      metadata: nextMetadata,
    });
  };

  const renderGraphReviewNote = (target: WorkflowGraphReviewTarget | null) => {
    if (!target) {
      return null;
    }

    const note = workflowGraphReviewNoteByKey.get(workflowGraphReviewNoteKey(target));

    return (
      <div className="workflow-drawer-fieldset space-y-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 p-3 text-sm dark:border-fuchsia-300/20 dark:bg-fuchsia-500/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label
              htmlFor={`workflow-graph-review-note-${target.type}-${target.id}`}
              className="text-xs font-medium uppercase tracking-[0.12em] text-fuchsia-700 dark:text-fuchsia-200"
            >
              Review Note
            </Label>
            <p className="mt-1 text-xs text-fuchsia-800/80 dark:text-fuchsia-100/75">
              {target.label}
            </p>
          </div>
          {note ? <Badge variant="outline">Reviewed</Badge> : null}
        </div>
        <Textarea
          id={`workflow-graph-review-note-${target.type}-${target.id}`}
          value={note?.note ?? ''}
          disabled={!isEditing}
          placeholder="Add review context for this node."
          rows={3}
          onChange={(event) => updateWorkflowGraphReviewNote(target, event.target.value)}
        />
        {note?.updated_at ? (
          <p className="text-xs text-fuchsia-800/70 dark:text-fuchsia-100/65">
            Updated {note.updated_at}
            {note.updated_by ? ` by ${note.updated_by}` : ''}
          </p>
        ) : null}
      </div>
    );
  };

  const renderRuntimeEventPanel = (event: GraphRuntimeEvent | false | null | undefined) => {
    if (!event) {
      return null;
    }

    const payloadJson = formatRuntimeJson(event.payload);
    const metadataJson = formatRuntimeJson(event.metadata);
    const summary = runtimeEventSummary(event);

    return (
      <div className="workflow-drawer-fieldset rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-sky-950 dark:text-sky-100">Latest runtime event</p>
            <p className="mt-0.5 truncate text-xs text-sky-700 dark:text-sky-200">{event.type}</p>
          </div>
          {event.status ? (
            <Badge
              variant="outline"
              className="shrink-0 bg-white capitalize text-sky-800 dark:border-sky-300/25 dark:bg-sky-500/12 dark:text-sky-100"
            >
              {event.status}
            </Badge>
          ) : null}
        </div>
        <dl className="mt-2 grid gap-1 text-xs text-sky-900 dark:text-slate-200">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-sky-700 dark:text-sky-200">Time</dt>
            <dd className="truncate">{event.timestamp}</dd>
          </div>
          {summary ? (
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
              <dt className="text-sky-700 dark:text-sky-200">Data</dt>
              <dd className="truncate">{summary}</dd>
            </div>
          ) : null}
        </dl>
        {payloadJson ? (
          <details className="mt-2 rounded border border-sky-200 bg-white dark:border-sky-300/15 dark:bg-slate-950/80">
            <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-sky-800 dark:text-sky-100">
              Payload
            </summary>
            <pre className="max-h-40 overflow-auto border-t border-sky-100 p-2 text-[11px] leading-4 text-neutral-700 dark:border-sky-300/10 dark:text-slate-300">
              {payloadJson}
            </pre>
          </details>
        ) : null}
        {metadataJson ? (
          <details className="mt-2 rounded border border-sky-200 bg-white dark:border-sky-300/15 dark:bg-slate-950/80">
            <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-sky-800 dark:text-sky-100">
              Metadata
            </summary>
            <pre className="max-h-40 overflow-auto border-t border-sky-100 p-2 text-[11px] leading-4 text-neutral-700 dark:border-sky-300/10 dark:text-slate-300">
              {metadataJson}
            </pre>
          </details>
        ) : null}
      </div>
    );
  };

  const memoryIdsForGraphTarget = (targetKind: 'agent' | 'task', targetId: string) =>
    workflowGraphDocument.edges
      .filter(
        (edge) =>
          edge.type === workflowGraphEdgeTypes.memory &&
          readGraphEdgeDataString(edge, 'memoryId') &&
          (targetKind === 'agent'
            ? readGraphEdgeDataString(edge, 'agentId') === targetId
            : readGraphEdgeDataString(edge, 'taskId') === targetId)
      )
      .map((edge) => readGraphEdgeDataString(edge, 'memoryId'))
      .filter((memoryId): memoryId is string => Boolean(memoryId));

  const renderMemoryAccessSummary = (
    targetKind: 'agent' | 'task',
    targetId: string,
    onRemove?: (memoryId: string) => void
  ) => {
    const linkedMemoryIds = memoryIdsForGraphTarget(targetKind, targetId);

    return (
      <div className="space-y-2 rounded-md border border-teal-200 bg-teal-50/50 p-3 dark:border-teal-300/20 dark:bg-teal-500/10">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-medium uppercase tracking-[0.12em] text-teal-700 dark:text-teal-200">
            Memory Access
          </Label>
          <Badge variant="outline">{linkedMemoryIds.length} linked</Badge>
        </div>
        {linkedMemoryIds.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            No memory nodes are linked to this {targetKind} yet.
          </p>
        ) : (
          <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto pr-1">
            {linkedMemoryIds.map((memoryId) => {
              const memory = memoryMap.get(memoryId);
              return onRemove && isEditing ? (
                <Button
                  key={memoryId}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto max-w-full justify-start whitespace-normal text-left"
                  onClick={() => onRemove(memoryId)}
                >
                  Remove {memory ? memoryDisplayName(memory) : memoryId}
                </Button>
              ) : (
                <Badge key={memoryId} variant="secondary">
                  {memory ? memoryDisplayName(memory) : memoryId}
                </Badge>
              );
            })}
          </div>
        )}
        <p className="text-xs text-neutral-500 dark:text-slate-400">
          Link memory by connecting a Memory node to this{' '}
          {targetKind === 'agent' ? 'Agent' : 'Task'} node in the graph.
        </p>
      </div>
    );
  };

  const renderSelectedTaskPanel = () =>
    selectedTask ? (
      <div className="space-y-4">
        {selectedTaskWasOpenedFromApproval ? (
          <div className="workflow-drawer-fieldset rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-sm text-sky-950 dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-sky-200 bg-white/80 text-sky-800">
                    Approval gate
                  </Badge>
                  <span className="font-medium">
                    Linked to {selectedTask.name || selectedTask.id}
                  </span>
                </div>
                <p className="leading-6 text-sky-900/80 dark:text-sky-100/80">
                  This approval node is owned by the task and connected with a Requires approval
                  edge. Move the approval node to improve graph layout; update the task approval
                  setting below to add or remove the gate.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={focusSelectedApprovalLinkedTask}
              >
                Focus linked task
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'workflow-drawer-fieldset rounded-xl border p-3 text-sm',
              selectedTask.human_approval_required
                ? 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100'
                : 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      selectedTask.human_approval_required
                        ? 'border-amber-200 bg-white/80 text-amber-800 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100'
                        : 'border-slate-200 bg-white/80 text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300'
                    }
                  >
                    Approval gate
                  </Badge>
                  <span className="font-medium">
                    {selectedTask.human_approval_required
                      ? 'Requires human approval'
                      : 'No approval gate'}
                  </span>
                </div>
                <p
                  className={cn(
                    'leading-6',
                    selectedTask.human_approval_required
                      ? 'text-amber-900/80 dark:text-amber-100/80'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {selectedTask.human_approval_required
                    ? 'This task has a visible approval node connected by a Requires approval edge.'
                    : 'Enable human approval below if this task needs an explicit review gate.'}
                </p>
              </div>
              {selectedTask.human_approval_required ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={focusSelectedTaskApprovalGate}
                >
                  Focus approval gate
                </Button>
              ) : null}
            </div>
          </div>
        )}
        {activeTab === 'graph'
          ? renderResourceWarnings(resourceIssuesFor('task', selectedTask.id))
          : null}
        <WorkflowTaskFocusPanel
          surface={activeTab === 'graph' ? 'graph' : 'builder'}
          selectedTask={selectedTask}
          selectedAgent={selectedTaskAgent}
          workflowCapabilityTags={effectiveWorkflowCapabilityTags}
          visibleAgentDefinitions={visibleAgentDefinitions}
          modelProfiles={behaviorProfiles}
          toolDefinitions={assignableToolDefinitions}
          memoryDefinitions={workflowMemoryDefinitions}
          dependencyLinks={dependencyLinks}
          dependentLinks={dependentLinks}
          preferredDependencyTaskId={
            dependencyTasks.some((task) => task.id === previousTask?.id)
              ? (previousTask?.id ?? null)
              : null
          }
          preferredDependentTaskId={
            dependentTasks.some((task) => task.id === nextTask?.id) ? (nextTask?.id ?? null) : null
          }
          previousTaskLabel={previousTaskLabel}
          nextTaskLabel={nextTaskLabel}
          isEditing={isEditing}
          onClearSelection={() => {
            setSelectedGraphApprovalTaskId(null);
            updateWorkflowUrl({ nextTaskId: null });
          }}
          onUpdateTask={(updates) => {
            if (selectedTaskIndex >= 0) {
              updateTaskDefinition(selectedTaskIndex, updates);
            }
          }}
          onDependencyEdgeTypeChange={(taskId, edgeType) =>
            updateEdgeMetadata(taskId, selectedTask.id, { edgeType })
          }
          onDependencyConditionChange={(taskId, condition) =>
            updateEdgeMetadata(taskId, selectedTask.id, { condition })
          }
          onDependencyMetadataChange={(taskId, metadataJson) =>
            updateEdgeMetadata(taskId, selectedTask.id, { metadataJson })
          }
          onDependentEdgeTypeChange={(taskId, edgeType) =>
            updateEdgeMetadata(selectedTask.id, taskId, { edgeType })
          }
          onDependentConditionChange={(taskId, condition) =>
            updateEdgeMetadata(selectedTask.id, taskId, { condition })
          }
          onDependentMetadataChange={(taskId, metadataJson) =>
            updateEdgeMetadata(selectedTask.id, taskId, { metadataJson })
          }
          onSelectDependencyTask={(taskId) => {
            setSelectedGraphApprovalTaskId(null);
            updateWorkflowUrl({ nextTaskId: taskId });
          }}
          onSelectDependentTask={(taskId) => {
            setSelectedGraphApprovalTaskId(null);
            updateWorkflowUrl({ nextTaskId: taskId });
          }}
          onSelectPreviousTask={() => selectAdjacentTask('previous')}
          onSelectNextTask={() => selectAdjacentTask('next')}
        />
        {activeTab === 'graph'
          ? renderMemoryAccessSummary('task', selectedTask.id, (memoryId) => {
              if (selectedTaskIndex >= 0) {
                updateTaskDefinition(selectedTaskIndex, {
                  memory_ids: (selectedTask.memory_ids ?? []).filter(
                    (candidateId) => candidateId !== memoryId
                  ),
                });
              }
            })
          : null}
        {activeTab === 'graph' ? renderRuntimeEventPanel(selectedTaskRuntimeEvent) : null}
      </div>
    ) : null;

  const updateSelectedGraphAgent = (updates: Partial<AgentDefinition>) => {
    if (selectedGraphAgentIndex < 0) {
      return;
    }

    updateAgentDefinition(selectedGraphAgentIndex, updates);
  };

  const updateSelectedGraphAgentFields = (
    updates: Partial<AgentDefinition>,
    overrideFields: PersonaAgentSnapshotField[]
  ) => {
    if (!selectedGraphAgent || selectedGraphAgentIndex < 0) {
      return;
    }

    const nextAgent = markPersonaAgentFieldOverrides(
      {
        ...selectedGraphAgent,
        ...updates,
      },
      overrideFields
    );
    updateAgentDefinition(selectedGraphAgentIndex, nextAgent);
  };

  const handleUseLatestPersonaAgent = (
    notice: PersonaAgentVersionNotice,
    options: { replaceAll?: boolean } = {}
  ) => {
    if (useLatestPersonaMutation.isPending) {
      return;
    }
    const sourceAgent =
      personaAgentDefinitions.find((agent) => agent.id === notice.publishedAgentId) ??
      (selectedGraphAgent
        ? findPersonaSourceAgent(selectedGraphAgent, personaAgentDefinitions)
        : null);
    if (isEditing && selectedGraphAgent && sourceAgent) {
      updateSelectedGraphAgent(
        applyPersonaAgentSnapshot(selectedGraphAgent, sourceAgent, {
          preserveOverrides: !options.replaceAll,
        })
      );
      toast.success(
        options.replaceAll
          ? 'Replaced workflow agent fields from the latest persona.'
          : 'Updated persona fields and preserved workflow overrides.',
        { position: 'top-right' }
      );
      return;
    }
    useLatestPersonaMutation.mutate(notice);
  };

  const createPersonaBackedGraphAgent = () => {
    if (!isEditing || !personaQuickCreateAgentId) {
      return;
    }

    const personaAgent = personaAgentDefinitions.find(
      (candidate) => candidate.id === personaQuickCreateAgentId
    );
    if (!personaAgent) {
      return;
    }

    const draftAgent = createWorkflowGraphDraftAgentDefinition(visibleAgentDefinitions.length);
    const nextAgent = applyPersonaAgentSnapshot(draftAgent, personaAgent);
    applyWorkflowDefinition({
      ...resolvedWorkflowPreview,
      agent_definitions: [...(resolvedWorkflowPreview.agent_definitions ?? []), nextAgent],
    });
    setSelectedGraphAgentId(nextAgent.id);
    setPersonaQuickCreateAgentId('');
    toast.success('Added persona agent to the workflow graph.', { position: 'top-right' });
  };

  const renderSelectedAgentPanel = () => {
    if (!selectedGraphAgent) {
      return null;
    }

    const selectedProfileId = selectedGraphAgent.model_profile_id ?? '';
    const selectedProfileKnown = behaviorProfiles.some(
      (profile) => profile.id === selectedProfileId
    );
    const agentBackendLinks = (workflowMemoryLinksQuery.data?.items ?? []).filter(
      (link) => link.targetType === 'agent' && link.targetId === selectedGraphAgent.id
    );
    const agentBackendLinkKeys = new Set(
      agentBackendLinks.map((link) => `${link.refType}:${link.refId}`)
    );
    const agentCatalogItems = (agentMemoryCatalogQuery.data?.groups ?? []).flatMap((group) =>
      group.items.map((item) => ({
        groupLabel: group.label,
        item,
      }))
    );
    const memoryLinkActionPending =
      addWorkflowMemoryLinkMutation.isPending || deleteWorkflowMemoryLinkMutation.isPending;
    const selectedPersonaNotice = personaVersionNoticeByAgentId.get(selectedGraphAgent.id);
    const metadataPersonaSlug = selectedGraphAgent.metadata?.persona_slug;
    const selectedPersonaSlug =
      selectedPersonaNotice?.personaSlug ??
      (typeof metadataPersonaSlug === 'string' && metadataPersonaSlug.trim()
        ? metadataPersonaSlug.trim()
        : null);
    const metadataPersonaVersionId = selectedGraphAgent.metadata?.persona_version_id;
    const selectedPersonaVersionId =
      selectedPersonaNotice?.workflowPersonaVersionId ??
      (typeof metadataPersonaVersionId === 'string' && metadataPersonaVersionId.trim()
        ? metadataPersonaVersionId.trim()
        : null);
    const personaActionPending =
      useLatestPersonaMutation.isPending || keepPersonaVersionMutation.isPending;
    const selectedPersonaSourceAgent = findPersonaSourceAgent(
      selectedGraphAgent,
      personaAgentDefinitions
    );
    const selectedCatalogAgent = (agentsQuery.data ?? []).find(
      (agent) => agent.id === selectedGraphAgent.id
    );
    const selectedAgentGuardrails = normalizeWorkflowAgentGuardrails(selectedGraphAgent.guardrails);
    const updateSelectedAgentGuardrails = (nextGuardrails: typeof selectedAgentGuardrails) => {
      updateSelectedGraphAgentFields({ guardrails: nextGuardrails }, ['guardrails']);
    };
    const updateSelectedAgentGuardrail = (
      guardrailId: string,
      updates: Partial<(typeof selectedAgentGuardrails)[number]>
    ) => {
      updateSelectedAgentGuardrails(
        selectedAgentGuardrails.map((guardrail) =>
          guardrail.id === guardrailId ? { ...guardrail, ...updates } : guardrail
        )
      );
    };
    const personaSnapshotFieldNames = personaAgentSnapshotFields.filter((field) =>
      isPersonaAgentFieldFromSnapshot(selectedGraphAgent, field)
    );
    const personaFieldBadge = (field: PersonaAgentSnapshotField) => {
      if (!isPersonaAgentFieldFromSnapshot(selectedGraphAgent, field)) {
        return null;
      }

      const overridden = isPersonaAgentFieldOverridden(selectedGraphAgent, field);
      return (
        <Badge
          variant="outline"
          className={
            overridden
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-sky-200 bg-sky-50 text-sky-800'
          }
        >
          {overridden ? 'Overridden' : 'From persona'}
        </Badge>
      );
    };

    return (
      <div className="space-y-5">
        {renderResourceWarnings(resourceIssuesFor('agent', selectedGraphAgent.id))}

        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-agent-950 dark:text-agent-100">
            {selectedGraphAgent.name}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-slate-300">
            {selectedGraphAgent.role ||
              selectedGraphAgent.description ||
              'No role configured for this agent.'}
          </p>
        </div>

        {selectedPersonaSlug ? (
          <div
            className={`rounded-md border p-3 text-sm ${
              selectedPersonaNotice?.status === 'outdated'
                ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100'
                : 'border-agent-200 bg-agent-50/70 text-agent-950 dark:border-agent-400/20 dark:bg-agent-500/10 dark:text-agent-100'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">Persona agent</p>
                <p className="mt-1 text-xs">
                  @{selectedPersonaSlug}
                  {selectedPersonaVersionId
                    ? ` ${shortPersonaVersionId(selectedPersonaVersionId)}`
                    : ''}
                  {selectedPersonaNotice?.status === 'pinned' ? ' kept for this workflow' : ''}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  selectedPersonaNotice?.status === 'outdated'
                    ? 'border-amber-300 bg-white text-amber-800 dark:border-amber-300/25 dark:bg-slate-950/70 dark:text-amber-100'
                    : 'border-agent-200 bg-white text-agent-800 dark:border-agent-400/25 dark:bg-slate-950/70 dark:text-agent-100'
                }
              >
                {selectedPersonaNotice?.status === 'outdated'
                  ? 'New version'
                  : selectedPersonaNotice?.status === 'pinned'
                    ? 'Kept'
                    : 'Current'}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-5">
              {selectedPersonaNotice?.message ??
                'This workflow embeds a persona-backed agent snapshot.'}
            </p>
            {selectedPersonaNotice?.status === 'outdated' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !isEditing || personaActionPending || !selectedPersonaNotice.publishedAgentId
                  }
                  onClick={() => handleUseLatestPersonaAgent(selectedPersonaNotice)}
                >
                  Use latest persona
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    !isEditing || personaActionPending || !selectedPersonaNotice.publishedAgentId
                  }
                  onClick={() =>
                    handleUseLatestPersonaAgent(selectedPersonaNotice, { replaceAll: true })
                  }
                >
                  Replace all fields
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isEditing || personaActionPending}
                  onClick={() => keepPersonaVersionMutation.mutate(selectedPersonaNotice)}
                >
                  Keep current
                </Button>
              </div>
            ) : null}
            {!isEditing && selectedPersonaNotice?.status === 'outdated' ? (
              <p className="mt-2 text-xs">Switch to edit mode to update this persona snapshot.</p>
            ) : null}
          </div>
        ) : null}

        <div className="workflow-drawer-fieldset workflow-drawer-section-agent-catalog rounded-xl border border-agent-200/60 bg-agent-50/60 p-3 text-sm dark:border-agent-300/16 dark:bg-agent-500/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500 shadow-sm" />
                <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600 dark:text-slate-300">
                  Global agent catalog
                </p>
                <Badge variant="outline" className="shrink-0">
                  {selectedCatalogAgent ? 'Published' : 'Workflow only'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-neutral-600 dark:text-slate-300">
                Promote this workflow agent so it becomes searchable on the agent page.
              </p>
              {selectedCatalogAgent ? (
                <p className="mt-2 text-xs text-neutral-500 dark:text-slate-400">
                  A global catalog entry with this agent ID already exists.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant={agentPromotionEditorOpen ? 'outline' : 'default'}
              size="sm"
              disabled={promoteWorkflowAgentMutation.isPending}
              onClick={() => setAgentPromotionEditorOpen((current) => !current)}
            >
              {agentPromotionEditorOpen ? 'Cancel promotion' : 'Promote to global'}
            </Button>
          </div>
          {agentPromotionEditorOpen ? (
            <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3 dark:border-white/10">
              <div className="space-y-1.5">
                <Label htmlFor={`graph-agent-promotion-id-${selectedGraphAgent.id}`}>
                  Global agent ID
                </Label>
                <Input
                  id={`graph-agent-promotion-id-${selectedGraphAgent.id}`}
                  value={agentPromotionGlobalId}
                  disabled={promoteWorkflowAgentMutation.isPending}
                  onChange={(event) => setAgentPromotionGlobalId(event.currentTarget.value)}
                />
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  Keep the current ID to create or refresh the matching catalog record.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-xs text-neutral-700 has-disabled:cursor-not-allowed dark:text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                  checked={agentPromotionReplaceWorkflowAgent}
                  disabled={promoteWorkflowAgentMutation.isPending}
                  onChange={(event) =>
                    setAgentPromotionReplaceWorkflowAgent(event.currentTarget.checked)
                  }
                />
                <span>
                  Replace this workflow agent with the promoted global agent identity after
                  promotion.
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    promoteWorkflowAgentMutation.isPending || !agentPromotionGlobalId.trim()
                  }
                  onClick={() =>
                    promoteWorkflowAgentMutation.mutate({
                      agentId: selectedGraphAgent.id,
                      payload: {
                        global_agent_id: agentPromotionGlobalId.trim(),
                        replace_workflow_agent: agentPromotionReplaceWorkflowAgent,
                      },
                    })
                  }
                >
                  {agentPromotionReplaceWorkflowAgent ? 'Promote and replace' : 'Promote agent'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={promoteWorkflowAgentMutation.isPending}
                  onClick={() => {
                    setAgentPromotionEditorOpen(false);
                    setAgentPromotionGlobalId(selectedGraphAgent.id);
                    setAgentPromotionReplaceWorkflowAgent(false);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div className="workflow-drawer-fieldset workflow-drawer-section-agent-persona space-y-2 rounded-xl border border-agent-200/60 bg-agent-50/50 p-3 dark:border-agent-300/15 dark:bg-agent-500/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500 shadow-sm" />
                <Label
                  htmlFor={`graph-agent-persona-${selectedGraphAgent.id}`}
                  className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600 dark:text-slate-300"
                >
                  Persona source
                </Label>
              </div>
              <Badge variant="outline" className="shrink-0">
                {selectedPersonaSourceAgent ? 'Linked' : 'None'}
              </Badge>
            </div>
            <select
              id={`graph-agent-persona-${selectedGraphAgent.id}`}
              value={selectedPersonaSourceAgent?.id ?? ''}
              disabled={!isEditing || personaAgentDefinitions.length === 0}
              className="workflow-drawer-input flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-agent-300/14 dark:bg-slate-950/78 dark:text-slate-100"
              onChange={(event) => {
                const personaAgent = personaAgentDefinitions.find(
                  (candidate) => candidate.id === event.target.value
                );
                if (!personaAgent) {
                  return;
                }

                updateSelectedGraphAgent(
                  applyPersonaAgentSnapshot(selectedGraphAgent, personaAgent)
                );
              }}
            >
              <option value="">
                {personaAgentDefinitions.length === 0
                  ? 'No published persona agents available'
                  : 'Choose persona to fill this agent'}
              </option>
              {personaAgentDefinitions.map((personaAgent) => (
                <option key={personaAgent.id} value={personaAgent.id}>
                  {graphAgentOptionLabel(
                    personaAgent,
                    personaVersionNoticeByAgentId.get(personaAgent.id)
                  )}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Selecting a persona fills this agent&apos;s identity and capability fields while
              keeping graph links and task assignments intact.
            </p>
            {personaSnapshotFieldNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {personaSnapshotFieldNames.map((field) => (
                  <Badge key={field} variant="secondary">
                    {personaSnapshotFieldLabel(field)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`graph-agent-name-${selectedGraphAgent.id}`}>Name</Label>
              {personaFieldBadge('name')}
            </div>
            <Input
              id={`graph-agent-name-${selectedGraphAgent.id}`}
              value={selectedGraphAgent.name}
              disabled={!isEditing}
              onChange={(event) =>
                updateSelectedGraphAgentFields({ name: event.target.value }, ['name'])
              }
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`graph-agent-role-${selectedGraphAgent.id}`}>Role</Label>
              {personaFieldBadge('role')}
            </div>
            <Input
              id={`graph-agent-role-${selectedGraphAgent.id}`}
              value={selectedGraphAgent.role ?? ''}
              disabled={!isEditing}
              onChange={(event) =>
                updateSelectedGraphAgentFields(
                  {
                    role: event.target.value,
                    system_prompt: event.target.value,
                  },
                  ['role', 'system_prompt']
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`graph-agent-description-${selectedGraphAgent.id}`}>
                Description
              </Label>
              {personaFieldBadge('description')}
            </div>
            <Textarea
              id={`graph-agent-description-${selectedGraphAgent.id}`}
              value={selectedGraphAgent.description ?? ''}
              disabled={!isEditing}
              className="min-h-24"
              onChange={(event) =>
                updateSelectedGraphAgentFields(
                  {
                    description: event.target.value,
                  },
                  ['description']
                )
              }
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`graph-agent-instructions-${selectedGraphAgent.id}`}>
                Instructions
              </Label>
              {personaFieldBadge('instructions')}
            </div>
            <Textarea
              id={`graph-agent-instructions-${selectedGraphAgent.id}`}
              value={selectedGraphAgent.instructions ?? ''}
              disabled={!isEditing}
              className="min-h-32"
              onChange={(event) =>
                updateSelectedGraphAgentFields(
                  {
                    instructions: event.target.value,
                  },
                  ['instructions']
                )
              }
            />
          </div>

          <div className="workflow-drawer-fieldset workflow-drawer-section-agent-guardrails space-y-3 rounded-xl border border-amber-200/70 bg-amber-50/55 p-3 dark:border-amber-300/16 dark:bg-amber-400/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-600 dark:text-slate-300">
                    Guardrails
                  </Label>
                  {personaFieldBadge('guardrails')}
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                  Persist behavior boundaries on the workflow agent definition.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!isEditing}
                onClick={() =>
                  updateSelectedAgentGuardrails([
                    ...selectedAgentGuardrails,
                    createWorkflowAgentGuardrailDraft(selectedAgentGuardrails.length),
                  ])
                }
              >
                Add guardrail
              </Button>
            </div>

            {selectedAgentGuardrails.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No guardrails are configured for this workflow agent.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedAgentGuardrails.map((guardrail, index) => (
                  <div
                    key={guardrail.id}
                    className="space-y-3 rounded-md border border-amber-200/70 bg-white/90 p-3 dark:border-amber-300/14 dark:bg-slate-950/76"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="secondary">Guardrail {index + 1}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!isEditing}
                        onClick={() =>
                          updateSelectedAgentGuardrails(
                            selectedAgentGuardrails.filter(
                              (candidate) => candidate.id !== guardrail.id
                            )
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`graph-agent-guardrail-name-${guardrail.id}`}>Name</Label>
                        <Input
                          id={`graph-agent-guardrail-name-${guardrail.id}`}
                          value={guardrail.name}
                          disabled={!isEditing}
                          onChange={(event) =>
                            updateSelectedAgentGuardrail(guardrail.id, {
                              name: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`graph-agent-guardrail-mode-${guardrail.id}`}>Mode</Label>
                        <select
                          id={`graph-agent-guardrail-mode-${guardrail.id}`}
                          value={guardrail.mode ?? 'policy'}
                          disabled={!isEditing}
                          className="workflow-drawer-input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-amber-300/14 dark:bg-slate-950/78 dark:text-slate-100"
                          onChange={(event) =>
                            updateSelectedAgentGuardrail(guardrail.id, {
                              mode: event.target.value as typeof guardrail.mode,
                            })
                          }
                        >
                          {workflowAgentGuardrailModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`graph-agent-guardrail-description-${guardrail.id}`}>
                        Description
                      </Label>
                      <Textarea
                        id={`graph-agent-guardrail-description-${guardrail.id}`}
                        value={guardrail.description ?? ''}
                        disabled={!isEditing}
                        className="min-h-20"
                        onChange={(event) =>
                          updateSelectedAgentGuardrail(guardrail.id, {
                            description: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`graph-agent-model-profile-${selectedGraphAgent.id}`}>
                Model profile
              </Label>
              {personaFieldBadge('model_profile_id')}
            </div>
            <select
              id={`graph-agent-model-profile-${selectedGraphAgent.id}`}
              value={selectedProfileId || noModelProfileValue}
              disabled={!isEditing}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-agent-300/14 dark:bg-slate-950/78 dark:text-slate-100"
              onChange={(event) =>
                updateSelectedGraphAgentFields(
                  {
                    model_profile_id:
                      event.target.value === noModelProfileValue ? null : event.target.value,
                  },
                  ['model_profile_id']
                )
              }
            >
              <option value={noModelProfileValue}>No profile</option>
              {selectedProfileId && !selectedProfileKnown ? (
                <option value={selectedProfileId}>
                  {profileNameFor(selectedProfileId, behaviorProfiles)}
                </option>
              ) : null}
              {behaviorProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          {renderMemoryAccessSummary('agent', selectedGraphAgent.id, (memoryId) =>
            updateSelectedGraphAgentFields(
              {
                memory_ids: (selectedGraphAgent.memory_ids ?? []).filter(
                  (candidateId) => candidateId !== memoryId
                ),
              },
              ['memory_ids']
            )
          )}

          <div className="space-y-3 rounded-md border border-teal-200/60 bg-teal-50/55 p-3 dark:border-teal-300/16 dark:bg-teal-500/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-slate-400">
                  Memory Access
                </Label>
                <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                  Grant catalog or graph-selected memories to this agent.
                </p>
              </div>
              <Badge variant="outline">{agentBackendLinks.length} linked</Badge>
            </div>

            {workflowMemoryLinksQuery.isLoading ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                Loading assigned memories...
              </p>
            ) : agentBackendLinks.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No memories are assigned to this agent yet.
              </p>
            ) : (
              <div className="space-y-2">
                {agentBackendLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-teal-200/50 bg-white/90 px-3 py-2 dark:border-teal-300/14 dark:bg-slate-950/76"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
                        {link.label || link.refId}
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-neutral-500 dark:text-slate-400">
                        <Badge variant="secondary">{readableMemoryValue(link.refType)}</Badge>
                        <Badge variant="outline">{readableMemoryValue(link.accessMode)}</Badge>
                        <span>{link.memoryIds.length} records</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={memoryLinkActionPending}
                      onClick={() => deleteWorkflowMemoryLinkMutation.mutate(link.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-slate-400">
                  Add From Catalog
                </Label>
                {agentMemoryCatalogQuery.isFetching ? (
                  <span className="text-xs text-neutral-500 dark:text-slate-400">
                    Refreshing...
                  </span>
                ) : null}
              </div>
              {agentMemoryCatalogQuery.isLoading ? (
                <p className="text-sm text-neutral-500 dark:text-slate-400">
                  Loading linkable memories...
                </p>
              ) : agentCatalogItems.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-slate-400">
                  No linkable memories are available for this agent.
                </p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {agentCatalogItems.map(({ groupLabel, item }) => {
                    const catalogKey = memoryCatalogItemKey(item);
                    const alreadyLinked = agentBackendLinkKeys.has(catalogKey);
                    const blocked = !item.canLink || alreadyLinked;
                    const blockedReason = alreadyLinked
                      ? 'Already linked'
                      : item.blockedReason || item.exclusionReason;
                    return (
                      <div
                        key={catalogKey}
                        className="flex items-start justify-between gap-3 rounded-md border border-teal-200/50 bg-white/90 px-3 py-2 dark:border-teal-300/14 dark:bg-slate-950/76"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
                              {item.label}
                            </span>
                            <Badge variant="secondary">{groupLabel}</Badge>
                            {item.sensitive ? <Badge variant="destructive">Sensitive</Badge> : null}
                          </div>
                          <p className="line-clamp-2 text-xs text-neutral-500 dark:text-slate-400">
                            {item.summary || item.preview}
                          </p>
                          <div className="flex flex-wrap gap-1 text-xs text-neutral-500 dark:text-slate-400">
                            <Badge variant="outline">{readableMemoryValue(item.scope)}</Badge>
                            <Badge variant="outline">{readableMemoryValue(item.memoryType)}</Badge>
                            {item.mode ? (
                              <Badge variant="outline">{readableMemoryValue(item.mode)}</Badge>
                            ) : null}
                            {blockedReason ? <span>{blockedReason}</span> : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={blocked || memoryLinkActionPending}
                          onClick={() =>
                            addWorkflowMemoryLinkMutation.mutate({
                              targetType: 'agent',
                              targetId: selectedGraphAgent.id,
                              refId: item.id,
                              refType: item.refType,
                            })
                          }
                        >
                          {alreadyLinked ? 'Linked' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {!isEditing ? (
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Switch to edit mode to modify this agent.
          </p>
        ) : null}
        {renderRuntimeEventPanel(selectedGraphAgentRuntimeEvent)}
      </div>
    );
  };

  const renderSelectedToolPanel = () => {
    // Tool nodes keep a local draft list so access toggles update the drawer immediately; the
    // graph rebuild then persists the same selection back into workflow state.
    const selectedToolIds = selectedGraphToolNodeId
      ? selectedGraphToolIds
      : selectedGraphToolNode
        ? Array.isArray(selectedGraphToolNode.data?.toolIds)
          ? selectedGraphToolNode.data.toolIds.filter(
              (toolId): toolId is string => typeof toolId === 'string'
            )
          : []
        : selectedGraphToolIds.length > 0
          ? selectedGraphToolIds
          : selectedGraphToolId && selectedGraphToolId !== workflowGraphToolListSelectionId
            ? [selectedGraphToolId]
            : [];
    const selectedToolIdSet = new Set(selectedToolIds);
    const sortedToolDefinitions = sortToolsForWorkflowCapabilities(
      assignableToolDefinitions,
      effectiveWorkflowCapabilityTags
    );
    const equippedToolDefinitions = selectedToolIds.map((toolId) => ({
      id: toolId,
      tool: toolMap.get(toolId) ?? sortedToolDefinitions.find((tool) => tool.id === toolId) ?? null,
    }));
    const recommendedToolIds = new Set(
      toolsRecommendedForWorkflowCapabilities(
        assignableToolDefinitions,
        effectiveWorkflowCapabilityTags
      ).map((tool) => tool.id)
    );
    const assignedAgentIdsForTool = (toolId: string) =>
      visibleAgentDefinitions
        .filter((agent) => (agent.tool_ids ?? agent.toolIds ?? []).includes(toolId))
        .map((agent) => agent.id);
    const syncLinkedAgentToolAssignments = (
      definition: WorkflowDefinition,
      changedToolId: string,
      removing: boolean
    ): WorkflowDefinition => {
      if (!selectedGraphToolNodeAgentId) {
        return definition;
      }

      return {
        ...definition,
        agent_definitions: (definition.agent_definitions ?? []).map((agent) =>
          agent.id === selectedGraphToolNodeAgentId
            ? removing
              ? withoutAgentToolRuntimeConfig(
                  {
                    ...agent,
                    tool_ids: (agent.tool_ids ?? agent.toolIds ?? []).filter(
                      (candidateId) => candidateId !== changedToolId
                    ),
                  },
                  [changedToolId]
                )
              : {
                  ...agent,
                  tool_ids: Array.from(
                    new Set([...(agent.tool_ids ?? agent.toolIds ?? []), changedToolId])
                  ),
                }
            : agent
        ),
        task_definitions: removing
          ? (definition.task_definitions ?? []).map((task) =>
              task.agent_id === selectedGraphToolNodeAgentId
                ? {
                    ...task,
                    // The tool node represents the linked agent's usable tool surface. When a
                    // tool is removed here, task-level assignments for the same agent must also
                    // drop it or the graph adapter will re-derive the tool back into the node.
                    tool_ids: (task.tool_ids ?? []).filter(
                      (candidateId) => candidateId !== changedToolId
                    ),
                  }
                : task
            )
          : definition.task_definitions,
      };
    };
    const syncSelectedToolNodeRecord = (
      definition: WorkflowDefinition,
      nextToolIds: string[]
    ): WorkflowDefinition => {
      const toolNodeRecordId =
        selectedGraphToolNode && typeof selectedGraphToolNode.data?.toolNodeId === 'string'
          ? selectedGraphToolNode.data.toolNodeId
          : selectedGraphToolNodeId;
      if (!toolNodeRecordId) {
        return definition;
      }

      const metadata =
        definition.metadata &&
        typeof definition.metadata === 'object' &&
        !Array.isArray(definition.metadata)
          ? { ...(definition.metadata as Record<string, unknown>) }
          : {};
      const storedRecords = Array.isArray(metadata.workflow_graph_tool_nodes)
        ? metadata.workflow_graph_tool_nodes.filter(
            (record): record is Record<string, unknown> =>
              Boolean(record) && typeof record === 'object' && !Array.isArray(record)
          )
        : [];
      const nextRecord = {
        id: toolNodeRecordId,
        toolIds: nextToolIds,
        ...(nextToolIds.length > 0
          ? {
              toolNames: nextToolIds.map(
                (nextToolId) => toolMap.get(nextToolId)?.display_name ?? nextToolId
              ),
            }
          : {}),
        agentId: selectedGraphToolNodeAgentId ?? null,
        ...(selectedGraphToolNode?.position
          ? {
              position: {
                x: selectedGraphToolNode.position.x,
                y: selectedGraphToolNode.position.y,
              },
            }
          : {}),
      };

      metadata.workflow_graph_tool_nodes = [
        ...storedRecords.filter((record) => record.id !== toolNodeRecordId),
        nextRecord,
      ];

      return {
        ...definition,
        metadata: metadata as JsonObject,
      };
    };
    const saveToolParametersForAgent = (
      agentId: string,
      tool: ToolDefinition,
      parameters: Record<string, JsonValue>
    ) => {
      const nextWorkflow = {
        ...resolvedWorkflowPreview,
        agent_definitions: (resolvedWorkflowPreview.agent_definitions ?? []).map((agent) =>
          agent.id === agentId ? withAgentToolRuntimeConfig(agent, tool, parameters) : agent
        ),
      };
      applyWorkflowDefinition(
        tool.id === 'agency.http.request'
          ? clearToolConnectorBinding(nextWorkflow, tool.id)
          : nextWorkflow
      );
    };
    const clearToolParametersForAgent = (agentId: string, toolId: string) => {
      applyWorkflowDefinition({
        ...resolvedWorkflowPreview,
        agent_definitions: (resolvedWorkflowPreview.agent_definitions ?? []).map((agent) =>
          agent.id === agentId ? withoutAgentToolRuntimeConfig(agent, [toolId]) : agent
        ),
      });
    };
    const workflowWithClearedToolParametersForAgent = (
      definition: WorkflowDefinition,
      agentId: string,
      toolId: string
    ): WorkflowDefinition => ({
      ...definition,
      agent_definitions: (definition.agent_definitions ?? []).map((agent) =>
        agent.id === agentId ? withoutAgentToolRuntimeConfig(agent, [toolId]) : agent
      ),
    });
    const toggleToolNodeTool = (toolId: string) => {
      const hasTool = selectedToolIdSet.has(toolId);
      const nextToolIds = hasTool
        ? selectedToolIds.filter((candidateId) => candidateId !== toolId)
        : [...selectedToolIds, toolId];
      const removedToolIds = hasTool
        ? selectedToolIds.filter((candidateId) => candidateId === toolId)
        : [];
      const nextWorkflow = clearUnusedToolConnectorBindings(
        syncSelectedToolNodeRecord(
          syncLinkedAgentToolAssignments(resolvedWorkflowPreview, toolId, hasTool),
          nextToolIds
        ),
        removedToolIds
      );
      applyWorkflowDefinition(nextWorkflow);
      setSelectedGraphToolIds(nextToolIds);
    };
    const toggleAgentToolAccess = (agent: AgentDefinition, agentIndex: number, toolId: string) => {
      const currentToolIds = agent.tool_ids ?? agent.toolIds ?? [];
      if (currentToolIds.includes(toolId)) {
        revokeAgentToolAccess(agent, agentIndex, toolId);
        return;
      }

      updateAgentDefinition(agentIndex, {
        tool_ids: [...currentToolIds, toolId],
      });
    };
    const connectorCredentials = credentialsQuery.data ?? [];
    const connectorCapabilities = connectorCapabilitiesQuery.data?.connectors ?? {};
    const saveToolConnectorBinding = (
      tool: ToolDefinition,
      form: HTMLFormElement,
      remove = false
    ) => {
      const existingBinding = firstConnectorBinding(tool);
      const currentBindings = Array.isArray(tool.security?.connector_bindings)
        ? (tool.security?.connector_bindings as ConnectorBindingDefinition[])
        : [];
      const [, ...remainingBindings] = currentBindings;
      const nextSecurity = {
        ...(tool.security ?? {}),
        connector_bindings: remove
          ? remainingBindings
          : (() => {
              const data = new FormData(form);
              const provider = String(data.get('provider') ?? '').trim();
              const credentialId = String(data.get('credential_id') ?? '').trim();
              const purpose = String(data.get('purpose') ?? '').trim();
              if (!provider || !credentialId) {
                throw new Error('Provider and credential are required.');
              }
              const credential = connectorCredentials.find((item) => item.id === credentialId);
              const previousTargetScope =
                existingBinding?.provider === provider ? (existingBinding.target_scope ?? {}) : {};
              const targetScope = parseConnectorTargetScopeForm(
                data,
                provider,
                connectorCapabilities,
                previousTargetScope
              );
              const binding: ConnectorBindingDefinition = {
                provider,
                credential_id: credentialId,
                purpose: purpose || null,
                target_scope: targetScope,
                identity_summary: credential ? credentialBindingLabel(credential) : null,
              };
              return [binding, ...remainingBindings];
            })(),
      };
      const nextToolDefinition = {
        ...tool,
        security: nextSecurity,
      };
      if (!remove && tool.id === 'agency.http.request' && selectedGraphToolNodeAgentId) {
        applyWorkflowDefinition(
          workflowWithClearedToolParametersForAgent(
            {
              ...resolvedWorkflowPreview,
              tool_definitions: (resolvedWorkflowPreview.tool_definitions ?? []).map((candidate) =>
                candidate.id === tool.id ? nextToolDefinition : candidate
              ),
            },
            selectedGraphToolNodeAgentId,
            tool.id
          )
        );
        setHttpRequestSetupModeByToolId((current) => ({
          ...current,
          [tool.id]: 'binding',
        }));
        return;
      }
      upsertToolDefinition(nextToolDefinition);
    };

    const isToolNodeDrawer = Boolean(selectedGraphToolNodeId);

    if (!isToolNodeDrawer && selectedToolIds.length === 0 && sortedToolDefinitions.length === 0) {
      return null;
    }

    const groupedToolDefinitions = Array.from(
      sortedToolDefinitions
        .reduce<Map<string, ToolDefinition[]>>((groups, tool) => {
          const groupName = tool.tool_type || 'Other tools';
          groups.set(groupName, [...(groups.get(groupName) ?? []), tool]);
          return groups;
        }, new Map())
        .entries()
    )
      .map(
        ([groupName, tools]) =>
          [
            groupName,
            [...tools].sort((left, right) => {
              const assignmentOrder =
                Number(selectedToolIdSet.has(right.id)) - Number(selectedToolIdSet.has(left.id));
              return assignmentOrder || toolDisplayName(left).localeCompare(toolDisplayName(right));
            }),
          ] as const
      )
      .sort(([leftGroup, leftTools], [rightGroup, rightTools]) => {
        const assignmentOrder =
          Number(rightTools.some((tool) => selectedToolIdSet.has(tool.id))) -
          Number(leftTools.some((tool) => selectedToolIdSet.has(tool.id)));
        return assignmentOrder || leftGroup.localeCompare(rightGroup);
      });
    const normalizedToolSearch = toolDrawerSearch.trim().replace(/[_-]+/g, ' ').toLowerCase();
    const visibleGroupedToolDefinitions = groupedToolDefinitions
      .map(([groupName, tools]) => {
        if (!normalizedToolSearch) {
          return [groupName, tools] as const;
        }

        const groupSearchText = readableToolGroupName(groupName).toLowerCase();
        if (groupSearchText.includes(normalizedToolSearch)) {
          return [groupName, tools] as const;
        }

        return [
          groupName,
          tools.filter((tool) => toolSearchText(tool).includes(normalizedToolSearch)),
        ] as const;
      })
      .filter(([, tools]) => tools.length > 0);
    const visibleToolCount = visibleGroupedToolDefinitions.reduce(
      (total, [, tools]) => total + tools.length,
      0
    );
    const linkedAgentLabel =
      selectedGraphToolNodeAgent?.name || selectedGraphToolNodeAgentId || 'linked agent';

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-orange-950 dark:text-orange-100">
            {isToolNodeDrawer
              ? selectedGraphToolNodeAgent
                ? `${linkedAgentLabel} tools`
                : 'Unlinked tool node'
              : selectedToolIds.length > 0
                ? `${selectedToolIds.length} workflow tools`
                : 'No workflow tools linked'}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-slate-300">
            {isToolNodeDrawer
              ? selectedGraphToolNodeAgent
                ? `Select the tools this node grants to ${linkedAgentLabel}.`
                : 'Connect this tool node to one agent before assigning tools.'
              : 'Manage tool access here. Grant or remove each tool from agents without opening the agent drawer.'}
          </p>
        </div>

        <section
          aria-label="Equipped tools"
          className="workflow-drawer-fieldset space-y-3 rounded-xl border border-orange-300/80 bg-orange-50/80 p-3 shadow-sm dark:border-orange-300/25 dark:bg-orange-500/12"
        >
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-800 dark:text-orange-100">
              Equipped tools
            </Label>
            <Badge variant="secondary">{selectedToolIds.length}</Badge>
          </div>
          {equippedToolDefinitions.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-slate-300">
              No tools are equipped on this node.
            </p>
          ) : (
            <div className="space-y-2">
              {equippedToolDefinitions.map(({ id, tool }) => (
                <div
                  key={id}
                  className="rounded-lg border border-orange-200/80 bg-white/90 px-3 py-2.5 dark:border-orange-300/15 dark:bg-slate-950/70"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-950 dark:text-slate-100">
                      {tool ? toolDisplayName(tool) : id}
                    </span>
                    {tool?.tool_type ? (
                      <Badge variant="outline">{readableToolGroupName(tool.tool_type)}</Badge>
                    ) : null}
                  </div>
                  {tool?.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600 dark:text-slate-300">
                      {tool.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {isEditing ? (
          <div className="workflow-drawer-fieldset space-y-3 rounded-xl border border-orange-200 bg-orange-50/45 p-3 dark:border-orange-400/20 dark:bg-orange-500/10">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-medium uppercase tracking-[0.12em] text-orange-700 dark:text-orange-200">
                Available tools
              </Label>
              <Badge variant="outline">
                {visibleToolCount === sortedToolDefinitions.length
                  ? `${sortedToolDefinitions.length} available`
                  : `${visibleToolCount} of ${sortedToolDefinitions.length}`}
              </Badge>
            </div>
            <Input
              value={toolDrawerSearch}
              onChange={(event) => setToolDrawerSearch(event.target.value)}
              placeholder="Search tool or group"
              aria-label="Search tools"
            />

            {sortedToolDefinitions.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No tools are available.
              </p>
            ) : visibleGroupedToolDefinitions.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No tools match this search.
              </p>
            ) : (
              <Accordion
                type="multiple"
                defaultValue={visibleGroupedToolDefinitions.map(([groupName]) => groupName)}
                className="max-h-128 space-y-2 overflow-y-auto pr-1"
              >
                {visibleGroupedToolDefinitions.map(([groupName, tools]) => {
                  return (
                    <AccordionItem
                      key={groupName}
                      value={groupName}
                      className="workflow-drawer-fieldset rounded-xl border border-orange-200/60 bg-orange-50/55 px-3 dark:border-orange-300/16 dark:bg-orange-500/10"
                    >
                      <AccordionTrigger className="py-3 text-left hover:no-underline">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold capitalize text-neutral-900 dark:text-slate-100">
                            {readableToolGroupName(groupName)}
                          </span>
                          <Badge variant="secondary">
                            {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
                          </Badge>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="space-y-2 pb-3">
                        {tools.map((tool) => {
                          const assignedAgentIds = assignedAgentIdsForTool(tool.id);
                          const assignedAgentIdSet = new Set(assignedAgentIds);
                          const selected = selectedToolIdSet.has(tool.id);
                          const binding = firstConnectorBinding(tool);
                          const bindingProvider =
                            binding?.provider ??
                            connectorProviderHintForTool(tool, connectorCapabilities);
                          const hasConnectorSignal = toolHasConnectorSignal(tool);
                          const isHttpRequestTool = tool.id === 'agency.http.request';
                          const runtimeParameters =
                            selectedGraphToolNodeAgent && selected
                              ? runtimeParametersForTool(selectedGraphToolNodeAgent, tool.id)
                              : {};
                          const hasRuntimeParameters = Object.keys(runtimeParameters).length > 0;
                          const httpRequestSetupMode =
                            httpRequestSetupModeByToolId[tool.id] ??
                            (binding ? 'binding' : hasRuntimeParameters ? 'parameters' : 'binding');
                          const bindingProviderCredentialCount = bindingProvider
                            ? connectorCredentials.filter(
                                (credential) => credential.provider === bindingProvider
                              ).length
                            : 0;
                          return (
                            <div
                              key={tool.id}
                              className="workflow-drawer-fieldset space-y-3 rounded-xl border border-orange-200/55 bg-orange-50/50 p-3 dark:border-orange-300/14 dark:bg-orange-500/10"
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                                    {toolDisplayName(tool)}
                                  </span>
                                  {selected ? <Badge variant="secondary">In node</Badge> : null}
                                  {recommendedToolIds.has(tool.id) ? (
                                    <Badge variant="outline">Recommended</Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-slate-400">
                                  {tool.description || tool.id}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {selectedGraphToolNodeId ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    aria-label={
                                      selectedGraphToolNodeAgent
                                        ? `${selected ? 'Remove access from' : 'Add to'} ${linkedAgentLabel}`
                                        : 'Connect to an agent'
                                    }
                                    disabled={!isEditing || !selectedGraphToolNodeAgent}
                                    className={
                                      selected
                                        ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                                    }
                                    onClick={() => toggleToolNodeTool(tool.id)}
                                  >
                                    {selectedGraphToolNodeAgent
                                      ? selected
                                        ? 'Remove access'
                                        : 'Add tool'
                                      : 'Connect to an agent'}
                                  </Button>
                                ) : visibleAgentDefinitions.length === 0 ? (
                                  <span className="text-xs text-neutral-500 dark:text-slate-400">
                                    Add an agent before assigning tools.
                                  </span>
                                ) : (
                                  visibleAgentDefinitions.map((agent, agentIndex) => {
                                    const hasAccess = assignedAgentIdSet.has(agent.id);
                                    return (
                                      <Button
                                        key={`${tool.id}-${agent.id}`}
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={!isEditing}
                                        className={
                                          hasAccess
                                            ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100'
                                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
                                        }
                                        onClick={() =>
                                          toggleAgentToolAccess(agent, agentIndex, tool.id)
                                        }
                                      >
                                        {hasAccess ? 'Remove access from' : 'Add to'}{' '}
                                        {agent.name || agent.id}
                                      </Button>
                                    );
                                  })
                                )}
                              </div>

                              {isHttpRequestTool && selected && selectedGraphToolNodeAgent ? (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      httpRequestSetupMode === 'binding' ? 'default' : 'outline'
                                    }
                                    disabled={!isEditing}
                                    onClick={() =>
                                      setHttpRequestSetupModeByToolId((current) => ({
                                        ...current,
                                        [tool.id]: 'binding',
                                      }))
                                    }
                                  >
                                    Use webhook credentials
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      httpRequestSetupMode === 'parameters' ? 'default' : 'outline'
                                    }
                                    disabled={!isEditing}
                                    onClick={() =>
                                      setHttpRequestSetupModeByToolId((current) => ({
                                        ...current,
                                        [tool.id]: 'parameters',
                                      }))
                                    }
                                  >
                                    Fill tool parameters
                                  </Button>
                                </div>
                              ) : null}

                              {(bindingProvider || isHttpRequestTool || binding) &&
                              (!isHttpRequestTool || httpRequestSetupMode === 'binding') ? (
                                <form
                                  className="space-y-2 rounded-md border border-orange-200/50 bg-white/90 p-3 dark:border-orange-300/14 dark:bg-slate-950/76"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    try {
                                      saveToolConnectorBinding(tool, event.currentTarget);
                                      toast.success('Connector binding saved.', {
                                        position: 'top-right',
                                      });
                                    } catch (error) {
                                      toast.error(
                                        error instanceof Error
                                          ? error.message
                                          : 'Failed to save connector binding.',
                                        { position: 'top-right' }
                                      );
                                    }
                                  }}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-slate-400">
                                        Tool connector binding
                                      </p>
                                      <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                                        Select the credential and target fields used by{' '}
                                        {toolDisplayName(tool)}.
                                      </p>
                                    </div>
                                    {binding ? (
                                      <Badge variant="outline">
                                        {binding.provider} / {binding.credential_id}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <ConnectorBindingFields
                                    key={`${tool.id}-${bindingProvider || 'provider-select'}`}
                                    binding={binding}
                                    defaultProvider={bindingProvider}
                                    connectorCredentials={connectorCredentials}
                                    connectorCapabilities={connectorCapabilities}
                                    isEditing={isEditing}
                                    purposePlaceholder="release_automation"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="submit"
                                      size="sm"
                                      disabled={
                                        !isEditing ||
                                        (!bindingProvider && !isHttpRequestTool && !binding) ||
                                        (bindingProvider
                                          ? bindingProviderCredentialCount === 0
                                          : false)
                                      }
                                    >
                                      Save binding
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={!isEditing || !binding}
                                      onClick={(event) => {
                                        const form = event.currentTarget.form;
                                        if (!form) return;
                                        saveToolConnectorBinding(tool, form, true);
                                        toast.success('Connector binding removed.', {
                                          position: 'top-right',
                                        });
                                      }}
                                    >
                                      Clear
                                    </Button>
                                  </div>
                                </form>
                              ) : hasConnectorSignal ? (
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-100">
                                  This connector tool needs a configured provider before credentials
                                  and delivery targets can be assigned.
                                </div>
                              ) : null}

                              {selected &&
                              selectedGraphToolNodeAgent &&
                              selectedGraphToolNodeId &&
                              isHttpRequestTool &&
                              httpRequestSetupMode === 'binding' ? (
                                <ToolParameterEditor
                                  key={`${selectedGraphToolNodeAgent.id}-${tool.id}-runtime-only`}
                                  tool={tool}
                                  agent={selectedGraphToolNodeAgent}
                                  isEditing={isEditing}
                                  mode="runtime-only"
                                  onSave={() => undefined}
                                  onClear={() => undefined}
                                />
                              ) : null}

                              {selected &&
                              selectedGraphToolNodeAgent &&
                              selectedGraphToolNodeId &&
                              (!isHttpRequestTool || httpRequestSetupMode === 'parameters') ? (
                                <ToolParameterEditor
                                  key={`${selectedGraphToolNodeAgent.id}-${tool.id}-${JSON.stringify(
                                    runtimeParameters
                                  )}`}
                                  tool={tool}
                                  agent={selectedGraphToolNodeAgent}
                                  isEditing={isEditing}
                                  onSave={(parameters) => {
                                    saveToolParametersForAgent(
                                      selectedGraphToolNodeAgent.id,
                                      tool,
                                      parameters
                                    );
                                    if (isHttpRequestTool) {
                                      setHttpRequestSetupModeByToolId((current) => ({
                                        ...current,
                                        [tool.id]: 'parameters',
                                      }));
                                    }
                                    toast.success('Tool parameters saved.', {
                                      position: 'top-right',
                                    });
                                  }}
                                  onClear={() => {
                                    clearToolParametersForAgent(
                                      selectedGraphToolNodeAgent.id,
                                      tool.id
                                    );
                                    toast.success('Tool parameters cleared.', {
                                      position: 'top-right',
                                    });
                                  }}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        ) : null}

        {!isEditing ? (
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            Switch to edit mode to modify tool access.
          </p>
        ) : null}
      </div>
    );
  };

  const renderSelectedMemoryPanel = () => {
    if (!selectedGraphMemory || !selectedGraphMemoryId) {
      return null;
    }

    const selectedGraphMemoryMetadata = selectedGraphMemory.metadata ?? {};
    const selectedGraphCatalogRefType = isMemoryCatalogRefType(
      selectedGraphMemoryMetadata.catalog_ref_type
    )
      ? selectedGraphMemoryMetadata.catalog_ref_type
      : null;
    const selectedGraphCatalogRefId =
      typeof selectedGraphMemoryMetadata.catalog_ref_id === 'string'
        ? selectedGraphMemoryMetadata.catalog_ref_id
        : null;
    const selectedGraphCatalogKey =
      selectedGraphCatalogRefType && selectedGraphCatalogRefId
        ? `${selectedGraphCatalogRefType}:${selectedGraphCatalogRefId}`
        : null;
    const selectedMemoryBackendLinks =
      selectedGraphCatalogRefType && selectedGraphCatalogRefId
        ? (workflowMemoryLinksQuery.data?.items ?? []).filter(
            (link) =>
              link.refType === selectedGraphCatalogRefType &&
              link.refId === selectedGraphCatalogRefId
          )
        : [];
    const selectedMemoryLinkedTargetKeys = new Set(
      selectedMemoryBackendLinks.map((link) =>
        workflowMemoryLinkTargetValue(link.targetType, link.targetId)
      )
    );
    const memoryAccessAgentDefinitions = Array.from(
      new Map(
        [
          ...(workflow?.agent_definitions ?? []),
          ...(resolvedWorkflowPreview.agent_definitions ?? []),
          ...agentDefinitions,
        ].map((agent) => [agent.id, agent])
      ).values()
    );
    const memoryAccessTaskDefinitions = Array.from(
      new Map(
        [
          ...(workflow?.task_definitions ?? []),
          ...(resolvedWorkflowPreview.task_definitions ?? []),
          ...taskDefinitions,
        ].map((task) => [task.id, task])
      ).values()
    );
    const memoryAccessTargetOptions = [
      {
        key: workflowMemoryLinkTargetValue('workflow'),
        targetType: 'workflow' as const,
        targetId: null,
        label: resolvedWorkflowPreview.name || workflowId,
        detail: 'Workflow default context',
      },
      ...memoryAccessAgentDefinitions.map((agent) => ({
        key: workflowMemoryLinkTargetValue('agent', agent.id),
        targetType: 'agent' as const,
        targetId: agent.id,
        label: agent.name || agent.id,
        detail: 'Agent context',
      })),
      ...memoryAccessTaskDefinitions.map((task) => ({
        key: workflowMemoryLinkTargetValue('task', task.id),
        targetType: 'task' as const,
        targetId: task.id,
        label: task.name || task.id,
        detail: 'Task context',
      })),
    ];
    const unlinkedMemoryAccessTargets = memoryAccessTargetOptions.filter(
      (target) => !selectedMemoryLinkedTargetKeys.has(target.key)
    );
    const memoryAccessTargetLabel = (
      targetType: WorkflowMemoryLinkTargetType,
      targetId?: string | null
    ) => {
      if (targetType === 'workflow') {
        return resolvedWorkflowPreview.name || workflowId;
      }
      if (targetType === 'agent') {
        return (
          memoryAccessAgentDefinitions.find((agent) => agent.id === targetId)?.name ||
          targetId ||
          'Unknown agent'
        );
      }
      if (targetType === 'task') {
        return (
          memoryAccessTaskDefinitions.find((task) => task.id === targetId)?.name ||
          targetId ||
          'Unknown task'
        );
      }
      return targetId || targetType;
    };
    const catalogItems = (memoryCatalogQuery.data?.groups ?? []).flatMap((group) =>
      group.items.map((item) => ({
        groupKey: group.key,
        groupLabel: group.label,
        item,
      }))
    );
    const visibleCatalogItems = catalogItems.filter(({ groupKey, item }) =>
      memoryCatalogItemMatchesTab(item, groupKey, selectedMemoryTypeTab)
    );
    const memoryTypeTabCounts = new Map<MemoryTypeTabId, number>(
      MEMORY_TYPE_TABS.map((tab) => [
        tab.id,
        catalogItems.filter(({ groupKey, item }) =>
          memoryCatalogItemMatchesTab(item, groupKey, tab.id)
        ).length,
      ])
    );
    const selectedMemoryTypeTabDefinition =
      MEMORY_TYPE_TABS.find((tab) => tab.id === selectedMemoryTypeTab) ?? MEMORY_TYPE_TABS[0];
    const applyCatalogItemToSelectedMemoryNode = (item: MemoryCatalogItem) => {
      if (!isEditing) {
        return;
      }

      applyWorkflowDefinition({
        ...resolvedWorkflowPreview,
        memory_definitions: workflowMemoryDefinitions.map((memory) =>
          memory.id === selectedGraphMemoryId
            ? {
                ...memory,
                name: item.label || memory.name,
                description: item.summary || item.preview || memory.description || '',
                memory_type: item.memoryType || memory.memory_type || 'workflow',
                scope: item.scope || memory.scope || 'workflow',
                metadata: {
                  ...(memory.metadata ?? {}),
                  ...memoryCatalogNodeMetadata(item),
                },
              }
            : memory
        ),
      });
    };
    const applyUploadedDocumentToSelectedMemoryNode = async (result: {
      document_id: string;
      filename: string;
      chunks_created: number;
    }) => {
      applyWorkflowDefinition({
        ...resolvedWorkflowPreview,
        memory_definitions: workflowMemoryDefinitions.map((memory) =>
          memory.id === selectedGraphMemoryId
            ? {
                ...memory,
                name: result.filename || memory.name,
                description: `${result.chunks_created} memory chunk${
                  result.chunks_created === 1 ? '' : 's'
                } uploaded from ${result.filename}.`,
                memory_type: 'archive',
                scope: memory.scope || 'workflow',
                metadata: {
                  ...(memory.metadata ?? {}),
                  catalog_ref_type: 'memory_collection',
                  catalog_ref_id: result.document_id,
                  catalog_memory_type: 'archive',
                  catalog_embedded: true,
                  catalog_document_id: result.document_id,
                  catalog_filename: result.filename,
                },
              }
            : memory
        ),
      });
      await Promise.all([workflowMemoriesQuery.refetch(), memoryCatalogQuery.refetch()]);
    };

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-teal-950 dark:text-teal-100">Memory List</h3>
          <p className="text-sm text-neutral-500 dark:text-slate-300">
            Select a memory for this node. Filter by memory type to find the right context faster.
          </p>
        </div>

        <div className="space-y-3 rounded-md border border-teal-200 bg-teal-50/45 p-3 dark:border-teal-300/20 dark:bg-teal-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label className="text-xs font-medium uppercase tracking-[0.12em] text-teal-700 dark:text-teal-200">
              Current Selection
            </Label>
            <Badge variant="outline">{catalogItems.length} available</Badge>
          </div>
          <div className="rounded-md border border-teal-200/50 bg-white/90 px-3 py-2 dark:border-teal-300/14 dark:bg-slate-950/76">
            <div className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
              {memoryDisplayName(selectedGraphMemory)}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500 dark:text-slate-400">
              {selectedGraphMemory.description || 'Choose a catalog memory below.'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-medium uppercase tracking-[0.12em] text-teal-700 dark:text-teal-200">
                Memory List
              </Label>
              {memoryCatalogQuery.isFetching ? (
                <span className="text-xs text-neutral-500 dark:text-slate-400">Refreshing...</span>
              ) : null}
            </div>
            {memoryCatalogQuery.isLoading ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                Loading linkable memories...
              </p>
            ) : catalogItems.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                No memories are available for this workflow.
              </p>
            ) : (
              <Tabs
                value={selectedMemoryTypeTab}
                onValueChange={(value) => setSelectedMemoryTypeTab(value as MemoryTypeTabId)}
              >
                <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-white p-1 dark:bg-slate-950/78">
                  <TooltipProvider delayDuration={150}>
                    {MEMORY_TYPE_TABS.map((tab) => {
                      const count = memoryTypeTabCounts.get(tab.id) ?? 0;
                      return (
                        <Tooltip key={tab.id}>
                          <TooltipTrigger asChild>
                            <TabsTrigger
                              value={tab.id}
                              className="gap-1.5 text-xs"
                              aria-label={`${tab.label} ${count}`}
                              title={tab.description}
                            >
                              {tab.label}
                              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                                {count}
                              </span>
                            </TabsTrigger>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64 text-xs leading-5">
                            {tab.description}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TooltipProvider>
                </TabsList>
                <p className="mt-2 text-xs text-neutral-500">
                  {selectedMemoryTypeTabDefinition.description}
                </p>
                <div className="mt-3 max-h-128 overflow-y-auto pr-1">
                  {visibleCatalogItems.length === 0 ? (
                    <p className="rounded-md border border-teal-200/50 bg-white/90 p-3 text-sm text-neutral-500 dark:border-teal-300/14 dark:bg-slate-950/76 dark:text-slate-400">
                      No {selectedMemoryTypeTabDefinition.label.toLowerCase()} memories are
                      available for this workflow.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {visibleCatalogItems.map(({ groupLabel, item }) => {
                        const catalogKey = memoryCatalogItemKey(item);
                        const isSelectedSource = selectedGraphCatalogKey === catalogKey;
                        return (
                          <div
                            key={catalogKey}
                            className="space-y-3 rounded-md border border-teal-200/50 bg-white/90 p-3 shadow-sm dark:border-teal-300/14 dark:bg-slate-950/76 dark:shadow-none"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium text-neutral-900">
                                  {item.label}
                                </span>
                                <Badge variant="secondary">{groupLabel}</Badge>
                                {item.memoryType ? (
                                  <Badge variant="outline">
                                    {memoryTypeLabel(item.memoryType)}
                                  </Badge>
                                ) : null}
                                {item.sensitive ? (
                                  <Badge variant="destructive">Sensitive</Badge>
                                ) : null}
                                {isSelectedSource ? (
                                  <Badge variant="secondary">Selected</Badge>
                                ) : null}
                              </div>
                              <p className="line-clamp-2 text-xs leading-5 text-neutral-500">
                                {item.summary || item.preview}
                              </p>
                              <div className="flex flex-wrap gap-1 text-xs text-neutral-500">
                                {item.blockedReason || item.exclusionReason ? (
                                  <span>{item.blockedReason || item.exclusionReason}</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!isEditing || isSelectedSource || !item.canLink}
                                onClick={() => applyCatalogItemToSelectedMemoryNode(item)}
                              >
                                {isSelectedSource ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Tabs>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-teal-200 bg-teal-50/45 p-3 dark:border-teal-300/20 dark:bg-teal-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label className="text-xs font-medium uppercase tracking-[0.12em] text-teal-700 dark:text-teal-200">
                Access Targets
              </Label>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                Grant this selected memory to the workflow, agents, or tasks from the Memory node.
              </p>
            </div>
            <Badge variant="outline">{selectedMemoryBackendLinks.length} linked</Badge>
          </div>

          {!selectedGraphCatalogRefType || !selectedGraphCatalogRefId ? (
            <p className="rounded-md border border-teal-200/50 bg-white/90 p-3 text-sm text-neutral-500 dark:border-teal-300/14 dark:bg-slate-950/76 dark:text-slate-400">
              Select a memory source above before assigning access targets.
            </p>
          ) : workflowMemoryLinksQuery.isLoading ? (
            <p className="text-sm text-neutral-500 dark:text-slate-400">
              Loading access targets...
            </p>
          ) : (
            <div className="space-y-3">
              {selectedMemoryBackendLinks.length > 0 ? (
                <div className="space-y-2">
                  {selectedMemoryBackendLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-teal-200/50 bg-white/90 px-3 py-2 dark:border-teal-300/14 dark:bg-slate-950/76"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-sm font-medium text-neutral-900 dark:text-slate-100">
                          {memoryAccessTargetLabel(link.targetType, link.targetId)}
                        </div>
                        <div className="flex flex-wrap gap-1 text-xs text-neutral-500 dark:text-slate-400">
                          <Badge variant="secondary">{readableMemoryValue(link.targetType)}</Badge>
                          <Badge variant="outline">{readableMemoryValue(link.accessMode)}</Badge>
                          <span>{link.memoryIds.length} records</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isEditing || deleteWorkflowMemoryLinkMutation.isPending}
                        onClick={() => deleteWorkflowMemoryLinkMutation.mutate(link.id)}
                      >
                        Remove access
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-slate-400">
                  This memory is selected for the node but has no backend access targets yet.
                </p>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.12em] text-teal-700 dark:text-teal-200">
                  Add Access
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {unlinkedMemoryAccessTargets.map((target) => (
                    <button
                      key={target.key}
                      type="button"
                      className="rounded-md border border-teal-200/60 bg-white/90 px-3 py-2 text-left text-sm transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-300/14 dark:bg-slate-950/76 dark:text-slate-100 dark:hover:bg-teal-500/10"
                      disabled={!isEditing || addWorkflowMemoryLinkMutation.isPending}
                      onClick={() =>
                        addWorkflowMemoryLinkMutation.mutate({
                          targetType: target.targetType,
                          targetId: target.targetId,
                          refType: selectedGraphCatalogRefType,
                          refId: selectedGraphCatalogRefId,
                        })
                      }
                    >
                      <span className="block truncate font-medium">{target.label}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500 dark:text-slate-400">
                        {target.detail}
                      </span>
                    </button>
                  ))}
                  {unlinkedMemoryAccessTargets.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-slate-400">
                      All workflow, agent, and task targets already have access.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>

        {isEditing ? (
          <DocumentIngestionControl
            compact
            frame="inline"
            title="Upload file"
            description="Upload a file into memory for use through this node."
            scope="workflow"
            lockedScope
            purpose="workflow"
            workflowId={workflowId}
            workflows={workflowDocumentOptions}
            defaultTags={[
              'document',
              'memory-rag',
              `workflow:${workflowId}`,
              `memory:${selectedGraphMemoryId}`,
            ]}
            onIngested={applyUploadedDocumentToSelectedMemoryNode}
          />
        ) : null}

        {!isEditing ? (
          <p className="text-xs text-neutral-500">Switch to edit mode to select a memory.</p>
        ) : null}
      </div>
    );
  };

  const renderSelectedArtifactPanel = () => {
    if (!selectedGraphArtifact || !selectedGraphArtifactId) {
      return null;
    }

    const updateSelectedArtifact = (updates: Partial<WorkflowArtifactDefinition>) => {
      if (!isEditing) {
        return;
      }

      applyWorkflowDefinition({
        ...resolvedWorkflowPreview,
        metadata: {
          ...(resolvedWorkflowPreview.metadata ?? {}),
          [workflowArtifactDefinitionsMetadataKey]: workflowArtifactDefinitions.map((artifact) =>
            artifact.id === selectedGraphArtifactId ? { ...artifact, ...updates } : artifact
          ),
        },
      });
    };

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-amber-950 dark:text-amber-100">
            Artifact Output
          </h3>
          <p className="text-sm text-neutral-500 dark:text-slate-300">
            Define the durable output this workflow should produce and optionally link it to the
            task that creates it.
          </p>
        </div>

        <div className="space-y-4 rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-300/20 dark:bg-amber-500/10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{selectedGraphArtifact.artifact_type || 'output'}</Badge>
            {selectedGraphArtifact.media_type ? (
              <Badge variant="secondary">{selectedGraphArtifact.media_type}</Badge>
            ) : null}
            {selectedGraphArtifact.producer_task_id ? (
              <Badge variant="secondary">
                Produced by{' '}
                {taskMap.get(selectedGraphArtifact.producer_task_id)?.name ||
                  selectedGraphArtifact.producer_task_id}
              </Badge>
            ) : (
              <Badge variant="outline">No producer task</Badge>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`workflow-artifact-name-${selectedGraphArtifactId}`}>Name</Label>
              <Input
                id={`workflow-artifact-name-${selectedGraphArtifactId}`}
                value={selectedGraphArtifact.name}
                disabled={!isEditing}
                onChange={(event) => updateSelectedArtifact({ name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`workflow-artifact-type-${selectedGraphArtifactId}`}>Type</Label>
              <Input
                id={`workflow-artifact-type-${selectedGraphArtifactId}`}
                value={selectedGraphArtifact.artifact_type ?? ''}
                placeholder="output"
                disabled={!isEditing}
                onChange={(event) =>
                  updateSelectedArtifact({ artifact_type: event.target.value.trim() || null })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`workflow-artifact-description-${selectedGraphArtifactId}`}>
              Description
            </Label>
            <Textarea
              id={`workflow-artifact-description-${selectedGraphArtifactId}`}
              value={selectedGraphArtifact.description ?? ''}
              disabled={!isEditing}
              rows={3}
              onChange={(event) => updateSelectedArtifact({ description: event.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`workflow-artifact-media-${selectedGraphArtifactId}`}>
                Media Type
              </Label>
              <Input
                id={`workflow-artifact-media-${selectedGraphArtifactId}`}
                value={selectedGraphArtifact.media_type ?? ''}
                placeholder="text/markdown"
                disabled={!isEditing}
                onChange={(event) =>
                  updateSelectedArtifact({ media_type: event.target.value.trim() || null })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`workflow-artifact-producer-${selectedGraphArtifactId}`}>
                Producer Task
              </Label>
              <select
                id={`workflow-artifact-producer-${selectedGraphArtifactId}`}
                value={selectedGraphArtifact.producer_task_id ?? ''}
                disabled={!isEditing}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950 dark:text-slate-100"
                onChange={(event) =>
                  updateSelectedArtifact({ producer_task_id: event.target.value || null })
                }
              >
                <option value="">No producer task</option>
                {visibleTaskDefinitions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name || task.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!isEditing ? (
          <p className="text-xs text-neutral-500">Switch to edit mode to modify this artifact.</p>
        ) : null}
      </div>
    );
  };

  const renderSelectedEdgePanel = () => {
    if (!selectedGraphEdge) {
      return null;
    }

    const sourceTaskId =
      readGraphEdgeDataString(selectedGraphEdge, 'sourceTaskId') ??
      selectedGraphEdgeRef?.sourceTaskId ??
      null;
    const targetTaskId =
      readGraphEdgeDataString(selectedGraphEdge, 'targetTaskId') ??
      selectedGraphEdgeRef?.targetTaskId ??
      null;
    const assignmentAgentId =
      readGraphEdgeDataString(selectedGraphEdge, 'agentId') ??
      selectedGraphEdgeRef?.agentId ??
      null;
    const assignmentTaskId =
      readGraphEdgeDataString(selectedGraphEdge, 'taskId') ?? selectedGraphEdgeRef?.taskId ?? null;
    const toolAccessToolId =
      readGraphEdgeDataString(selectedGraphEdge, 'toolId') ?? selectedGraphEdgeRef?.toolId ?? null;
    const toolAccessToolIds = [
      ...readGraphEdgeDataStringArray(selectedGraphEdge, 'toolIds'),
      ...(selectedGraphEdgeRef?.toolIds ?? []),
      ...(toolAccessToolId ? [toolAccessToolId] : []),
    ].filter((toolId, index, toolIds) => toolIds.indexOf(toolId) === index);
    const memoryAccessMemoryId =
      readGraphEdgeDataString(selectedGraphEdge, 'memoryId') ??
      selectedGraphEdgeRef?.memoryId ??
      null;
    const sourceTask = sourceTaskId ? taskMap.get(sourceTaskId) : null;
    const targetTask = targetTaskId ? taskMap.get(targetTaskId) : null;
    const assignmentAgent = assignmentAgentId ? agentMap.get(assignmentAgentId) : null;
    const assignmentTask = assignmentTaskId ? taskMap.get(assignmentTaskId) : null;
    const toolAccessTool = toolAccessToolId ? toolMap.get(toolAccessToolId) : null;
    const memoryAccessMemory = memoryAccessMemoryId ? memoryMap.get(memoryAccessMemoryId) : null;
    const taskEdgeKey = sourceTaskId && targetTaskId ? `${sourceTaskId}->${targetTaskId}` : null;
    const edgeMetadata = taskEdgeKey ? edgeMetadataByTaskPair[taskEdgeKey] : null;
    const edgeType =
      edgeMetadata?.edgeType ||
      readGraphEdgeDataString(selectedGraphEdge, 'edgeType') ||
      (selectedGraphEdge.type === workflowGraphEdgeTypes.condition ? 'conditional' : 'default');
    const condition = edgeMetadata?.condition || selectedGraphEdge.label || '';
    const metadataJson =
      edgeMetadata?.metadataJson ||
      (selectedGraphEdge.metadata ? JSON.stringify(selectedGraphEdge.metadata, null, 2) : '');
    const conditionError = taskEdgeKey ? invalidEdgeConditionByTaskPair[taskEdgeKey] : undefined;
    const metadataError = taskEdgeKey ? invalidEdgeMetadataByTaskPair[taskEdgeKey] : undefined;
    const memoryAccessAccess =
      readGraphEdgeDataString(selectedGraphEdge, 'access') ??
      (typeof selectedGraphEdge.metadata?.access === 'string'
        ? selectedGraphEdge.metadata.access
        : null);
    const isTaskDependencyEdge = Boolean(sourceTaskId && targetTaskId);
    const isAssignmentEdge = selectedGraphEdge.type === workflowGraphEdgeTypes.assignment;
    const isToolEdge = selectedGraphEdge.type === workflowGraphEdgeTypes.tool;
    const isMemoryEdge = selectedGraphEdge.type === workflowGraphEdgeTypes.memory;
    const editable = Boolean(isEditing && isTaskDependencyEdge);
    const assignmentTaskIndex = assignmentTaskId
      ? visibleTaskDefinitions.findIndex((task) => task.id === assignmentTaskId)
      : -1;
    const assignmentEditable = Boolean(isEditing && isAssignmentEdge && assignmentTaskIndex >= 0);
    const toolAccessAgentIndex = assignmentAgentId
      ? visibleAgentDefinitions.findIndex((agent) => agent.id === assignmentAgentId)
      : -1;
    const toolAccessEditable = Boolean(
      isEditing && isToolEdge && toolAccessAgentIndex >= 0 && toolAccessToolIds.length > 0
    );
    const memoryAccessAgentIndex = assignmentAgentId
      ? visibleAgentDefinitions.findIndex((agent) => agent.id === assignmentAgentId)
      : -1;
    const memoryAccessTaskIndex = assignmentTaskId
      ? visibleTaskDefinitions.findIndex((task) => task.id === assignmentTaskId)
      : -1;
    const memoryAccessEditable = Boolean(
      isEditing &&
      isMemoryEdge &&
      memoryAccessMemoryId &&
      (memoryAccessAgentIndex >= 0 || memoryAccessTaskIndex >= 0)
    );
    const edgeBadgeLabel = isAssignmentEdge
      ? 'Assignment'
      : isToolEdge
        ? 'Tool access'
        : isMemoryEdge
          ? 'Memory access'
          : edgeType === 'conditional'
            ? 'Conditional'
            : edgeType === 'success'
              ? 'Success'
              : edgeType === 'failure'
                ? 'Failure'
                : 'Dependency';
    const edgeDescription = isAssignmentEdge
      ? 'This connection controls which agent is assigned to execute the task.'
      : isToolEdge
        ? 'This connection gives the agent access to the linked tools.'
        : isMemoryEdge
          ? 'This connection gives the linked agent or task access to the memory.'
          : edgeType === 'conditional'
            ? 'This connection runs only when the condition evaluates to true.'
            : edgeType === 'success'
              ? 'This connection represents the next task after a successful outcome.'
              : edgeType === 'failure'
                ? 'This connection represents the next task after a failed outcome.'
                : 'This connection controls task execution order. The target task waits for the source task.';

    const updateSelectedEdgeMetadata = (updates: Parameters<typeof updateEdgeMetadata>[2]) => {
      if (!sourceTaskId || !targetTaskId) {
        return;
      }

      updateEdgeMetadata(sourceTaskId, targetTaskId, updates);
    };
    const focusConditionInput = () => {
      window.setTimeout(() => {
        graphEdgeConditionInputRef.current?.focus();
        graphEdgeConditionInputRef.current?.select();
      }, 0);
    };
    const makeSelectedEdgeConditional = () => {
      updateSelectedEdgeMetadata({ edgeType: 'conditional' });
      focusConditionInput();
    };

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <Badge variant="outline">{edgeBadgeLabel}</Badge>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
            Selected connection
          </h3>
          <p className="text-sm text-neutral-500 dark:text-slate-300">
            {sourceTask && targetTask
              ? `${sourceTask.name} -> ${targetTask.name}`
              : assignmentAgent && assignmentTask
                ? `${assignmentAgent.name} -> ${assignmentTask.name}`
                : assignmentAgent && toolAccessToolIds.length > 0
                  ? `${toolAccessToolIds.length === 1 ? (toolAccessTool ? toolDisplayName(toolAccessTool) : toolAccessToolIds[0]) : `${toolAccessToolIds.length} tools`} -> ${assignmentAgent.name}`
                  : memoryAccessMemoryId && (assignmentAgent || assignmentTask)
                    ? `${memoryAccessMemory ? memoryDisplayName(memoryAccessMemory) : memoryAccessMemoryId} -> ${
                        assignmentAgent?.name || assignmentTask?.name
                      }`
                    : `${selectedGraphEdge.source} -> ${selectedGraphEdge.target}`}
          </p>
          <p className="text-sm text-neutral-500 dark:text-slate-300">{edgeDescription}</p>
        </div>

        {renderRuntimeEventPanel(selectedGraphEdgeRuntimeEvent)}

        {sourceTask && targetTask ? (
          <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-3 text-sm dark:border-slate-400/20 dark:bg-slate-400/10">
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500 dark:text-slate-400">From</span>
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {sourceTask.name}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500 dark:text-slate-400">To</span>
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {targetTask.name}
              </span>
            </div>
          </div>
        ) : assignmentAgent && assignmentTask ? (
          <div className="grid gap-2 rounded-md border border-agent-200 bg-agent-50/60 p-3 text-sm dark:border-agent-400/20 dark:bg-agent-500/10">
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500 dark:text-slate-400">Agent</span>
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {assignmentAgent.name}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500 dark:text-slate-400">Task</span>
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {assignmentTask.name}
              </span>
            </div>
          </div>
        ) : assignmentAgent && toolAccessToolIds.length > 0 ? (
          <div className="grid gap-2 rounded-md border border-orange-200 bg-orange-50/60 p-3 text-sm dark:border-orange-400/20 dark:bg-orange-500/10">
            {toolAccessToolIds.length === 1 ? (
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500 dark:text-slate-400">Tool</span>
                <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                  {toolAccessTool ? toolDisplayName(toolAccessTool) : toolAccessToolIds[0]}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-neutral-500 dark:text-slate-400">Tools</span>
                  <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                    {toolAccessToolIds.length} linked
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {toolAccessToolIds.map((toolId) => {
                    const tool = toolMap.get(toolId);
                    return (
                      <Badge key={toolId} variant="secondary">
                        {tool ? toolDisplayName(tool) : toolId}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500 dark:text-slate-400">Agent</span>
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {assignmentAgent.name}
              </span>
            </div>
          </div>
        ) : memoryAccessMemoryId && (assignmentAgent || assignmentTask) ? (
          <div className="grid gap-2 rounded-md border border-teal-200 bg-teal-50/60 p-3 text-sm dark:border-teal-300/20 dark:bg-teal-500/10">
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500 dark:text-slate-400">Memory</span>
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {memoryAccessMemory ? memoryDisplayName(memoryAccessMemory) : memoryAccessMemoryId}
              </span>
            </div>
            {assignmentAgent ? (
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500 dark:text-slate-400">Agent</span>
                <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                  {assignmentAgent.name}
                </span>
              </div>
            ) : null}
            {assignmentTask ? (
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500 dark:text-slate-400">Task</span>
                <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                  {assignmentTask.name}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <span className="text-neutral-500 dark:text-slate-400">Access</span>
              <span className="truncate font-medium text-neutral-900 dark:text-slate-100">
                {memoryAccessAccess || 'read_write'}
              </span>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3 text-sm text-neutral-500 dark:border-white/10 dark:bg-white/4 dark:text-slate-400">
            This connection is derived from agent or tool assignment data. Edit it through the
            related task or agent drawer.
          </p>
        )}

        {assignmentEditable ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`graph-assignment-agent-${selectedGraphEdge.id}`}>
                Assigned agent
              </Label>
              <select
                id={`graph-assignment-agent-${selectedGraphEdge.id}`}
                value={assignmentTask?.agent_id ?? noGraphEdgeAgentValue}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  updateTaskDefinition(assignmentTaskIndex, {
                    agent_id:
                      event.target.value === noGraphEdgeAgentValue ? null : event.target.value,
                  })
                }
              >
                <option value={noGraphEdgeAgentValue}>No agent</option>
                {visibleAgentDefinitions.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.id}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                A task can have one assigned agent. Changing this replaces the assignment edge.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={!assignmentTask?.agent_id}
              onClick={() => updateTaskDefinition(assignmentTaskIndex, { agent_id: null })}
            >
              Remove assignment
            </Button>
          </div>
        ) : toolAccessEditable ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Tool access is controlled by this Tool to Agent edge. Removing access only detaches
              the tool from this agent, and any orphaned connector binding is cleared when the tool
              is no longer referenced anywhere else.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                toolAccessToolIds.forEach((toolId) =>
                  revokeAgentToolAccess(
                    visibleAgentDefinitions[toolAccessAgentIndex],
                    toolAccessAgentIndex,
                    toolId
                  )
                );
                setSelectedGraphEdgeRef(null);
              }}
            >
              Remove tool access
            </Button>
          </div>
        ) : memoryAccessEditable ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Memory access is controlled by this Memory to Agent/Task edge.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (memoryAccessAgentIndex >= 0) {
                  const agent = visibleAgentDefinitions[memoryAccessAgentIndex];
                  updateAgentDefinition(memoryAccessAgentIndex, {
                    memory_ids: (agent.memory_ids ?? []).filter(
                      (memoryId) => memoryId !== memoryAccessMemoryId
                    ),
                  });
                }
                if (memoryAccessTaskIndex >= 0) {
                  const task = visibleTaskDefinitions[memoryAccessTaskIndex];
                  updateTaskDefinition(memoryAccessTaskIndex, {
                    memory_ids: (task.memory_ids ?? []).filter(
                      (memoryId) => memoryId !== memoryAccessMemoryId
                    ),
                  });
                }
                setSelectedGraphEdgeRef(null);
              }}
            >
              Remove memory access
            </Button>
          </div>
        ) : editable ? (
          <div className="space-y-4">
            {edgeType !== 'conditional' ? (
              <div className="rounded-md border border-violet-200 bg-violet-50/60 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-violet-950">Add a condition</p>
                    <p className="text-xs text-violet-700">
                      Convert this dependency into a conditional route and write the expression.
                    </p>
                  </div>
                  <Button type="button" size="sm" onClick={makeSelectedEdgeConditional}>
                    Make conditional
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor={`graph-edge-type-${selectedGraphEdge.id}`}>Edge Type</Label>
              <select
                id={`graph-edge-type-${selectedGraphEdge.id}`}
                value={edgeType}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(event) => {
                  updateSelectedEdgeMetadata({
                    edgeType: event.target.value,
                  });
                  if (event.target.value === 'conditional') {
                    focusConditionInput();
                  }
                }}
              >
                <option value="default">default</option>
                <option value="conditional">conditional</option>
                <option value="success">success</option>
                <option value="failure">failure</option>
              </select>
              <p className="text-xs text-neutral-500">
                Use `conditional` when this path should run only if the condition is true. Success
                and failure mark outcome-specific paths.
              </p>
            </div>

            {edgeType === 'conditional' ? (
              <div className="space-y-1.5 rounded-md border border-violet-200 bg-violet-50/70 p-3">
                <Label htmlFor={`graph-edge-condition-${selectedGraphEdge.id}`}>Condition</Label>
                <Input
                  ref={graphEdgeConditionInputRef}
                  id={`graph-edge-condition-${selectedGraphEdge.id}`}
                  value={condition}
                  className={conditionError ? 'border-red-500' : ''}
                  placeholder="e.g. task.output.status === 'approved'"
                  onChange={(event) =>
                    updateSelectedEdgeMetadata({
                      condition: event.target.value,
                    })
                  }
                />
                {conditionError ? (
                  <p className="text-xs text-red-600">Condition {conditionError}</p>
                ) : (
                  <div className="space-y-1 text-xs text-violet-700">
                    <p>This expression decides whether the target task is eligible to run.</p>
                    <p>
                      Examples: <code>{`task.output.status === 'approved'`}</code>,{' '}
                      <code>{`inputs.priority === 'high'`}</code>.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <WorkflowEdgeMetadataEditor
              idPrefix={`graph-edge-${selectedGraphEdge.id}`}
              metadataJson={metadataJson}
              metadataError={metadataError}
              onChange={(nextMetadataJson) =>
                updateSelectedEdgeMetadata({
                  metadataJson: nextMetadataJson,
                })
              }
            />
          </div>
        ) : !isEditing ? (
          <p className="text-xs text-neutral-500">Switch to edit mode to modify this connection.</p>
        ) : null}
      </div>
    );
  };

  const runConfigurationTriggerClass =
    'relative -mx-1 my-1 min-h-20 rounded-xl border border-transparent px-3 py-3 pr-12 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/55 hover:no-underline focus-visible:ring-2 focus-visible:ring-primary-300/45 data-[state=open]:border-primary-200 data-[state=open]:bg-primary-50/45 dark:hover:border-white/10 dark:hover:bg-white/4 dark:focus-visible:ring-sky-300/35 dark:data-[state=open]:border-white/10 dark:data-[state=open]:bg-white/4 [&>svg]:absolute [&>svg]:right-4 [&>svg]:top-1/2 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:-translate-y-1/2 [&>svg]:text-primary-700 dark:[&>svg]:text-sky-200';

  const renderConfigurationTrigger = (title: string, summary: string) => (
    <div className="flex min-w-0 flex-1 items-start gap-3 pr-1">
      <span
        className="mt-1 h-11 w-1.5 rounded-full bg-linear-to-b from-violet-500 to-sky-500 shadow-sm shadow-violet-100 dark:shadow-none"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1.5">
        <div className="text-lg font-semibold text-neutral-950 dark:text-slate-100">{title}</div>
        <p className="text-sm font-normal text-neutral-500 dark:text-slate-400">{summary}</p>
      </div>
    </div>
  );

  const renderRunConfigurationSections = () => (
    <>
      <WorkflowSchedulesPanel
        editable={isEditing}
        frame="inline"
        description={
          schedulesQuery.data?.length
            ? `${schedulesQuery.data.length} schedule${schedulesQuery.data.length === 1 ? '' : 's'} configured`
            : 'No schedule configured'
        }
        schedules={schedulesQuery.data ?? []}
        isLoading={schedulesQuery.isLoading}
        errorMessage={schedulesQuery.isError ? schedulesQuery.error.message : undefined}
        isMutating={
          createScheduleMutation.isPending ||
          toggleScheduleMutation.isPending ||
          triggerScheduleMutation.isPending ||
          updateScheduleMutation.isPending
        }
        onRefresh={() => {
          void schedulesQuery.refetch();
        }}
        onCreateSchedule={async (payload) => {
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          const promise = createScheduleMutation.mutateAsync({
            name: `${resolvedWorkflowPreview.name || 'Workflow'} schedule`,
            workflow_id: workflowId,
            enabled: true,
            max_concurrent_executions: 1,
            timezone: timeZone,
            ...payload,
          });
          void toast.promise(promise, {
            loading: 'Creating schedule...',
            success: 'Schedule created.',
            error: (error) =>
              error instanceof Error ? error.message : 'Failed to create schedule.',
            position: 'top-right',
          });
          await promise;
        }}
        onDeleteSchedule={(schedule) => {
          void toast.promise(deleteScheduleMutation.mutateAsync(schedule.id), {
            loading: 'Removing schedule...',
            success: 'Schedule removed.',
            error: (error) =>
              error instanceof Error ? error.message : 'Failed to remove schedule.',
            position: 'top-right',
          });
        }}
        onToggleSchedule={(schedule) => {
          void toast.promise(toggleScheduleMutation.mutateAsync(schedule.id), {
            loading: schedule.enabled ? 'Disabling schedule...' : 'Enabling schedule...',
            success: schedule.enabled ? 'Schedule disabled.' : 'Schedule enabled.',
            error: (error) =>
              error instanceof Error ? error.message : 'Failed to update schedule.',
            position: 'top-right',
          });
        }}
        onTriggerNow={(schedule) => {
          void toast.promise(triggerScheduleMutation.mutateAsync(schedule.id), {
            loading: 'Triggering schedule...',
            success: 'Schedule triggered.',
            error: (error) =>
              error instanceof Error ? error.message : 'Failed to trigger schedule.',
            position: 'top-right',
          });
        }}
        onUpdateSchedule={async (schedule, patch) => {
          const promise = updateScheduleMutation.mutateAsync({
            scheduleId: schedule.id,
            patch,
          });
          void toast.promise(promise, {
            loading: 'Saving schedule...',
            success: 'Schedule updated.',
            error: (error) =>
              error instanceof Error ? error.message : 'Failed to update schedule.',
            position: 'top-right',
          });
          await promise;
        }}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkflowRuntimeGovernanceControls
          editable={isEditing}
          frame="inline"
          governance={displayedRuntimeGovernance}
          isSaving={updateRuntimeGovernanceMutation.isPending}
          onGovernanceChange={handleRuntimeGovernanceChange}
        />
        <WorkflowMonitoringControls
          editable={isEditing}
          frame="inline"
          monitoring={displayedWorkflowMonitoring}
          agentOptions={workflowAgentOptions}
          taskOptions={workflowTaskOptions}
          isSaving={updateMonitoringMutation.isPending}
          exemptionReason={monitoringExemptionReason}
          onExemptionReasonChange={setMonitoringExemptionReason}
          onMonitoringEnabledChange={handleMonitoringEnabledChange}
          onExemptionReasonSave={handleExemptionReasonSave}
          onAllowSelfMonitoringChange={handleAllowSelfMonitoringChange}
          onMonitorControlChange={handleMonitorControlChange}
        />
      </div>

      <WorkflowObservabilitySummary
        agentMetrics={workflowAgentObservabilityMetrics}
        isLoading={workflowObservabilityLoading}
        modelUsage={workflowModelUsageQuery.data ?? null}
        workflowMetrics={workflowObservabilityMetricsQuery.data ?? null}
      />

      <div>
        <WorkflowMonitoringProposals
          editable
          frame="inline"
          events={monitoringEventsQuery.data ?? null}
          isLoading={monitoringEventsQuery.isLoading}
          isMutating={
            monitorApprovalMutation.isPending || dispatchMonitorProposalMutation.isPending
          }
          onEnableImprovementProposals={() =>
            handleMonitorControlChange('allow_improvement_proposals', true)
          }
          onSendToMainAgent={handleSendMonitorProposalToMainAgent}
          onApprovalDecision={handleMonitorApprovalDecision}
        />
      </div>

      <WorkflowGovernancePanel workflowId={workflowId} editable={isEditing} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <WorkflowSharedMemoryControls
          editable={isEditing}
          frame="inline"
          sharedMemory={sharedMemoryQuery.data ?? null}
          memories={workflowMemoriesQuery.data ?? []}
          isLoading={sharedMemoryQuery.isLoading || workflowMemoriesQuery.isLoading}
          isSaving={updateSharedMemoryMutation.isPending}
          onEnabledChange={handleSharedMemoryEnabledChange}
          onRefresh={() => {
            void Promise.all([sharedMemoryQuery.refetch(), workflowMemoriesQuery.refetch()]);
          }}
        />
        <div className="space-y-3">
          {isEditing ? (
            <DocumentIngestionControl
              frame="inline"
              title="Workflow documents"
              description="Upload source material for this workflow's future runs and shared retrieval."
              scope="workflow"
              lockedScope
              purpose="workflow"
              workflowId={workflowId}
              workflows={workflowDocumentOptions}
              agents={workflowAgentOptions}
              defaultTags={['workflow-rag', `workflow:${workflowId}`]}
              onIngested={async () => {
                await workflowMemoriesQuery.refetch();
              }}
            />
          ) : null}
          <UploadedDocumentsList
            scope="workflow"
            workflowId={workflowId}
            tagFilter={`workflow:${workflowId}`}
            title="Uploaded workflow documents"
            description="Files currently attached to this workflow's retrieval context."
            showActions={isEditing}
          />
        </div>
      </div>
    </>
  );

  const formatPreviewDate = (value?: string | null) => {
    if (!value) {
      return 'No next run';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const previewEntrypoint = labelForEntrypointTask(
    effectiveEntrypointTaskId,
    visibleTaskDefinitions
  );
  const previewRuntimeAdapter =
    selectedRunRuntimeAdapterId || preferredRuntimeAdapterId || 'No adapter';
  const previewScheduleCount = schedulesQuery.data?.length ?? 0;
  const previewNextSchedule = schedulesQuery.data
    ?.map((schedule) => schedule.next_fire_at)
    .filter(Boolean)
    .sort()[0];
  const previewMonitoring = displayedWorkflowMonitoring?.exempted
    ? 'Exempt'
    : displayedWorkflowMonitoring?.enabled === false
      ? 'Off'
      : (displayedWorkflowMonitoring?.level ?? 'Not reported');
  const previewPendingProposals =
    monitoringEventsQuery.data?.proposals?.filter((proposal) =>
      (proposal.approval_requests ?? []).some((approval) => approval.status === 'pending')
    ).length ?? 0;
  const previewMemoryEnabled = sharedMemoryQuery.data?.enabled === true;
  const previewMemoryCount = workflowMemoriesQuery.data?.length ?? 0;
  const effectiveWorkflowCapabilityTags = isEditing
    ? readWorkflowCapabilityTags(workflowMetadata)
    : readWorkflowCapabilityTags(workflow?.metadata);
  const effectiveWorkflowCapabilityLabels = WORKFLOW_CAPABILITY_OPTIONS.filter((option) =>
    effectiveWorkflowCapabilityTags.includes(option.tag)
  ).map((option) => option.label);
  const activeRunsBehaviorLabel = effectiveRestartActiveExecutions
    ? 'Active runs restart'
    : 'Active runs stay current';
  const activeRunsBehaviorDescription = effectiveRestartActiveExecutions
    ? 'Running executions restart after the workflow is saved.'
    : 'Running executions continue unchanged. Future runs use the saved workflow.';
  const renderWorkflowMetadataPreview = () => (
    <div
      aria-hidden="true"
      data-workflow-metadata-preview="true"
      className="relative mt-3 max-h-40 overflow-hidden border-t border-primary-100/70 px-1 pt-3 group-data-[state=open]:hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-25 after:bg-linear-to-b after:from-white/0 after:via-white/30 after:to-white/95 dark:border-sky-400/10 dark:after:from-slate-950/0 dark:after:via-slate-950/35 dark:after:to-slate-950"
    >
      <div className="space-y-3 pb-32">
        <div className="grid gap-2 text-xs text-neutral-600 dark:text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1 rounded-lg border border-violet-100 bg-white/80 px-3 py-2 shadow-sm shadow-violet-100/30 dark:border-violet-400/20 dark:bg-violet-500/8 dark:shadow-none">
            <div className="font-medium text-neutral-900 dark:text-slate-100">Identity</div>
            <div className="truncate text-neutral-600 dark:text-slate-300">{previewEntrypoint}</div>
            <div className="flex items-center gap-1.5 text-neutral-500 dark:text-slate-400">
              <WorkflowToneDot tone={effectiveRestartActiveExecutions ? 'amber' : 'emerald'} />
              <span className="truncate">{activeRunsBehaviorLabel}</span>
            </div>
            <div className="truncate text-neutral-500 dark:text-slate-400">
              {effectiveWorkflowCapabilityLabels.length > 0
                ? effectiveWorkflowCapabilityLabels.join(' · ')
                : 'No capabilities'}
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-sky-100 bg-white/80 px-3 py-2 shadow-sm shadow-neutral-100/70 dark:border-sky-400/18 dark:bg-sky-500/8 dark:shadow-none">
            <div className="font-medium text-neutral-900 dark:text-slate-100">Execution</div>
            <div className="truncate text-neutral-600 dark:text-slate-300">
              {previewRuntimeAdapter}
            </div>
            <div className="text-neutral-500 dark:text-slate-400">
              {selectedExecutionHost} · {workflow.allowed_runtime_adapter_ids?.length ?? 0} allowed
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-amber-100 bg-white/80 px-3 py-2 shadow-sm shadow-neutral-100/70 dark:border-amber-300/18 dark:bg-amber-400/8 dark:shadow-none">
            <div className="font-medium text-neutral-900 dark:text-slate-100">Schedules</div>
            <div className="text-neutral-600 dark:text-slate-300">
              {previewScheduleCount} configured
            </div>
            <div className="truncate text-neutral-500 dark:text-slate-400">
              {formatPreviewDate(previewNextSchedule)}
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-emerald-100 bg-white/80 px-3 py-2 shadow-sm shadow-neutral-100/70 dark:border-emerald-300/18 dark:bg-emerald-500/8 dark:shadow-none">
            <div className="font-medium text-neutral-900 dark:text-slate-100">Monitoring</div>
            <div className="truncate text-neutral-600 dark:text-slate-300">{previewMonitoring}</div>
            <div className="text-neutral-500 dark:text-slate-400">
              {previewPendingProposals} pending proposals
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-cyan-100 bg-white/80 px-3 py-2 shadow-sm shadow-neutral-100/70 dark:border-cyan-300/18 dark:bg-cyan-500/8 dark:shadow-none">
            <div className="font-medium text-neutral-900 dark:text-slate-100">Knowledge</div>
            <div className="text-neutral-600 dark:text-slate-300">
              {previewMemoryEnabled ? 'Memory on' : 'Memory off'}
            </div>
            <div className="text-neutral-500 dark:text-slate-400">
              {previewMemoryCount} workflow memories
            </div>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-neutral-600 dark:text-slate-300 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-1.5">
            <div className="font-medium text-neutral-700 dark:text-slate-200">Name</div>
            <div className="truncate rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-500 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300 dark:shadow-none">
              {name || workflow.name || 'Untitled workflow'}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="font-medium text-neutral-700 dark:text-slate-200">Description</div>
            <div className="truncate rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-500 shadow-sm dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300 dark:shadow-none">
              {description || workflow.description || 'No description'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReadOnlyWorkflowMetadata = () => (
    <WorkflowSettingsSection
      title="Identity and execution"
      description="Saved workflow identity, default runtime, and active-run behavior."
      tone="violet"
      className="workflow-surface-metadata"
    >
      <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <WorkflowReadOnlySummaryField label="Name" className="xl:col-span-2">
          <WorkflowStateValue>{workflow.name || 'Untitled'}</WorkflowStateValue>
        </WorkflowReadOnlySummaryField>
        <WorkflowReadOnlySummaryField label="Entrypoint" className="xl:col-span-2">
          <WorkflowStateValue>
            {labelForEntrypointTask(effectiveEntrypointTaskId, visibleTaskDefinitions)}
          </WorkflowStateValue>
        </WorkflowReadOnlySummaryField>
        <WorkflowReadOnlySummaryField label="Default runtime">
          <WorkflowStateValue>
            {workflow.default_runtime_adapter_id || 'No adapter'}
          </WorkflowStateValue>
        </WorkflowReadOnlySummaryField>
        <WorkflowReadOnlySummaryField label="Default host">
          <WorkflowStateValue>{resolveWorkflowExecutionHost(workflow)}</WorkflowStateValue>
        </WorkflowReadOnlySummaryField>
        <WorkflowReadOnlySummaryField label="Allowed adapters">
          <WorkflowStateValue>
            {workflow.allowed_runtime_adapter_ids?.length ?? 0}
          </WorkflowStateValue>
        </WorkflowReadOnlySummaryField>
        <WorkflowReadOnlySummaryField label="Capabilities">
          {effectiveWorkflowCapabilityLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {effectiveWorkflowCapabilityLabels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-sm text-neutral-500 dark:text-slate-400">None declared</span>
          )}
        </WorkflowReadOnlySummaryField>
        <WorkflowReadOnlySummaryField label="Description" className="md:col-span-2">
          <div className="text-neutral-900 dark:text-slate-100">
            {workflow.description || 'No description'}
          </div>
        </WorkflowReadOnlySummaryField>
        <WorkflowReadOnlySummaryField label="Active run behavior" className="md:col-span-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <WorkflowToneDot tone={effectiveRestartActiveExecutions ? 'amber' : 'emerald'} />
              <WorkflowStateValue>{activeRunsBehaviorLabel}</WorkflowStateValue>
            </div>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              {activeRunsBehaviorDescription}
            </p>
          </div>
        </WorkflowReadOnlySummaryField>
      </dl>
    </WorkflowSettingsSection>
  );

  const emptyChangeSummary: WorkflowChangeSummary = {
    groups: [],
    totalAdded: 0,
    totalChanged: 0,
    totalRemoved: 0,
    totalChanges: 0,
    hasChanges: false,
  };

  const renderWorkflowChangeSummaryContent = (
    summary: WorkflowChangeSummary,
    emptyMessage: string
  ) => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{summary.totalAdded} added</Badge>
        <Badge variant="outline">{summary.totalChanged} changed</Badge>
        <Badge variant="outline">{summary.totalRemoved} removed</Badge>
      </div>
      {summary.hasChanges ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.groups.map((group) => {
            const visibleDetails = group.details.slice(0, 3);
            const hiddenDetailCount = Math.max(0, group.details.length - visibleDetails.length);
            const groupChangeCount = group.added + group.changed + group.removed;

            return (
              <section
                key={group.id}
                className="rounded-md border border-sky-100 bg-white/80 p-3 text-sm dark:border-sky-300/15 dark:bg-slate-950/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <h5 className="font-semibold text-neutral-900 dark:text-slate-100">
                    {group.label}
                  </h5>
                  <span className="shrink-0 text-xs text-neutral-500 dark:text-slate-400">
                    {groupChangeCount} change{groupChangeCount === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                  {group.added} added, {group.changed} changed, {group.removed} removed
                </p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-neutral-700 dark:text-slate-300">
                  {visibleDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                  {hiddenDetailCount > 0 ? <li>+{hiddenDetailCount} more</li> : null}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-slate-400">{emptyMessage}</p>
      )}
    </div>
  );

  const renderDraftChangeSummary = () => {
    if (!isEditing) {
      return null;
    }

    const summary = hasUnsavedChanges ? draftChangeSummary : emptyChangeSummary;

    return (
      <WorkflowSettingsSection
        title="Draft Change Summary"
        description="Review graph and metadata edits against the last saved workflow before saving."
        tone={summary.hasChanges ? 'sky' : 'neutral'}
      >
        {renderWorkflowChangeSummaryContent(
          summary,
          'No draft changes since the last saved workflow.'
        )}
      </WorkflowSettingsSection>
    );
  };

  const renderWorkflowMetadataSection = () => (
    <Accordion
      id="workflow-metadata"
      type="single"
      collapsible
      defaultValue={isEditing ? 'workflow-metadata' : undefined}
      className="agency-surface-raised rounded-xl border px-3 py-2"
    >
      <AccordionItem value="workflow-metadata" className="group border-0">
        <AccordionTrigger className={runConfigurationTriggerClass}>
          <div className="flex min-w-0 flex-1 flex-col">
            {renderConfigurationTrigger(
              'Configuration & governance',
              isEditing
                ? 'Name, description, entrypoint, runtime defaults, and active-run controls'
                : 'Identity, runtime defaults, schedule, monitoring, memory, and workflow settings'
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-5 px-1 pb-4 pt-2">
          {renderWorkflowMetadataPreview()}
          {renderDraftChangeSummary()}
          {isEditing ? (
            <WorkflowMetadataEditor
              name={name}
              description={description}
              entrypoint={entrypoint}
              defaultRuntimeAdapterId={defaultRuntimeAdapterId}
              executionHost={executionHost}
              restartActiveExecutions={restartActiveExecutions}
              workflowMetadata={workflowMetadata}
              workflowCapabilityTags={effectiveWorkflowCapabilityTags}
              visibleTaskDefinitions={visibleTaskDefinitions}
              runtimeAdapters={runtimeAdapters}
              workflowNameInvalid={workflowNameInvalid}
              workflowDescriptionInvalid={workflowDescriptionInvalid}
              draftValidationIssues={draftValidationIssues}
              hasUnsavedChanges={hasUnsavedChanges}
              isSaving={updateMutation.isPending}
              autoSaveStatus={autoSaveStatus}
              lastAutoSavedAt={lastAutoSavedAt}
              onNameChange={setName}
              onDescriptionChange={setDescription}
              onEntrypointChange={setEntrypoint}
              onDefaultRuntimeAdapterChange={selectDefaultRuntimeAdapter}
              onExecutionHostChange={setExecutionHost}
              onRestartActiveExecutionsChange={setRestartActiveExecutions}
              onWorkflowMetadataChange={replaceWorkflowMetadata}
              onWorkflowCapabilityTagsChange={(nextTags: WorkflowCapabilityTag[]) =>
                replaceWorkflowMetadata(writeWorkflowCapabilityTags(workflowMetadata, nextTags))
              }
              onSave={() => {
                void handleSave();
              }}
            />
          ) : (
            renderReadOnlyWorkflowMetadata()
          )}

          <section className="rounded-xl border border-neutral-200 bg-neutral-50/65 dark:border-white/10 dark:bg-white/3">
            <div className="flex items-start justify-between gap-4 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold text-neutral-900 dark:text-slate-100">
                  Advanced workflow controls
                </div>
                <p className="mt-1 text-sm font-normal text-neutral-500 dark:text-slate-400">
                  Scheduling, monitoring, governance, shared memory, observability, and documents.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                Optional
              </Badge>
            </div>
            <div className="space-y-5 border-t border-neutral-200 px-3 pb-4 pt-4 dark:border-white/10">
              {renderRunConfigurationSections()}
            </div>
          </section>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  const renderPersonaQuickCreatePanel = () => {
    if (!isEditing || personaAgentDefinitions.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col gap-3 rounded-md border border-sky-100 bg-sky-50/60 p-3 text-sm sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="workflow-persona-agent-create">Persona agent</Label>
          <select
            id="workflow-persona-agent-create"
            value={personaQuickCreateAgentId}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            onChange={(event) => setPersonaQuickCreateAgentId(event.target.value)}
          >
            <option value="">Choose persona to add as an agent</option>
            {personaAgentDefinitions.map((personaAgent) => (
              <option key={personaAgent.id} value={personaAgent.id}>
                {graphAgentOptionLabel(
                  personaAgent,
                  personaVersionNoticeByAgentId.get(personaAgent.id)
                )}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!personaQuickCreateAgentId}
          onClick={createPersonaBackedGraphAgent}
        >
          Add Persona Agent
        </Button>
      </div>
    );
  };

  const closeSelectedGraphDrawer = () => {
    if (selectedTask) {
      updateWorkflowUrl({ nextTaskId: null });
    }
    setSelectedGraphApprovalTaskId(null);

    if (selectedGraphAgent) {
      setSelectedGraphAgentId(null);
    }

    if (selectedGraphToolId) {
      setSelectedGraphToolId(null);
    }
    setSelectedGraphToolIds([]);
    setSelectedGraphToolNodeId(null);

    if (selectedGraphMemoryId) {
      setSelectedGraphMemoryId(null);
    }

    if (selectedGraphArtifactId) {
      setSelectedGraphArtifactId(null);
    }

    if (selectedGraphEdge) {
      setSelectedGraphEdgeRef(null);
    }
  };

  const renderSelectedNodeDrawer = () => {
    const selectedApprovalTaskLabel = selectedTaskWasOpenedFromApproval
      ? selectedTask?.name || selectedTask?.id || 'selected task'
      : null;

    if (
      activeTab !== 'graph' ||
      (!selectedTask &&
        !selectedGraphAgent &&
        !selectedGraphTool &&
        !selectedGraphToolListOpen &&
        !selectedGraphMemory &&
        !selectedGraphArtifact &&
        !selectedGraphEdge)
    ) {
      return null;
    }

    const title = selectedGraphEdge
      ? 'Selected Edge'
      : selectedGraphAgent
        ? 'Selected Agent'
        : selectedGraphTool || selectedGraphToolListOpen
          ? 'Selected Tool'
          : selectedGraphMemory
            ? 'Selected Memory'
            : selectedGraphArtifact
              ? 'Selected Artifact'
              : selectedTaskWasOpenedFromApproval
                ? 'Selected Approval Gate'
                : 'Selected Task';
    const description = selectedGraphEdge
      ? 'Workflow connection type, condition, and metadata.'
      : selectedGraphAgent
        ? 'Agent model profile and workflow configuration.'
        : selectedGraphTool || selectedGraphToolListOpen
          ? 'Tool details and linked agents.'
          : selectedGraphMemory
            ? 'Memory details and linked agents or tasks.'
            : selectedGraphArtifact
              ? 'Durable workflow output and its producing task.'
              : selectedTaskWasOpenedFromApproval
                ? `Approval gate for ${selectedApprovalTaskLabel}. Its connector shows the task relationship.`
                : 'Task details, dependencies, and linked agent.';
    const drawerShellClassName = selectedGraphAgent
      ? 'workflow-surface-agent'
      : selectedGraphTool || selectedGraphToolListOpen
        ? 'workflow-surface-tool'
        : selectedGraphMemory
          ? 'workflow-surface-memory'
          : selectedGraphArtifact
            ? 'workflow-surface-task'
            : selectedGraphEdge
              ? 'workflow-surface-edge'
              : 'workflow-surface-task';
    const drawerKicker = selectedGraphEdge
      ? 'Connection'
      : selectedGraphAgent
        ? 'Agent node'
        : selectedGraphTool || selectedGraphToolListOpen
          ? 'Tool node'
          : selectedGraphMemory
            ? 'Memory node'
            : selectedGraphArtifact
              ? 'Artifact node'
              : selectedTaskWasOpenedFromApproval
                ? 'Approval node'
                : 'Task node';
    const selectedReviewTarget: WorkflowGraphReviewTarget | null = selectedGraphEdge
      ? null
      : selectedGraphAgent
        ? {
            type: 'agent',
            id: selectedGraphAgent.id,
            label: selectedGraphAgent.name || selectedGraphAgent.id,
          }
        : selectedGraphTool || selectedGraphToolListOpen
          ? selectedGraphTool
            ? {
                type: 'tool',
                id: selectedGraphTool.id,
                label:
                  selectedGraphTool.display_name || selectedGraphTool.name || selectedGraphTool.id,
              }
            : selectedGraphToolNode
              ? {
                  type: 'tool',
                  id: selectedGraphToolNode.id,
                  label:
                    typeof selectedGraphToolNode.data?.label === 'string'
                      ? selectedGraphToolNode.data.label
                      : selectedGraphToolNode.id,
                }
              : null
          : selectedGraphMemory && selectedGraphMemoryId
            ? {
                type: 'memory',
                id: selectedGraphMemoryId,
                label: memoryDisplayName(selectedGraphMemory),
              }
            : selectedGraphArtifact && selectedGraphArtifactId
              ? {
                  type: 'artifact',
                  id: selectedGraphArtifactId,
                  label: selectedGraphArtifact.name || selectedGraphArtifactId,
                }
              : selectedTaskWasOpenedFromApproval && selectedTask
                ? {
                    type: 'approval',
                    id: selectedTask.id,
                    label: `Approval gate for ${selectedTask.name || selectedTask.id}`,
                  }
                : selectedTask
                  ? {
                      type: 'task',
                      id: selectedTask.id,
                      label: selectedTask.name || selectedTask.id,
                    }
                  : null;

    return (
      <>
        <button
          type="button"
          aria-label="Close selected graph drawer"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={closeSelectedGraphDrawer}
        />
        <aside
          role="dialog"
          aria-modal="false"
          aria-label={title}
          aria-describedby="workflow-graph-drawer-description"
          className={cn(
            'fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_64px_rgba(2,8,23,0.7)] backdrop-blur-sm sm:max-w-2xl',
            drawerShellClassName
          )}
        >
          <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/82 px-4 py-4 shadow-[0_14px_32px_rgba(2,8,23,0.35)] backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {drawerKicker}
                </p>
                {/*<h2 className="mt-1 truncate text-xl font-semibold text-slate-50">{title}</h2>*/}
                <p
                  id="workflow-graph-drawer-description"
                  className="mt-1 text-sm leading-5 text-slate-300"
                >
                  {description}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/12 hover:text-white"
                onClick={closeSelectedGraphDrawer}
              >
                Close
              </button>
            </div>
          </div>
          <div className="space-y-4 p-4">
            {selectedGraphEdge
              ? renderSelectedEdgePanel()
              : selectedGraphAgent
                ? renderSelectedAgentPanel()
                : selectedGraphTool || selectedGraphToolListOpen
                  ? renderSelectedToolPanel()
                  : selectedGraphMemory
                    ? renderSelectedMemoryPanel()
                    : selectedGraphArtifact
                      ? renderSelectedArtifactPanel()
                      : renderSelectedTaskPanel()}
            {renderGraphReviewNote(selectedReviewTarget)}
          </div>
        </aside>
      </>
    );
  };

  const canRequestGraphSteering = Boolean(
    displayedWorkflowMonitoring?.enabled &&
    displayedWorkflowMonitoring.controls?.supervise_subagents !== false
  );
  const graphRuntimeControls =
    canRequestGraphSteering || (!isEditing && graphRuntimeControlRun)
      ? {
          runId: !isEditing && graphRuntimeControlRun ? graphRuntimeControlRun.id : undefined,
          status: !isEditing && graphRuntimeControlRun ? graphRuntimeControlRun.status : undefined,
          approvalToolId:
            !isEditing && graphRuntimeControlRun ? graphRuntimeControlApprovalToolId : undefined,
          approvalLabel:
            !isEditing && graphRuntimeControlRun ? graphRuntimeControlApprovalLabel : undefined,
          checkpointResumeTaskId:
            !isEditing && graphRuntimeControlRun ? graphRuntimeControlCheckpointTaskId : undefined,
          canRequestSteering: canRequestGraphSteering,
          isPending:
            graphResumeRunMutation.isPending ||
            graphRetryTaskMutation.isPending ||
            graphCheckpointResumeMutation.isPending ||
            graphNativeApprovalDecisionMutation.isPending ||
            createGraphSteeringApprovalMutation.isPending,
          onRequestSteering: canRequestGraphSteering ? handleGraphSteeringRequest : undefined,
          onResumeRun: !isEditing && graphRuntimeControlRun ? handleGraphResumeRun : undefined,
          onRetryTask: !isEditing && graphRuntimeControlRun ? handleGraphRetryTask : undefined,
          onResumeFromCheckpoint:
            !isEditing && graphRuntimeControlRun && graphRuntimeControlCheckpointTaskId
              ? handleGraphResumeFromCheckpoint
              : undefined,
          onApproveTool:
            !isEditing && graphRuntimeControlRun
              ? (runId: string, toolId: string) =>
                  handleGraphNativeApprovalDecision(runId, toolId, 'approve')
              : undefined,
          onRejectTool:
            !isEditing && graphRuntimeControlRun
              ? (runId: string, toolId: string) =>
                  handleGraphNativeApprovalDecision(runId, toolId, 'reject')
              : undefined,
        }
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <WorkflowDetailHeader
        workflowId={workflow.id}
        workflowName={resolvedWorkflowPreview.name}
        workflowDescription={resolvedWorkflowPreview.description ?? undefined}
        isEditing={isEditing}
        hasUnsavedChanges={hasUnsavedChanges}
        isExecuting={executeMutation.isPending}
        onRefresh={handleRefresh}
        onStartEditing={() => {
          suppressEditModeStartRef.current = false;
          startEditing();
          updateWorkflowUrl({ nextMode: 'edit' });
        }}
        onCancelEditing={() => {
          suppressEditModeStartRef.current = true;
          stopEditing();
          updateWorkflowUrl({ nextMode: null, nextTaskId: null });
        }}
        onExecute={handleExecute}
        onExportWorkflow={handleExportWorkflow}
      />

      <ConfirmActionDialog
        trigger={null}
        open={refreshConfirmOpen}
        onOpenChange={setRefreshConfirmOpen}
        title="Discard unsaved workflow changes?"
        description="Refreshing from the backend replaces the current editor draft. Saved workflow data and run history are not affected."
        confirmLabel="Discard and refresh"
        cancelLabel="Keep editing"
        destructive
        onConfirm={refreshFromBackend}
      />

      {outdatedPersonaVersionNotices.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-medium">This workflow uses older persona versions</p>
              <p className="mt-1">
                {outdatedPersonaVersionNotices.length} persona-backed agent
                {outdatedPersonaVersionNotices.length === 1 ? ' is' : 's are'} pinned to a previous
                persona package. Review the workflow agents to apply the latest persona package or
                keep the current workflow snapshot.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {outdatedPersonaVersionNotices.map((notice) => (
                  <Badge
                    key={personaNoticeKey(notice)}
                    variant="outline"
                    className="border-amber-300 bg-white/70 text-amber-900"
                  >
                    @{notice.personaSlug} {shortPersonaVersionId(notice.workflowPersonaVersionId)}{' '}
                    -&gt; {shortPersonaVersionId(notice.currentPersonaVersionId)}
                  </Badge>
                ))}
              </div>
            </div>
            {!isEditing ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                onClick={() => {
                  suppressEditModeStartRef.current = false;
                  startEditing();
                  updateWorkflowUrl({ nextMode: 'edit' });
                }}
              >
                Review in editor
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {executeMutation.isError ? (
        <WorkflowOperationError
          fallbackTitle="Failed to start workflow"
          message={executeMutation.error.message}
          onRetry={() => {
            void handleExecute();
          }}
        />
      ) : null}

      {saveErrorMessage ? (
        <WorkflowOperationError
          fallbackTitle="Failed to save workflow"
          message={saveErrorMessage}
          onRetry={() => {
            void handleSave();
          }}
        />
      ) : null}

      {backendValidationSummary.errors.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50/80 p-4 text-sm text-red-900">
          <p className="font-medium">Backend workflow validation failed</p>
          <div className="mt-2 space-y-1">
            {backendValidationSummary.errors.slice(0, 5).map((message) => (
              <p key={message}>{message}</p>
            ))}
            {backendValidationSummary.errors.length > 5 ? (
              <p>{backendValidationSummary.errors.length - 5} more validation errors.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <WorkflowDetailStatus
        workflow={resolvedWorkflowPreview}
        visibleTaskDefinitions={visibleTaskDefinitions}
        visibleAgentCount={visibleAgentDefinitions.length}
        effectiveEntrypointTaskId={effectiveEntrypointTaskId}
        isEditing={isEditing}
        draftValidationIssues={draftValidationIssues}
      />

      {renderPersonaQuickCreatePanel()}

      <section
        id="workflow-graph"
        aria-label="Workflow graph"
        className="scroll-mt-24 rounded-2xl border border-(--agency-shell-border) bg-(--agency-surface-raised) p-2 shadow-(--agency-elevation-1) sm:p-3"
      >
        <WorkflowGraphCanvas
          className="h-[28rem]! min-h-[26rem]! rounded-xl! sm:h-[30rem]! lg:h-[28rem]! lg:min-h-[26rem]!"
          workflow={resolvedWorkflowPreview}
          readOnly={!isEditing}
          includeTools
          toolDefinitions={assignableToolDefinitions}
          modelProfiles={behaviorProfiles}
          includeMemories
          runtimeEvents={isEditing ? undefined : workflowGraphRuntimeEvents}
          runtimeControls={graphRuntimeControls}
          agentObservabilityMetrics={workflowAgentObservabilityMetrics}
          personaVersionNotices={personaVersionNotices}
          workflowValidationIssues={isEditing ? draftValidationIssues : []}
          memoryLinkCountsByTarget={memoryLinkCountsByTarget}
          onWorkflowChange={(nextWorkflow) => {
            if (isEditing) {
              applyWorkflowDefinition(nextWorkflow);
            }
          }}
          onSelectTask={(taskId) => {
            setSelectedGraphApprovalTaskId(null);
            setSelectedGraphAgentId(null);
            setSelectedGraphToolId(null);
            setSelectedGraphToolIds([]);
            setSelectedGraphToolNodeId(null);
            setSelectedGraphMemoryId(null);
            setSelectedGraphArtifactId(null);
            setSelectedGraphEdgeRef(null);
            updateWorkflowUrl({ nextTaskId: taskId });
          }}
          onSelectApproval={(taskId) => {
            setSelectedGraphApprovalTaskId(taskId);
            setSelectedGraphAgentId(null);
            setSelectedGraphToolId(null);
            setSelectedGraphToolIds([]);
            setSelectedGraphToolNodeId(null);
            setSelectedGraphMemoryId(null);
            setSelectedGraphArtifactId(null);
            setSelectedGraphEdgeRef(null);
            updateWorkflowUrl({ nextTaskId: taskId });
          }}
          onSelectAgent={(agentId) => {
            setSelectedGraphApprovalTaskId(null);
            setSelectedGraphAgentId(agentId);
            setSelectedGraphToolId(null);
            setSelectedGraphToolIds([]);
            setSelectedGraphToolNodeId(null);
            setSelectedGraphMemoryId(null);
            setSelectedGraphArtifactId(null);
            setSelectedGraphEdgeRef(null);
            if (requestedTaskId) {
              updateWorkflowUrl({ nextTaskId: null });
            }
          }}
          onSelectTool={(toolId, toolIds = toolId ? [toolId] : [], toolNodeId = null) => {
            setSelectedGraphApprovalTaskId(null);
            setSelectedGraphToolId(toolId);
            setSelectedGraphToolIds(toolIds);
            setSelectedGraphToolNodeId(toolNodeId);
            setToolDrawerSearch('');
            setSelectedGraphAgentId(null);
            setSelectedGraphMemoryId(null);
            setSelectedGraphArtifactId(null);
            setSelectedGraphEdgeRef(null);
            if (requestedTaskId) {
              updateWorkflowUrl({ nextTaskId: null });
            }
          }}
          onSelectMemory={(memoryId) => {
            setSelectedGraphApprovalTaskId(null);
            setSelectedMemoryTypeTab('all');
            setSelectedGraphMemoryId(memoryId);
            setSelectedGraphAgentId(null);
            setSelectedGraphToolId(null);
            setSelectedGraphToolIds([]);
            setSelectedGraphToolNodeId(null);
            setSelectedGraphArtifactId(null);
            setSelectedGraphEdgeRef(null);
            if (requestedTaskId) {
              updateWorkflowUrl({ nextTaskId: null });
            }
          }}
          onSelectArtifact={(artifactId) => {
            setSelectedGraphApprovalTaskId(null);
            setSelectedGraphArtifactId(artifactId);
            setSelectedGraphAgentId(null);
            setSelectedGraphToolId(null);
            setSelectedGraphToolIds([]);
            setSelectedGraphToolNodeId(null);
            setSelectedGraphMemoryId(null);
            setSelectedGraphEdgeRef(null);
            if (requestedTaskId) {
              updateWorkflowUrl({ nextTaskId: null });
            }
          }}
          onSelectEdge={(edge) => {
            setSelectedGraphApprovalTaskId(null);
            setSelectedGraphEdgeRef(edge ? graphEdgeReference(edge) : null);
            if (edge) {
              setSelectedGraphAgentId(null);
              setSelectedGraphToolId(null);
              setSelectedGraphToolIds([]);
              setSelectedGraphToolNodeId(null);
              setSelectedGraphMemoryId(null);
              setSelectedGraphArtifactId(null);
              if (requestedTaskId) {
                updateWorkflowUrl({ nextTaskId: null });
              }
            }
          }}
          onValidationIssues={handleGraphValidationIssues}
          onStartEditing={() => {
            suppressEditModeStartRef.current = false;
            startEditing();
            updateWorkflowUrl({ nextMode: 'edit' });
          }}
          onSaveWorkflow={() => {
            void handleSave();
          }}
          onRunWorkflow={handleExecute}
          saveWorkflowDisabled={!isEditing || updateMutation.isPending}
          runWorkflowDisabled={isEditing || executeMutation.isPending}
        />
      </section>

      {renderWorkflowMetadataSection()}

      {renderSelectedNodeDrawer()}
    </div>
  );
}
