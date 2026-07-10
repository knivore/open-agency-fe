import type { ToolDefinition } from '@/types/tools';
import type { WorkflowCapabilityTag } from '@/types/workflows';

const TOOL_KEYWORD_MAP: Record<WorkflowCapabilityTag, string[]> = {
  'home-control': [
    'agency.device.',
    'agency.physical.',
    'physical_devices',
    'home_assistant',
    'smart_home',
    'smart home',
    'home module',
    'entity',
    'scene',
    'light',
    'room',
    'speaker',
  ],
  vision: ['vision', 'camera', 'snapshot', 'image', 'scene analysis', 'analyse_camera'],
  voice: [
    'agency.speech.listen',
    'agency.speech.speak',
    'agency.speech.continue',
    'voice',
    'speech',
    'audio',
    'transcribe',
    'transcription',
    'microphone',
    'announce',
    'speaker',
    'listen',
    'speak',
  ],
};

function isCanonicalPhysicalDeviceTool(tool: ToolDefinition) {
  return tool.id.startsWith('agency.device.') || tool.id.startsWith('agency.physical.');
}

function isHomeAssistantTool(tool: ToolDefinition) {
  return tool.id.startsWith('home_assistant.');
}

function normalizedToolSearchText(tool: ToolDefinition) {
  return [
    tool.id,
    tool.name,
    tool.display_name,
    tool.description,
    ...(tool.tags ?? []),
    tool.tool_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function toolCapabilityTags(tool: ToolDefinition): WorkflowCapabilityTag[] {
  const searchText = normalizedToolSearchText(tool);
  const matchedTags = (
    Object.entries(TOOL_KEYWORD_MAP) as Array<[WorkflowCapabilityTag, string[]]>
  ).flatMap(([tag, keywords]) =>
    keywords.some((keyword) => searchText.includes(keyword)) ? [tag] : []
  );

  return Array.from(new Set(matchedTags));
}

export function toolsRecommendedForWorkflowCapabilities(
  tools: ToolDefinition[],
  workflowCapabilityTags: WorkflowCapabilityTag[]
) {
  if (workflowCapabilityTags.length === 0) {
    return [];
  }

  const requestedTagSet = new Set(workflowCapabilityTags);
  const matchedTools = tools
    .map((tool) => ({
      tool,
      matchedTags: toolCapabilityTags(tool).filter((tag) => requestedTagSet.has(tag)),
    }))
    .filter(({ matchedTags }) => matchedTags.length > 0);

  if (!requestedTagSet.has('home-control')) {
    return matchedTools.map(({ tool }) => tool);
  }

  const hasCanonicalPhysicalDeviceTools = matchedTools.some(({ tool }) =>
    isCanonicalPhysicalDeviceTool(tool)
  );
  if (!hasCanonicalPhysicalDeviceTools) {
    return matchedTools.map(({ tool }) => tool);
  }

  // Generic workflow builders should steer agents to Agency's canonical device
  // layer. Home Assistant tools remain available as explicit vendor-specific
  // choices, but they are not the default recommendation for generic
  // home-control needs when canonical device orchestration exists.
  return matchedTools
    .filter(
      ({ tool, matchedTags }) =>
        !(
          isHomeAssistantTool(tool) &&
          matchedTags.includes('home-control') &&
          matchedTags.every((tag) => tag === 'home-control')
        )
    )
    .map(({ tool }) => tool);
}

export function sortToolsForWorkflowCapabilities(
  tools: ToolDefinition[],
  workflowCapabilityTags: WorkflowCapabilityTag[]
) {
  const requestedTagSet = new Set(workflowCapabilityTags);

  return [...tools].sort((left, right) => {
    const leftMatches = toolCapabilityTags(left).filter((tag) => requestedTagSet.has(tag)).length;
    const rightMatches = toolCapabilityTags(right).filter((tag) => requestedTagSet.has(tag)).length;

    if (leftMatches !== rightMatches) {
      return rightMatches - leftMatches;
    }

    const leftName = left.display_name ?? left.name ?? left.id;
    const rightName = right.display_name ?? right.name ?? right.id;
    return leftName.localeCompare(rightName);
  });
}
