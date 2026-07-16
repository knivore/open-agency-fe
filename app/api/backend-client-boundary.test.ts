import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const browserOrientedClients = [
  'apiTokensApi',
  'capabilitiesApi',
  'connectorsApi',
  'credentialsApi',
  'storageApi',
  'usersApi',
  'workflowsApi',
];

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return routeFiles(path);
    }
    return entry.name === 'route.ts' ? [path] : [];
  });
}

describe('server route backend-client boundary', () => {
  it('does not use browser-oriented clients that depend on browser auth providers', () => {
    const violations = routeFiles(join(process.cwd(), 'app/api')).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return browserOrientedClients
        .filter((client) => new RegExp(`\\b${client}\\.`).test(source))
        .map((client) => `${path.replace(`${process.cwd()}/`, '')}: ${client}`);
    });

    // Server routes must use backend-prefixed clients whose signatures require identity.
    expect(violations).toEqual([]);
  });
});
