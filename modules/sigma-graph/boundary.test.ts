import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const moduleRoot = join(process.cwd(), 'modules/sigma-graph');

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

describe('sigma graph module boundary', () => {
  it('keeps the module free of Agency workflow and app imports', () => {
    const violations = listSourceFiles(moduleRoot)
      .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
      .map((path) => ({
        path: relative(moduleRoot, path),
        source: readFileSync(path, 'utf8'),
      }))
      .filter(({ source }) =>
        [
          "from '@/",
          '@/components',
          '@/lib/api/',
          '@xyflow/react',
          'WorkflowDefinition',
          'workflowGraph',
          'workflowsApi',
          'runsApi',
        ].some((forbidden) => source.includes(forbidden))
      )
      .map(({ path }) => path);

    expect(violations).toEqual([]);
  });
});
