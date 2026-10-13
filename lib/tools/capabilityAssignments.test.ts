import { describe, expect, it } from 'vitest';
import type { ToolDefinition } from '@/types/tools';
import { applyCapabilityEdits } from './capabilityAssignments';
const tools: ToolDefinition[] = [
  { id: 'regular', name: 'Regular', description: '' },
  { id: 'generated', name: 'Generated', description: '', tags: ['generated_tool'] },
];
describe('explicit capability grant edits', () => {
  it('preserves existing grants and applies only touched operations', () => {
    expect(
      applyCapabilityEdits(['hidden', 'old', 'concurrent'], { regular: true, old: false }, tools)
    ).toEqual(['hidden', 'concurrent', 'regular']);
  });
  it('does not bypass reviewed adoption for a new generated operation', () => {
    expect(() => applyCapabilityEdits([], { generated: true }, tools)).toThrow(/reviewed adoption/);
    expect(applyCapabilityEdits(['generated'], { generated: true }, tools)).toEqual(['generated']);
  });
  it('rejects a new operation that disappeared while the editor was open', () => {
    expect(() => applyCapabilityEdits([], { missing: true }, tools)).toThrow(/no longer available/);
    expect(applyCapabilityEdits(['missing'], {}, tools)).toEqual(['missing']);
  });
});
