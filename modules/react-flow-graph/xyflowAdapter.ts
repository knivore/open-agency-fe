import type {
  Edge as XyflowEdge,
  Node as XyflowNode,
  Viewport as XyflowViewport,
} from '@xyflow/react';
import type { GraphDocument, GraphEdge, GraphNode, GraphViewport } from './types';

export interface XyflowGraphNodeData extends Record<string, unknown> {
  graphNode: GraphNode;
  label: string;
  description?: string;
}

export interface XyflowGraphEdgeData extends Record<string, unknown> {
  graphEdge: GraphEdge;
}

export type XyflowGraphNode = XyflowNode<XyflowGraphNodeData>;

export type XyflowGraphEdge = XyflowEdge<XyflowGraphEdgeData>;

const fallbackNodeDimensionsByType = {
  agent: { width: 340, height: 170 },
  approval: { width: 320, height: 150 },
  artifact: { width: 320, height: 150 },
  memory: { width: 320, height: 150 },
  task: { width: 360, height: 180 },
  tool: { width: 340, height: 160 },
  default: { width: 320, height: 160 },
} as const;

function fallbackNodeDimensions(node: GraphNode) {
  const type = node.type.toLowerCase();

  if (type.includes('agent')) {
    return fallbackNodeDimensionsByType.agent;
  }
  if (type.includes('approval')) {
    return fallbackNodeDimensionsByType.approval;
  }
  if (type.includes('artifact')) {
    return fallbackNodeDimensionsByType.artifact;
  }
  if (type.includes('memory')) {
    return fallbackNodeDimensionsByType.memory;
  }
  if (type.includes('task')) {
    return fallbackNodeDimensionsByType.task;
  }
  if (type.includes('tool')) {
    return fallbackNodeDimensionsByType.tool;
  }

  return fallbackNodeDimensionsByType.default;
}

export function graphNodeToXyflowNode(node: GraphNode): XyflowGraphNode {
  const fallbackDimensions = fallbackNodeDimensions(node);

  return {
    id: node.id,
    type: 'graphNode',
    position: node.position ?? { x: 0, y: 0 },
    width: node.size?.width,
    height: node.size?.height,
    // React Flow's minimap ignores custom nodes until dimensions are known.
    // Initial dimensions give it a stable silhouette without persisting size.
    initialWidth: node.size?.width ?? fallbackDimensions.width,
    initialHeight: node.size?.height ?? fallbackDimensions.height,
    data: {
      graphNode: node,
      label: node.label,
      description: node.description,
    },
    className: node.style?.className,
    style: {
      color: node.style?.color,
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      padding: 0,
    },
  };
}

export function graphEdgeToXyflowEdge(edge: GraphEdge): XyflowGraphEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: 'graphEdge',
    label: edge.label,
    interactionWidth: 32,
    data: {
      graphEdge: edge,
    },
    className: edge.style?.className,
    style: {
      stroke: edge.style?.borderColor ?? edge.style?.color,
    },
  };
}

export function graphDocumentToXyflow(document: GraphDocument) {
  return {
    nodes: document.nodes.map(graphNodeToXyflowNode),
    edges: document.edges.map(graphEdgeToXyflowEdge),
    viewport: document.viewport ? graphViewportToXyflowViewport(document.viewport) : undefined,
  };
}

export function xyflowNodeToGraphNode(node: XyflowGraphNode): GraphNode {
  return {
    ...node.data.graphNode,
    id: node.id,
    type: node.data.graphNode.type,
    position: node.position,
    size:
      typeof node.width === 'number' && typeof node.height === 'number'
        ? { width: node.width, height: node.height }
        : node.data.graphNode.size,
  };
}

export function xyflowEdgeToGraphEdge(edge: XyflowGraphEdge): GraphEdge {
  const graphEdge = edge.data?.graphEdge;

  return {
    ...graphEdge,
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: graphEdge?.type ?? edge.type ?? 'default',
    label: typeof edge.label === 'string' ? edge.label : graphEdge?.label,
  };
}

export function xyflowViewportToGraphViewport(viewport: XyflowViewport): GraphViewport {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}

export function graphViewportToXyflowViewport(viewport: GraphViewport): XyflowViewport {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}
