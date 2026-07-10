import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const graphRoot = join(process.cwd(), 'modules/react-flow-graph');

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return listSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function relativeGraphPath(path: string) {
  return relative(graphRoot, path);
}

describe('graph module boundary', () => {
  it('keeps core module source free of app aliases and workflow-specific imports', () => {
    const coreFiles = listSourceFiles(graphRoot).filter((path) => {
      const relativePath = relativeGraphPath(path);
      return (
        !relativePath.startsWith('docs/') &&
        !relativePath.startsWith('examples/') &&
        !relativePath.endsWith('.test.ts') &&
        !relativePath.endsWith('.test.tsx')
      );
    });
    const violations = coreFiles
      .map((path) => ({
        path: relativeGraphPath(path),
        source: readFileSync(path, 'utf8'),
      }))
      .filter(({ source }) =>
        [
          "from '@/",
          "import('@/",
          '@/components',
          '@/lib/api/',
          '@/types/workflows',
          'workflowGraph',
          'WorkflowDefinition',
          'TaskDefinition',
          'AgentDefinition',
          'workflowsApi',
          'runsApi',
        ].some((forbidden) => source.includes(forbidden))
      )
      .map(({ path }) => path);

    expect(violations).toEqual([]);
  });
});
