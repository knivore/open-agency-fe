import {describe, expect, it} from 'vitest';
import type {ToolDefinition} from '@/types/tools';
import {
  groupCapabilityTools,
  matchesToolSearch,
  toolAccess,
  toolCapabilityFamily,
  toolOperationChoices,
  updateToolSelection,
} from './capabilityCatalog';

const tool = (id: string, extra: Partial<ToolDefinition> = {}): ToolDefinition => ({
  id,
  name: id,
  description: 'Workflow automation and browser document memory',
  ...extra,
});

describe('capability catalog', () => {
  it('uses canonical identity instead of cross-cutting prose and counts each tool once', () => {
    const memory = tool('agency.memory.list');
    const graph = tool('agency.graph.context');
    const groups = groupCapabilityTools([memory, graph, memory]);
    expect(groups.map((group) => [group.id, group.tools.length])).toEqual([
      ['memory', 1],
      ['graph', 1],
    ]);
    expect(toolCapabilityFamily(tool('agency.workflow.memory-links.list')).id).toBe('memory');
    expect(toolCapabilityFamily(tool('agency.connector.desktop_apps')).id).toBe('browser');
  });
  it('uses explicit routing for external tools and leaves unclassified tools discoverable', () => {
    expect(
      toolCapabilityFamily(tool('external-search', {routing: {group: 'memory.read'}})).id
    ).toBe('memory');
    expect(toolCapabilityFamily(tool('external-search')).id).toBe('other');
  });
  it('does not label unknown or conflicting permissions as read only', () => {
    expect(toolAccess(tool('unknown'))).toBe('write');
    expect(toolAccess(tool('read', {security: {read_only: true}}))).toBe('read');
    expect(
      toolAccess(tool('conflict', {security: {read_only: false}, routing: {read_only: true}}))
    ).toBe('write');
    expect(
      toolAccess(tool('conflict', {security: {read_only: true}, routing: {read_only: false}}))
    ).toBe('write');
    expect(
      toolAccess(
        tool('approve', {security: {requires_approval: true}, routing: {read_only: true}})
      )
    ).toBe('approval');
    expect(toolAccess(tool('approve', {routing: {requires_confirmation: true}}))).toBe(
      'approval'
    );
  });
  it('finds parameterized operations and parameters without matching unrelated terms', () => {
    const desktop = tool('agency.connector.desktop_apps', {
      input_schema: {
        properties: {
          action: {enum: ['status', 'read', 'invoke']},
          window_id: {type: 'string'},
        },
      },
    });
    expect(toolOperationChoices(desktop)).toEqual(['status', 'read', 'invoke']);
    expect(matchesToolSearch(desktop, 'invoke window_id')).toBe(true);
    expect(matchesToolSearch(desktop, 'invoke nonexistent')).toBe(false);
  });
  it('preserves hidden and unavailable grants when selecting and clearing filtered tools', () => {
    expect(updateToolSelection(['legacy', 'memory'], ['browser', 'browser'], true)).toEqual([
      'legacy',
      'memory',
      'browser',
    ]);
    expect(updateToolSelection(['legacy', 'memory', 'browser'], ['browser'], false)).toEqual([
      'legacy',
      'memory',
    ]);
  });
});
