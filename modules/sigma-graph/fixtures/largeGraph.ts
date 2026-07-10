import type { SigmaGraphDocument, SigmaGraphEdge, SigmaGraphNode } from '../types';

const nodeTypes = ['Agent', 'WorkflowRun', 'StepRun', 'Tool', 'Memory', 'Entity'];
const edgeTypes = ['RAN', 'EXECUTED_STEP', 'USED_TOOL', 'WROTE_MEMORY', 'MENTIONS'];

export interface LargeSigmaGraphFixtureOptions {
  nodeCount?: number;
  edgeCount?: number;
  topology?: 'archipelago' | 'dense-core' | 'halo';
}

export function createLargeSigmaGraphFixture(
  options: LargeSigmaGraphFixtureOptions = {}
): SigmaGraphDocument {
  const nodeCount = options.nodeCount ?? 160;
  const edgeCount = options.edgeCount ?? 280;
  const topology = options.topology ?? 'dense-core';
  const clusterCount = topology === 'archipelago' ? 10 : topology === 'halo' ? 12 : 8;
  const archipelagoHaloStart =
    topology === 'archipelago' ? Math.floor(nodeCount * 0.82) : nodeCount;
  const nodes: SigmaGraphNode[] = Array.from({ length: nodeCount }, (_, index) => {
    const type = nodeTypes[index % nodeTypes.length];
    const ring = Math.floor(index / nodeTypes.length) + 1;
    const angle = (index / Math.max(nodeCount, 1)) * Math.PI * 2;
    const clusterId = resolveClusterId(index, clusterCount, topology, archipelagoHaloStart);
    return {
      id: `fixture-node-${index}`,
      type,
      label: `${type} ${index + 1}`,
      size: type === 'Agent' ? 9 : 5 + (index % 4),
      position: {
        x: Math.cos(angle) * ring * 9,
        y: Math.sin(angle) * ring * 9,
      },
      clusterId,
      startedAt: `2026-05-24T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      data: {
        source: 'sigma-graph-large-fixture',
        sequence: index,
      },
    };
  });

  const edges = createFixtureEdges({ edgeCount, nodeCount, nodes, topology });

  return {
    schemaVersion: 'sigma-graph/v1',
    id: 'sigma-large-fixture',
    title: 'Sigma Large Fixture',
    nodes,
    edges,
    metadata: {
      purpose: 'browser-render-smoke',
      generated: true,
    },
  };
}

function createFixtureEdges({
  edgeCount,
  nodeCount,
  nodes,
  topology,
}: {
  edgeCount: number;
  nodeCount: number;
  nodes: SigmaGraphNode[];
  topology: NonNullable<LargeSigmaGraphFixtureOptions['topology']>;
}) {
  const edges: SigmaGraphEdge[] = [];
  const nodeIdsByCluster = new Map<string, number[]>();
  nodes.forEach((node, index) => {
    const clusterNodes = nodeIdsByCluster.get(node.clusterId || 'cluster-0') || [];
    clusterNodes.push(index);
    nodeIdsByCluster.set(node.clusterId || 'cluster-0', clusterNodes);
  });
  const clusterEntries = [...nodeIdsByCluster.entries()].sort((left, right) =>
    left[0].localeCompare(right[0])
  );
  const islandCoreEntries = clusterEntries.filter(([clusterId]) => clusterId.startsWith('island-'));
  const islandHaloEntries = clusterEntries.filter(([clusterId]) => clusterId.startsWith('halo-'));
  const islandHubByCluster = new Map<string, number>(
    islandCoreEntries.map(([clusterId, indices]) => [clusterId, indices[0] ?? 0])
  );

  for (let index = 0; index < edgeCount; index += 1) {
    const sourceIndex = index % nodeCount;
    const sourceNode = nodes[sourceIndex];
    const clusterNodes = nodeIdsByCluster.get(sourceNode.clusterId || 'cluster-0') || [sourceIndex];
    const sourceClusterIndex = clusterEntries.findIndex(
      ([clusterId]) => clusterId === sourceNode.clusterId
    );
    let targetIndex = sourceIndex;

    if (topology === 'archipelago') {
      if ((sourceNode.clusterId || '').startsWith('halo-')) {
        const haloNumber = Number((sourceNode.clusterId || 'halo-0').split('-')[1] || 0);
        targetIndex = islandHubByCluster.get(`island-${haloNumber}`) ?? sourceIndex;
      } else if (index % 17 === 0) {
        const neighborCluster =
          islandCoreEntries[(sourceClusterIndex + 1) % islandCoreEntries.length]?.[1] ||
          clusterNodes;
        targetIndex = neighborCluster[(index * 3 + 5) % neighborCluster.length] ?? sourceIndex;
      } else if (index % 31 === 0 && islandHaloEntries.length > 0) {
        const haloCluster =
          islandHaloEntries[sourceClusterIndex % islandHaloEntries.length]?.[1] || clusterNodes;
        targetIndex = haloCluster[(index * 5 + 1) % haloCluster.length] ?? sourceIndex;
      } else {
        const islandHub =
          islandHubByCluster.get(sourceNode.clusterId || '') ?? clusterNodes[0] ?? sourceIndex;
        targetIndex =
          index % 4 === 0
            ? islandHub
            : (clusterNodes[(index * 5 + 3) % clusterNodes.length] ?? sourceIndex);
      }
    } else if (topology === 'halo') {
      if (index % 7 === 0) {
        targetIndex = 0;
      } else if (sourceIndex === 0) {
        targetIndex = (index * 11 + 17) % nodeCount;
      } else {
        targetIndex = clusterNodes[(index * 3 + 1) % clusterNodes.length] ?? sourceIndex;
      }
    } else {
      if (index % 6 === 0) {
        targetIndex = (index * 11 + 19) % nodeCount;
      } else {
        targetIndex = clusterNodes[(index * 7 + 13) % clusterNodes.length] ?? sourceIndex;
      }
    }

    if (targetIndex === sourceIndex) {
      targetIndex = (targetIndex + 1) % nodeCount;
    }

    edges.push({
      id: `fixture-edge-${index}`,
      source: `fixture-node-${sourceIndex}`,
      target: `fixture-node-${targetIndex}`,
      type: edgeTypes[index % edgeTypes.length],
      label: edgeTypes[index % edgeTypes.length],
      size: topology === 'dense-core' && index % 14 === 0 ? 2 : 1,
      startedAt: `2026-05-24T${String(index % 24).padStart(2, '0')}:30:00.000Z`,
      data: {
        source: 'sigma-graph-large-fixture',
        sequence: index,
      },
    });
  }

  return edges;
}

function resolveClusterId(
  index: number,
  clusterCount: number,
  topology: NonNullable<LargeSigmaGraphFixtureOptions['topology']>,
  archipelagoHaloStart: number
) {
  if (topology === 'archipelago' && index >= archipelagoHaloStart) {
    return `halo-${index % clusterCount}`;
  }
  if (topology === 'halo' && index < Math.max(clusterCount, 12)) {
    return `halo-spoke-${index % clusterCount}`;
  }
  if (topology === 'archipelago') {
    return `island-${index % clusterCount}`;
  }
  return `cluster-${index % clusterCount}`;
}
