import Graph from 'graphology';
import { createConstellationSigmaGraphPositions } from './layout';
import type { SigmaGraphDocument, SigmaGraphEdge, SigmaGraphNode } from './types';

export interface SigmaGraphologyOptions {
  appearance?: 'default' | 'constellation';
  theme?: 'dark' | 'light';
}

export function sigmaDocumentToGraphology(
  document: SigmaGraphDocument,
  options: SigmaGraphologyOptions = {}
) {
  const graph = new Graph({ multi: true, type: 'directed' });
  const positions =
    options.appearance === 'constellation'
      ? new Map(
          Object.entries(
            createConstellationSigmaGraphPositions(document, {
              attraction: 0.015,
              clusterGravity: 0.011,
              hubGravity: 0.007,
              iterations: 140,
              repulsion: 0.048,
              scale: 9,
            })
          )
        )
      : createCircularPositions(document.nodes);
  document.nodes.forEach((node, index) =>
    graph.addNode(
      node.id,
      sigmaNodeAttributes(
        node,
        index,
        document.nodes.length,
        positions.get(node.id),
        options.appearance,
        options.theme
      )
    )
  );
  document.edges.forEach((edge) => {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      return;
    }
    graph.addDirectedEdgeWithKey(
      edge.id,
      edge.source,
      edge.target,
      sigmaEdgeAttributes(edge, options.appearance, options.theme)
    );
  });
  return graph;
}

function sigmaNodeAttributes(
  node: SigmaGraphNode,
  index: number,
  total: number,
  fallbackPosition?: { x: number; y: number },
  appearance: SigmaGraphologyOptions['appearance'] = 'default',
  theme: SigmaGraphologyOptions['theme'] = 'dark'
) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const preferredPosition =
    appearance === 'constellation'
      ? (fallbackPosition ?? node.position)
      : (node.position ?? fallbackPosition);
  const preferredColor =
    node.color ??
    (appearance === 'constellation'
      ? constellationColorForType(node.type, theme)
      : colorForType(node.type));
  return {
    label: node.label,
    businessType: node.type,
    // Constellation mode deliberately overrides incoming coordinates so the renderer uses the
    // synthetic island layout instead of stale server or fixture positions.
    x: preferredPosition?.x ?? Math.cos(angle),
    y: preferredPosition?.y ?? Math.sin(angle),
    size: node.size ?? 6,
    color: preferredColor,
    forceLabel: (node.size ?? 0) >= 12,
    zIndex: Math.round(node.size ?? 0),
    data: node.data,
  };
}

function sigmaEdgeAttributes(
  edge: SigmaGraphEdge,
  appearance: SigmaGraphologyOptions['appearance'] = 'default',
  theme: SigmaGraphologyOptions['theme'] = 'dark'
) {
  return {
    label: edge.label || edge.type,
    businessType: edge.type,
    size: edge.size ?? 1,
    color:
      edge.color ??
      (appearance === 'constellation' ? (theme === 'light' ? '#64748b' : '#52525b') : '#64748b'),
    data: edge.data,
  };
}

function colorForType(type: string) {
  const palette = ['#2563eb', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed'];
  const index =
    Math.abs([...type].reduce((total, character) => total + character.charCodeAt(0), 0)) %
    palette.length;
  return palette[index];
}

function constellationColorForType(type: string, theme: SigmaGraphologyOptions['theme'] = 'dark') {
  const palette =
    theme === 'light'
      ? ['#0369a1', '#1d4ed8', '#0f766e', '#b45309', '#b91c1c', '#6d28d9']
      : ['#7dd3fc', '#93c5fd', '#a7f3d0', '#fcd34d', '#fca5a5', '#c4b5fd'];
  const index =
    Math.abs([...type].reduce((total, character) => total + character.charCodeAt(0), 0)) %
    palette.length;
  return palette[index];
}

function createCircularPositions(nodes: SigmaGraphNode[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const total = Math.max(nodes.length, 1);
  nodes.forEach((node, index) => {
    const angle = (index / total) * Math.PI * 2;
    positions.set(node.id, { x: Math.cos(angle), y: Math.sin(angle) });
  });
  return positions;
}
