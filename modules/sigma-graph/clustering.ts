import type { SigmaGraphCluster, SigmaGraphDocument, SigmaGraphNode } from './types';

export type SigmaGraphClusterKey = (node: SigmaGraphNode) => string | null | undefined;

export function clusterSigmaGraphNodes(
  document: SigmaGraphDocument,
  key: SigmaGraphClusterKey = (node) => node.clusterId || node.type
): SigmaGraphCluster[] {
  const clusters = new Map<string, SigmaGraphCluster>();
  for (const node of document.nodes) {
    const clusterId = key(node);
    if (!clusterId) {
      continue;
    }
    const existing =
      clusters.get(clusterId) ||
      ({
        id: clusterId,
        label: clusterId,
        nodeIds: [],
        size: 0,
      } satisfies SigmaGraphCluster);
    existing.nodeIds.push(node.id);
    existing.size = existing.nodeIds.length;
    clusters.set(clusterId, existing);
  }
  return [...clusters.values()].sort(
    (left, right) => right.size - left.size || left.id.localeCompare(right.id)
  );
}
