import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();

const workflowGraphFiles = [
  'components/workflow/WorkflowGraphCanvas.tsx',
  'components/workflow/WorkflowGraphInspector.tsx',
  'components/workflow/WorkflowGraphToolbar.tsx',
  'lib/workflows/workflowGraphAdapter.ts',
];

describe('workflow graph boundary', () => {
  it('keeps graph editor wrappers free of backend clients and direct transport calls', () => {
    const forbiddenPatterns = [
      '@/lib/api/',
      'workflowsApi',
      'runsApi',
      'schedulesApi',
      'fetch(',
      'axios.',
    ];

    const violations = workflowGraphFiles.flatMap((file) => {
      const source = readFileSync(join(workspaceRoot, file), 'utf8');
      return forbiddenPatterns
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => `${file} contains ${pattern}`);
    });

    expect(violations).toEqual([]);
  });
});
