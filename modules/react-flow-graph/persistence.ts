import type { GraphDocument, GraphEdge, GraphNode } from './types';

export const graphDocumentSchemaVersion = 'graph.document.v1';

export interface GraphDocumentMigration {
  from: string;
  to: string;
  migrate: (document: GraphDocument) => GraphDocument;
}

export interface ParseGraphDocumentJsonOptions {
  migrations?: GraphDocumentMigration[];
  targetSchemaVersion?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isGraphNode(value: unknown): value is GraphNode {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.label === 'string'
  );
}

function isGraphEdge(value: unknown): value is GraphEdge {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.target === 'string' &&
    typeof value.type === 'string'
  );
}

export function isGraphDocument(value: unknown): value is GraphDocument {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    value.nodes.every(isGraphNode) &&
    value.edges.every(isGraphEdge)
  );
}

export function normalizeGraphDocument(value: unknown): GraphDocument {
  if (!isGraphDocument(value)) {
    throw new Error('Invalid graph document.');
  }

  return {
    ...value,
    schemaVersion:
      typeof value.schemaVersion === 'string' ? value.schemaVersion : graphDocumentSchemaVersion,
  };
}

export function migrateGraphDocument(
  document: GraphDocument,
  migrations: GraphDocumentMigration[] = [],
  targetSchemaVersion = graphDocumentSchemaVersion
): GraphDocument {
  let currentDocument = normalizeGraphDocument(document);
  const migrationByFromVersion = new Map(
    migrations.map((migration) => [migration.from, migration])
  );

  while (currentDocument.schemaVersion !== targetSchemaVersion) {
    const migration = migrationByFromVersion.get(currentDocument.schemaVersion);
    if (!migration) {
      throw new Error(
        `No graph document migration from ${currentDocument.schemaVersion} to ${targetSchemaVersion}.`
      );
    }

    currentDocument = normalizeGraphDocument({
      ...migration.migrate(currentDocument),
      schemaVersion: migration.to,
    });
  }

  return currentDocument;
}

export function parseGraphDocumentJson(
  value: string,
  options: ParseGraphDocumentJsonOptions = {}
): GraphDocument {
  const parsed = JSON.parse(value) as unknown;
  const document = normalizeGraphDocument(parsed);
  return migrateGraphDocument(
    document,
    options.migrations,
    options.targetSchemaVersion ?? graphDocumentSchemaVersion
  );
}

export function stringifyGraphDocument(document: GraphDocument, space = 2): string {
  return JSON.stringify(normalizeGraphDocument(document), null, space);
}
