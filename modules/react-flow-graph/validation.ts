import type {
  GraphDocument,
  GraphDocumentValidator,
  GraphEdge,
  GraphEdgeTypeDescriptor,
  GraphModuleConfig,
  GraphNode,
  GraphNodeTypeDescriptor,
  GraphValidationContext,
  GraphValidationIssue,
  GraphValidationSeverity,
  GraphValidationTarget,
} from './types';
import { createGraphId } from './ids';

export interface ValidateGraphDocumentOptions {
  nodeTypes?: Record<string, GraphNodeTypeDescriptor>;
  edgeTypes?: Record<string, GraphEdgeTypeDescriptor>;
  validators?: GraphDocumentValidator[];
  allowUnknownNodeTypes?: boolean;
  allowUnknownEdgeTypes?: boolean;
}

function validationIssue(
  code: string,
  message: string,
  target: GraphValidationTarget,
  options: {
    severity?: GraphValidationSeverity;
    targetId?: string;
    path?: string;
  } = {}
): GraphValidationIssue {
  return {
    id: createGraphId([code, target, options.targetId, options.path].join(':'), {
      prefix: 'issue',
    }),
    severity: options.severity ?? 'error',
    code,
    message,
    target,
    targetId: options.targetId,
    path: options.path,
  };
}

function findDuplicateIds<TItem>(
  items: TItem[],
  getId: (item: TItem) => string,
  pathPrefix: string
) {
  const seen = new Map<string, number>();
  const duplicates: Array<{
    id: string;
    firstIndex: number;
    duplicateIndex: number;
    path: string;
  }> = [];

  items.forEach((item, index) => {
    const id = getId(item);
    if (!id) {
      return;
    }

    const firstIndex = seen.get(id);
    if (typeof firstIndex === 'number') {
      duplicates.push({
        id,
        firstIndex,
        duplicateIndex: index,
        path: `${pathPrefix}.${index}.id`,
      });
      return;
    }

    seen.set(id, index);
  });

  return duplicates;
}

function validateNode(
  node: GraphNode,
  index: number,
  context: GraphValidationContext,
  options: ValidateGraphDocumentOptions
) {
  const issues: GraphValidationIssue[] = [];

  if (!node.id?.trim()) {
    issues.push(
      validationIssue('node.missing_id', 'Node is missing an id.', 'node', {
        path: `nodes.${index}.id`,
      })
    );
  }

  if (!node.type?.trim()) {
    issues.push(
      validationIssue('node.missing_type', 'Node is missing a type.', 'node', {
        targetId: node.id,
        path: `nodes.${index}.type`,
      })
    );
  } else if (
    !options.allowUnknownNodeTypes &&
    Object.keys(context.nodeTypes).length > 0 &&
    !context.nodeTypes[node.type]
  ) {
    issues.push(
      validationIssue(
        'node.unsupported_type',
        `Node type "${node.type}" is not registered.`,
        'node',
        {
          targetId: node.id,
          path: `nodes.${index}.type`,
        }
      )
    );
  }

  if (!node.label?.trim()) {
    issues.push(
      validationIssue('node.missing_label', 'Node is missing a label.', 'node', {
        targetId: node.id,
        path: `nodes.${index}.label`,
      })
    );
  }

  const descriptor = node.type ? context.nodeTypes[node.type] : undefined;
  if (descriptor?.validate) {
    issues.push(...descriptor.validate(node, context));
  }

  return issues;
}
function validateEdge(
  edge: GraphEdge,
  index: number,
  nodeIds: Set<string>,
  context: GraphValidationContext,
  options: ValidateGraphDocumentOptions
) {
  const issues: GraphValidationIssue[] = [];

  if (!edge.id?.trim()) {
    issues.push(
      validationIssue('edge.missing_id', 'Edge is missing an id.', 'edge', {
        path: `edges.${index}.id`,
      })
    );
  }

  if (!edge.type?.trim()) {
    issues.push(
      validationIssue('edge.missing_type', 'Edge is missing a type.', 'edge', {
        targetId: edge.id,
        path: `edges.${index}.type`,
      })
    );
  } else if (
    !options.allowUnknownEdgeTypes &&
    Object.keys(context.edgeTypes).length > 0 &&
    !context.edgeTypes[edge.type]
  ) {
    issues.push(
      validationIssue(
        'edge.unsupported_type',
        `Edge type "${edge.type}" is not registered.`,
        'edge',
        {
          targetId: edge.id,
          path: `edges.${index}.type`,
        }
      )
    );
  }

  if (!edge.source?.trim()) {
    issues.push(
      validationIssue('edge.missing_source', 'Edge is missing a source node id.', 'edge', {
        targetId: edge.id,
        path: `edges.${index}.source`,
      })
    );
  } else if (!nodeIds.has(edge.source)) {
    issues.push(
      validationIssue(
        'edge.dangling_source',
        `Edge source "${edge.source}" does not exist.`,
        'edge',
        {
          targetId: edge.id,
          path: `edges.${index}.source`,
        }
      )
    );
  }

  if (!edge.target?.trim()) {
    issues.push(
      validationIssue('edge.missing_target', 'Edge is missing a target node id.', 'edge', {
        targetId: edge.id,
        path: `edges.${index}.target`,
      })
    );
  } else if (!nodeIds.has(edge.target)) {
    issues.push(
      validationIssue(
        'edge.dangling_target',
        `Edge target "${edge.target}" does not exist.`,
        'edge',
        {
          targetId: edge.id,
          path: `edges.${index}.target`,
        }
      )
    );
  }

  const descriptor = edge.type ? context.edgeTypes[edge.type] : undefined;
  if (descriptor?.validate) {
    issues.push(...descriptor.validate(edge, context));
  }

  return issues;
}

export function validateGraphDocument(
  document: GraphDocument,
  options: ValidateGraphDocumentOptions | GraphModuleConfig = {}
) {
  const nodeTypes = options.nodeTypes ?? {};
  const edgeTypes = options.edgeTypes ?? {};
  const context: GraphValidationContext = {
    document,
    nodeTypes,
    edgeTypes,
  };
  const issues: GraphValidationIssue[] = [];
  const nodeIds = new Set(document.nodes.map((node) => node.id).filter(Boolean));

  if (!document.schemaVersion?.trim()) {
    issues.push(
      validationIssue(
        'document.missing_schema_version',
        'Graph document is missing a schema version.',
        'document',
        { path: 'schemaVersion' }
      )
    );
  }

  findDuplicateIds(document.nodes, (node) => node.id, 'nodes').forEach((duplicate) => {
    issues.push(
      validationIssue('node.duplicate_id', `Node id "${duplicate.id}" is duplicated.`, 'node', {
        targetId: duplicate.id,
        path: duplicate.path,
      })
    );
  });

  findDuplicateIds(document.edges, (edge) => edge.id, 'edges').forEach((duplicate) => {
    issues.push(
      validationIssue('edge.duplicate_id', `Edge id "${duplicate.id}" is duplicated.`, 'edge', {
        targetId: duplicate.id,
        path: duplicate.path,
      })
    );
  });

  document.nodes.forEach((node, index) => {
    issues.push(...validateNode(node, index, context, options));
  });

  document.edges.forEach((edge, index) => {
    issues.push(...validateEdge(edge, index, nodeIds, context, options));
  });

  for (const validator of options.validators ?? []) {
    issues.push(...validator(context));
  }

  return issues;
}
