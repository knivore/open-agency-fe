import type { ToolDefinition } from '@/types/tools';

export function isGeneratedCapability(tool: ToolDefinition) {
  return (
    tool.tags?.includes('generated_tool') ||
    String(tool.implementation?.target ?? '').startsWith('generated_tools.')
  );
}

// Apply only touched operations to a fresh snapshot so hidden, unavailable and
// concurrently added grants survive a filtered editing session.
export function applyCapabilityEdits(
  currentIds: readonly string[],
  edits: Record<string, boolean>,
  tools: readonly ToolDefinition[]
) {
  const ids = new Set(currentIds);
  for (const [id, checked] of Object.entries(edits)) {
    if (!checked) {
      ids.delete(id);
      continue;
    }
    if (ids.has(id)) continue;
    const tool = tools.find((candidate) => candidate.id === id);
    if (!tool) throw new Error('This capability is no longer available. Refresh before saving.');
    if (isGeneratedCapability(tool))
      throw new Error('New generated-tool access requires its reviewed adoption flow in Agents.');
    ids.add(id);
  }
  return [...ids];
}
