import type {JsonObject} from '@/types/api';
import type {ToolDefinition} from '@/types/tools';
import {toolDisplayName} from './displayName';

export const capabilityFamilies = [
  {
    id: 'workflow',
    label: 'Workflows & automation',
    description: 'Build, run, schedule, and govern workflows.',
  },
  {
    id: 'goal',
    label: 'Goals & planning',
    description: 'Plan objectives, track evidence, and supervise progress.',
  },
  {
    id: 'execution',
    label: 'Runs & observability',
    description: 'Inspect execution evidence and control active runs.',
  },
  {
    id: 'agent',
    label: 'Agent management',
    description: 'Discover agents and prepare changes to their definitions.',
  },
  {
    id: 'tool',
    label: 'Tool development',
    description: 'Discover, build, test, and publish tools.',
  },
  {
    id: 'browser',
    label: 'Browser & local apps',
    description: 'Browse pages and work with connected desktop apps.',
  },
  {
    id: 'memory',
    label: 'Memory & knowledge',
    description: 'Retrieve, curate, and link durable context.',
  },
  {
    id: 'graph',
    label: 'Agency graph',
    description: 'Explore relationships, provenance, and working sets.',
  },
  {
    id: 'documents',
    label: 'Files & documents',
    description: 'Read, transform, upload, and manage files.',
  },
  {
    id: 'connector',
    label: 'Connections & delivery',
    description: 'Set up integrations and deliver messages or media.',
  },
  {
    id: 'command',
    label: 'System & commands',
    description: 'Run guarded commands in an approved environment.',
  },
  {
    id: 'media',
    label: 'Media & speech',
    description: 'Produce images, audio, voice, and shared media artifacts.',
  },
  {
    id: 'operator',
    label: 'Operators',
    description: 'Prepare and control ongoing event or timer evaluations.',
  },
  {
    id: 'persona',
    label: 'Personas',
    description: 'Inspect, prepare, and review reusable personas.',
  },
  {id: 'human', label: 'Human input', description: 'Ask for clarification or a human decision.'},
  {
    id: 'other',
    label: 'Other capabilities',
    description: 'Additional tools with no recognized capability family.',
  },
] as const;

export type CapabilityFamilyId = (typeof capabilityFamilies)[number]['id'];
export type ToolAccess = 'read' | 'approval' | 'write';
export const toolAccessLabels: Record<ToolAccess, string> = {
  read: 'Read only',
  approval: 'Approval required',
  write: 'Can change state',
};

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function familyFromNamespace(namespace: string): CapabilityFamilyId | undefined {
  if (/^(connector\.desktop_|browser)/.test(namespace)) return 'browser';
  if (/^(workflow\.(memory-links|shared-memory)|memory)/.test(namespace)) return 'memory';
  if (/^(workflow\.document|documents?|file|excel|pdf|csv|ocr)/.test(namespace)) return 'documents';
  if (/^(execution|observability|conversation)/.test(namespace)) return 'execution';
  if (/^(schedule|main-agent|workflow)/.test(namespace)) return 'workflow';
  if (/^(speech|voice|audio|video|image|media)/.test(namespace)) return 'media';
  if (/^(http|connector)/.test(namespace)) return 'connector';
  if (/^(code|shell|command)/.test(namespace)) return 'command';
  return capabilityFamilies.find((family) => namespace.split('.')[0] === family.id)?.id;
}

export function toolCapabilityFamily(tool: ToolDefinition) {
  // Canonical namespaces keep a memory tool out of Workflows merely because
  // its description mentions a workflow. External tools can supply routing hints.
  const namespace = tool.id.startsWith('agency.') ? tool.id.slice(7) : '';
  const routingGroup = object(tool.routing).group;
  const familyId =
    (namespace && familyFromNamespace(namespace)) ||
    (typeof routingGroup === 'string' && familyFromNamespace(routingGroup)) ||
    'other';
  return capabilityFamilies.find((family) => family.id === familyId)!;
}

export function toolAccess(tool: ToolDefinition): ToolAccess {
  const security = object(tool.security);
  const routing = object(tool.routing);
  // Hints may make the label more restrictive, never downgrade enforced policy.
  if (security.requires_approval === true || routing.requires_confirmation === true)
    return 'approval';
  if (security.read_only === true && routing.read_only !== false && security.dangerous !== true)
    return 'read';
  return 'write';
}

export function toolOperationChoices(tool: ToolDefinition): string[] {
  const properties = object(object(tool.input_schema).properties);
  return [
    ...new Set(
      ['action', 'operation', 'mode'].flatMap((key) => {
        const values = object(properties[key]).enum;
        return Array.isArray(values)
          ? values.filter((value): value is string => typeof value === 'string')
          : [];
      })
    ),
  ];
}

export function matchesToolSearch(tool: ToolDefinition, query: string): boolean {
  const text = [
    tool.id,
    toolDisplayName(tool),
    tool.description,
    ...(tool.tags ?? []),
    toolCapabilityFamily(tool).label,
    ...toolOperationChoices(tool),
    ...Object.keys(object(object(tool.input_schema).properties)),
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((term) => text.includes(term));
}

export function groupCapabilityTools(tools: ToolDefinition[]) {
  const unique = [...new Map(tools.map((tool) => [tool.id, tool])).values()];
  return capabilityFamilies
    .map((family) => ({
      ...family,
      tools: unique
        .filter((tool) => toolCapabilityFamily(tool).id === family.id)
        .sort((left, right) => toolDisplayName(left).localeCompare(toolDisplayName(right))),
    }))
    .filter((family) => family.tools.length > 0);
}

export function updateToolSelection(current: string[], visibleIds: string[], selected: boolean) {
  // Filtering the catalog must never remove grants outside the visible set,
  // including old IDs whose definitions are temporarily unavailable.
  const visible = new Set(visibleIds);
  return selected
    ? [...new Set([...current, ...visibleIds])]
    : current.filter((id) => !visible.has(id));
}
