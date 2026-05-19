import type { ToolDefinition } from '@/types/tools';

const ACRONYMS = new Set([
  'a2a',
  'api',
  'cli',
  'csv',
  'docx',
  'html',
  'http',
  'json',
  'llm',
  'mcp',
  'pdf',
  'sql',
  'txt',
  'ui',
  'url',
  'xml',
  'yaml',
]);

const LOWERCASE_WORDS = new Set(['a', 'an', 'and', 'as', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

export function formatToolDisplayName(value: string): string {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return value;
  }

  return words
    .map((word, index) => {
      const normalized = word.toLowerCase();
      if (ACRONYMS.has(normalized)) return word.toUpperCase();
      if (index > 0 && LOWERCASE_WORDS.has(normalized)) return normalized;
      return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

export function toolDisplayName(tool: Pick<ToolDefinition, 'name' | 'display_name'>): string {
  return tool.display_name?.trim() || formatToolDisplayName(tool.name);
}
