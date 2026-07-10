import type { JsonObject } from '@/types/api';
import type { AssistantPageContextSnapshot } from '@/components/assistant/AssistantPageContext';

interface AssistantProviderManifestEntry extends JsonObject {
  id: string;
  label: string;
  surfaces: string[];
  resourceTypes: string[];
  systemToolIds: string[];
  description: string;
  requiresSelection?: string[];
  mutates?: boolean;
  requiresApproval?: boolean;
}

const assistantProviderManifest: AssistantProviderManifestEntry[] = [
  {
    id: 'workflow.provider',
    label: 'Workflow provider',
    surfaces: ['workflow.list', 'workflow.detail'],
    resourceTypes: ['workflow', 'task', 'agent'],
    systemToolIds: [
      'agency.workflow.list',
      'agency.workflow.get',
      'agency.workflow.run',
      'agency.workflow.propose-create',
      'agency.workflow.propose-update',
    ],
    description:
      'Inspect, run, create, and propose updates to workflows using approval-backed system tools.',
    requiresApproval: true,
    mutates: true,
  },
  {
    id: 'agent.provider',
    label: 'Agent provider',
    surfaces: ['agent.list', 'workflow.detail'],
    resourceTypes: ['agent'],
    systemToolIds: ['agency.agent.list', 'agency.agent.get', 'agency.agent.propose-update'],
    description: 'Inspect agents and propose agent changes through human approval.',
    requiresSelection: ['agentId'],
    requiresApproval: true,
    mutates: true,
  },
  {
    id: 'tool.provider',
    label: 'Tool provider',
    surfaces: ['integrations', 'integrations.operations', 'workflow.detail'],
    resourceTypes: ['tool', 'tool_contract'],
    systemToolIds: [
      'agency.tool.list',
      'agency.tool.get',
      'agency.tool.propose-create',
      'agency.tool.propose-update',
    ],
    description: 'Inspect tools and propose tool definition changes through human approval.',
    requiresSelection: ['toolId'],
    requiresApproval: true,
    mutates: true,
  },
  {
    id: 'execution.provider',
    label: 'Execution provider',
    surfaces: ['runs.list', 'runs.detail', 'workflow.detail'],
    resourceTypes: ['run', 'execution', 'approval'],
    systemToolIds: [
      'agency.execution.get',
      'agency.execution.events',
      'agency.execution.artifacts',
      'agency.execution.approvals',
      'agency.execution.pause',
      'agency.execution.resume',
      'agency.execution.cancel',
      'agency.execution.approve',
      'agency.execution.reject',
    ],
    description:
      'Inspect runs, read runtime evidence, control lifecycle, and resolve pending run tool approvals.',
    requiresSelection: ['runId'],
    mutates: true,
  },
  {
    id: 'connector.provider',
    label: 'Connector provider',
    surfaces: ['integrations', 'integrations.operations'],
    resourceTypes: ['connector', 'credential', 'provider'],
    systemToolIds: [
      'agency.connector.capabilities',
      'agency.connector.credentials',
      'agency.connector.resolve',
      'agency.connector.history',
      'agency.connector.test',
    ],
    description:
      'Inspect connector capabilities, owner credentials, resolve repeated connector instances, health history, and run credential health tests.',
    mutates: false,
  },
];

export function assistantProviderMetadata(
  pageContext: AssistantPageContextSnapshot | undefined
): JsonObject {
  const providers = assistantProviderManifest
    .filter((provider) => pageContext && provider.surfaces.includes(pageContext.surface))
    .map((provider) => ({
      ...provider,
      selection: pageContext?.selection ?? {},
      entities: (pageContext?.entities ?? []).filter((entity) =>
        provider.resourceTypes.includes(entity.type)
      ),
    }));

  return {
    assistant_providers: {
      version: '2026-05-27',
      providers,
    },
  };
}
