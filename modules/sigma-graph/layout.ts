import type {
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphLayoutEngine,
  SigmaGraphLayoutRequest,
  SigmaGraphLayoutResult,
  SigmaGraphNode,
} from './types';

export class CircleSigmaGraphLayoutEngine implements SigmaGraphLayoutEngine {
  id = 'circle';

  async run(
    document: SigmaGraphDocument,
    request: SigmaGraphLayoutRequest
  ): Promise<SigmaGraphLayoutResult> {
    const radius = Number(request.options?.radius || 320);
    const centerX = Number(request.options?.centerX || 0);
    const centerY = Number(request.options?.centerY || 0);
    const total = Math.max(document.nodes.length, 1);
    const positions: SigmaGraphLayoutResult['positions'] = {};
    document.nodes.forEach((node, index) => {
      const angle = (index / total) * Math.PI * 2;
      positions[node.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
    return { positions, metadata: { algorithm: this.id } };
  }
}

export class ConstellationSigmaGraphLayoutEngine implements SigmaGraphLayoutEngine {
  id = 'forceatlas2';

  async run(
    document: SigmaGraphDocument,
    request: SigmaGraphLayoutRequest
  ): Promise<SigmaGraphLayoutResult> {
    const positions = createConstellationSigmaGraphPositions(document, request.options);
    return {
      positions,
      metadata: {
        algorithm: this.id,
        iterations: Number(request.options?.iterations || 120),
      },
    };
  }
}

export function applySigmaGraphLayout(
  document: SigmaGraphDocument,
  result: SigmaGraphLayoutResult
): SigmaGraphDocument {
  return {
    ...document,
    nodes: document.nodes.map((node) => ({
      ...node,
      position: result.positions[node.id] || node.position,
    })),
  };
}

export function createConstellationSigmaGraphPositions(
  document: SigmaGraphDocument,
  options?: Record<string, unknown>
) {
  const layoutDensity = constellationLayoutDensity(document);
  const iterations = clampNumber(options?.iterations, 60, 220, 120);
  const attraction = clampNumber(options?.attraction, 0.002, 0.04, 0.014);
  const clusterGravity = clampNumber(options?.clusterGravity, 0.002, 0.04, 0.012);
  const repulsion = clampNumber(options?.repulsion, 0.002, 0.2, 0.045);
  const hubGravity = clampNumber(options?.hubGravity, 0.001, 0.03, 0.008);
  const scale = clampNumber(options?.scale, 4, 18, 9) * layoutDensity.outputScale;
  const positions: SigmaGraphLayoutResult['positions'] = {};
  if (document.nodes.length === 0) {
    return positions;
  }

  const adjacency = buildAdjacency(document.edges);
  const workflowRunGroups = buildWorkflowRunGroups(document.nodes, document.edges);
  const clusterLookup = buildClusterLookup(document.nodes, workflowRunGroups);
  const clusterCenters = seedClusterCenters(clusterLookup, layoutDensity);
  const workflowRunOrbit = buildWorkflowRunOrbit(workflowRunGroups, clusterLookup, clusterCenters);
  const degrees = new Map<string, number>();
  const nodeStates = document.nodes.map((node, index) => {
    const degree = adjacency.get(node.id)?.size || 0;
    degrees.set(node.id, degree);
    const seededPosition = seedNodePosition({
      clusterCenter: clusterCenters.get(clusterLookup.get(node.id) || 'other') || { x: 0, y: 0 },
      clusterIndex: index,
      degree,
      layoutDensity,
      node,
      workflowRunOrbit,
    });
    return {
      anchor: seededPosition,
      degree,
      id: node.id,
      mass: Math.max(1, (node.size || 1) * 0.12 + degree * 0.05),
      // Constellation mode intentionally recomputes positions from scratch so fixture or
      // server-provided coordinates do not collapse the seeded island layout back into a blob.
      position: seededPosition,
      velocity: { x: 0, y: 0 },
    };
  });

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const cooling = 1 - iteration / iterations;
    const nodeCount = nodeStates.length;
    const forces = nodeStates.map(() => ({ x: 0, y: 0 }));

    for (let leftIndex = 0; leftIndex < nodeCount; leftIndex += 1) {
      const leftState = nodeStates[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < nodeCount; rightIndex += 1) {
        const rightState = nodeStates[rightIndex];
        const dx = rightState.position.x - leftState.position.x;
        const dy = rightState.position.y - leftState.position.y;
        const distanceSquared = Math.max(dx * dx + dy * dy, 0.0001);
        const distance = Math.sqrt(distanceSquared);
        const leftClusterId = clusterLookup.get(leftState.id) || 'other';
        const rightClusterId = clusterLookup.get(rightState.id) || 'other';
        const sameCluster = leftClusterId === rightClusterId;
        const workflowOrbitCluster = sameCluster && leftClusterId.startsWith('workflow-orbit:');
        const repulsionMultiplier = layoutDensity.archipelagoSpread
          ? sameCluster
            ? 0.72
            : 1.7
          : workflowOrbitCluster
            ? 0.22
            : sameCluster
              ? 0.55
              : 1;
        const repulsiveForce =
          (repulsion * repulsionMultiplier) / (distanceSquared / Math.max(cooling, 0.2) + 0.15);
        const forceX = (dx / distance) * repulsiveForce;
        const forceY = (dy / distance) * repulsiveForce;
        forces[leftIndex].x -= forceX;
        forces[leftIndex].y -= forceY;
        forces[rightIndex].x += forceX;
        forces[rightIndex].y += forceY;
      }
    }

    const stateIndex = new Map(nodeStates.map((state, index) => [state.id, index]));
    for (const edge of document.edges) {
      const sourceIndex = stateIndex.get(edge.source);
      const targetIndex = stateIndex.get(edge.target);
      if (sourceIndex === undefined || targetIndex === undefined || sourceIndex === targetIndex) {
        continue;
      }
      const sourceState = nodeStates[sourceIndex];
      const targetState = nodeStates[targetIndex];
      const dx = targetState.position.x - sourceState.position.x;
      const dy = targetState.position.y - sourceState.position.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.0001);
      const sameCluster = clusterLookup.get(sourceState.id) === clusterLookup.get(targetState.id);
      const idealLength = idealEdgeLength(edge, sourceState.degree, targetState.degree);
      const edgeLengthMultiplier = layoutDensity.archipelagoSpread && !sameCluster ? 1.4 : 1;
      const springStrengthMultiplier = layoutDensity.archipelagoSpread && !sameCluster ? 0.28 : 1;
      const springForce =
        (distance - idealLength * layoutDensity.edgeLengthMultiplier * edgeLengthMultiplier) *
        attraction *
        springStrengthMultiplier *
        edgeStrength(edge);
      const forceX = (dx / distance) * springForce;
      const forceY = (dy / distance) * springForce;
      forces[sourceIndex].x += forceX;
      forces[sourceIndex].y += forceY;
      forces[targetIndex].x -= forceX;
      forces[targetIndex].y -= forceY;
    }

    nodeStates.forEach((state, index) => {
      const clusterId = clusterLookup.get(state.id) || 'other';
      const clusterCenter = clusterCenters.get(clusterId) || { x: 0, y: 0 };
      const workflowAnchor = workflowRunOrbit.workflowAnchorByNodeId.get(state.id);
      const workflowRunAnchor = workflowRunOrbit.runAnchorByNodeId.get(state.id);
      const workflowOrbitCluster = clusterId.startsWith('workflow-orbit:');
      const hubBias = Math.min(state.degree * 0.025, 0.2);
      const anchorPull = layoutDensity.archipelagoSpread ? 0.02 : 0;
      forces[index].x +=
        (clusterCenter.x - state.position.x) *
        ((clusterGravity + (workflowOrbitCluster ? 0.008 : 0)) * layoutDensity.clusterPull +
          hubBias * hubGravity);
      forces[index].y +=
        (clusterCenter.y - state.position.y) *
        ((clusterGravity + (workflowOrbitCluster ? 0.008 : 0)) * layoutDensity.clusterPull +
          hubBias * hubGravity);
      if (workflowAnchor) {
        forces[index].x += (workflowAnchor.x - state.position.x) * 0.2;
        forces[index].y += (workflowAnchor.y - state.position.y) * 0.2;
      }
      if (workflowRunAnchor) {
        forces[index].x += (workflowRunAnchor.x - state.position.x) * 0.16;
        forces[index].y += (workflowRunAnchor.y - state.position.y) * 0.16;
      }
      forces[index].x += (state.anchor.x - state.position.x) * anchorPull;
      forces[index].y += (state.anchor.y - state.position.y) * anchorPull;

      state.velocity.x = (state.velocity.x + forces[index].x / state.mass) * 0.84;
      state.velocity.y = (state.velocity.y + forces[index].y / state.mass) * 0.84;
      state.position.x += state.velocity.x * cooling * scale;
      state.position.y += state.velocity.y * cooling * scale;
    });
  }

  normalizeNodePositions(nodeStates, scale);
  tightenWorkflowRunNeighborhoods(nodeStates, workflowRunGroups);
  nodeStates.forEach((state) => {
    positions[state.id] = state.position;
  });
  return positions;
}

interface ConstellationNodeState {
  anchor: { x: number; y: number };
  degree: number;
  id: string;
  mass: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

interface ConstellationLayoutDensity {
  archipelagoSpread: boolean;
  clusterPull: number;
  edgeLengthMultiplier: number;
  outputScale: number;
  seedRadius: number;
  seedRingGap: number;
}

interface WorkflowRunOrbit {
  workflowAnchorByNodeId: Map<string, { x: number; y: number }>;
  runAnchorByNodeId: Map<string, { x: number; y: number }>;
}

interface WorkflowRunGroups {
  runIdsByWorkflowId: Map<string, string[]>;
  workflowNodeById: Map<string, SigmaGraphNode>;
}

function buildAdjacency(edges: SigmaGraphEdge[]) {
  const adjacency = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    const source = adjacency.get(edge.source) || new Set<string>();
    const target = adjacency.get(edge.target) || new Set<string>();
    source.add(edge.target);
    target.add(edge.source);
    adjacency.set(edge.source, source);
    adjacency.set(edge.target, target);
  });
  return adjacency;
}

function buildWorkflowRunGroups(
  nodes: SigmaGraphNode[],
  edges: SigmaGraphEdge[]
): WorkflowRunGroups {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const runIdsByWorkflowId = new Map<string, string[]>();
  const workflowNodeById = new Map<string, SigmaGraphNode>();

  edges.forEach((edge) => {
    if (edge.type !== 'STARTED') {
      return;
    }
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (
      !sourceNode ||
      !targetNode ||
      sourceNode.type !== 'Workflow' ||
      !isRunLikeNode(targetNode)
    ) {
      return;
    }
    workflowNodeById.set(sourceNode.id, sourceNode);
    const workflowRuns = runIdsByWorkflowId.get(sourceNode.id) || [];
    workflowRuns.push(targetNode.id);
    runIdsByWorkflowId.set(sourceNode.id, workflowRuns);
  });

  return { runIdsByWorkflowId, workflowNodeById };
}

function buildWorkflowRunOrbit(
  workflowRunGroups: WorkflowRunGroups,
  clusterLookup: Map<string, string>,
  clusterCenters: Map<string, { x: number; y: number }>
): WorkflowRunOrbit {
  const { runIdsByWorkflowId } = workflowRunGroups;

  const runAnchorByNodeId = new Map<string, { x: number; y: number }>();
  const workflowAnchorByNodeId = new Map<string, { x: number; y: number }>();
  [...runIdsByWorkflowId.entries()].forEach(([workflowId, runIds], workflowIndex) => {
    const workflowPhase = seededUnit(`workflow-orbit:${workflowId}`) * Math.PI * 2;
    const orbitRadius = 0.92 + Math.min(runIds.length * 0.1, 0.72);
    const workflowClusterCenter = clusterCenters.get(clusterLookup.get(workflowId) || 'other') || {
      x: 0,
      y: 0,
    };
    workflowAnchorByNodeId.set(workflowId, workflowClusterCenter);
    runIds
      .slice()
      .sort((left, right) => left.localeCompare(right))
      .forEach((runId, runIndex) => {
        const angle =
          workflowPhase +
          (runIndex / Math.max(runIds.length, 1)) * Math.PI * 2 +
          workflowIndex * 0.22;
        runAnchorByNodeId.set(runId, {
          x: workflowClusterCenter.x + Math.cos(angle) * orbitRadius,
          y: workflowClusterCenter.y + Math.sin(angle) * orbitRadius,
        });
      });
  });

  return { runAnchorByNodeId, workflowAnchorByNodeId };
}

function buildClusterLookup(nodes: SigmaGraphNode[], workflowRunGroups: WorkflowRunGroups) {
  const lookup = new Map<string, string>();
  const workflowClusterByRunId = new Map<string, string>();
  workflowRunGroups.runIdsByWorkflowId.forEach((runIds, workflowId) => {
    const clusterId = `workflow-orbit:${workflowId}`;
    lookup.set(workflowId, clusterId);
    runIds.forEach((runId) => {
      workflowClusterByRunId.set(runId, clusterId);
    });
  });
  nodes.forEach((node) => {
    lookup.set(
      node.id,
      workflowClusterByRunId.get(node.id) ||
        lookup.get(node.id) ||
        stringValue(node.clusterId) ||
        stringValue(node.metadata?.agencyGraphNodeCategory) ||
        stringValue(node.metadata?.agencyGraphRawNodeType) ||
        node.type ||
        'other'
    );
  });
  return lookup;
}

function seedClusterCenters(
  clusterLookup: Map<string, string>,
  layoutDensity: ConstellationLayoutDensity
) {
  const clusters = [...new Set(clusterLookup.values())].sort();
  const centers = new Map<string, { x: number; y: number }>();
  clusters.forEach((clusterId, index) => {
    const islandLike = clusterId.startsWith('island-') || clusterId.startsWith('halo-');
    const angle =
      layoutDensity.archipelagoSpread && islandLike
        ? archipelagoAngleForCluster(clusterId, clusters.length)
        : clusters.length <= 1
          ? 0
          : (index / clusters.length) * Math.PI * 2;
    const ring =
      layoutDensity.archipelagoSpread && islandLike
        ? archipelagoRingForCluster(clusterId, index, layoutDensity)
        : index === 0
          ? 0
          : 3.8 + Math.floor((index - 1) / 6) * layoutDensity.seedRingGap;
    centers.set(clusterId, {
      x: Math.cos(angle) * ring,
      y: Math.sin(angle) * ring,
    });
  });
  return centers;
}

function seedNodePosition({
  clusterCenter,
  clusterIndex,
  degree,
  layoutDensity,
  node,
  workflowRunOrbit,
}: {
  clusterCenter: { x: number; y: number };
  clusterIndex: number;
  degree: number;
  layoutDensity: ConstellationLayoutDensity;
  node: SigmaGraphNode;
  workflowRunOrbit: WorkflowRunOrbit;
}) {
  const workflowAnchor = workflowRunOrbit.workflowAnchorByNodeId.get(node.id);
  if (workflowAnchor) {
    return workflowAnchor;
  }
  const workflowRunAnchor = workflowRunOrbit.runAnchorByNodeId.get(node.id);
  if (workflowRunAnchor) {
    return workflowRunAnchor;
  }
  // The seeded spiral keeps layout deterministic while still giving the force pass enough asymmetry
  // to separate components into dense "star fields" instead of a uniform ring.
  const phase = seededUnit(`${node.id}:${node.type}:${clusterIndex}`) * Math.PI * 2;
  const radius =
    0.28 + Math.sqrt(clusterIndex + 1) * layoutDensity.seedRadius + Math.min(degree * 0.032, 0.22);
  return {
    x: clusterCenter.x + Math.cos(phase + clusterIndex * 2.399963229728653) * radius,
    y: clusterCenter.y + Math.sin(phase + clusterIndex * 2.399963229728653) * radius,
  };
}

function idealEdgeLength(edge: SigmaGraphEdge, sourceDegree: number, targetDegree: number) {
  const baseLength = 0.95 + Math.min((sourceDegree + targetDegree) * 0.015, 0.35);
  const relationshipType = edge.type.toLowerCase();
  if (relationshipType.includes('follow') || relationshipType.includes('event')) {
    return baseLength * 0.82;
  }
  if (relationshipType.includes('failed') || relationshipType.includes('approval')) {
    return baseLength * 1.08;
  }
  return baseLength;
}

function edgeStrength(edge: SigmaGraphEdge) {
  if ((edge.size || 1) >= 2) {
    return 1.15;
  }
  return 1;
}

function normalizeNodePositions(nodeStates: ConstellationNodeState[], scale: number) {
  const xs = nodeStates.map((state) => state.position.x);
  const ys = nodeStates.map((state) => state.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const dominantDimension = Math.max(width, height);

  nodeStates.forEach((state) => {
    state.position.x = ((state.position.x - centerX) / dominantDimension) * scale * 2;
    state.position.y = ((state.position.y - centerY) / dominantDimension) * scale * 2;
  });
}

function tightenWorkflowRunNeighborhoods(
  nodeStates: ConstellationNodeState[],
  workflowRunGroups: WorkflowRunGroups
) {
  const stateById = new Map(nodeStates.map((state) => [state.id, state]));
  workflowRunGroups.runIdsByWorkflowId.forEach((runIds, workflowId) => {
    const workflowState = stateById.get(workflowId);
    const runStates = runIds
      .map((runId) => stateById.get(runId))
      .filter((state): state is ConstellationNodeState => Boolean(state));
    if (!workflowState || runStates.length === 0) {
      return;
    }

    const centroid = runStates.reduce(
      (accumulator, runState) => ({
        x: accumulator.x + runState.position.x,
        y: accumulator.y + runState.position.y,
      }),
      { x: 0, y: 0 }
    );
    workflowState.position.x = centroid.x / runStates.length;
    workflowState.position.y = centroid.y / runStates.length;

    runStates.forEach((runState, runIndex) => {
      const dx = runState.position.x - workflowState.position.x;
      const dy = runState.position.y - workflowState.position.y;
      const distance = Math.max(Math.hypot(dx, dy), 0.001);
      const targetDistance = clampNumber(distance, 2.4, 6.2, 3.8 + runIndex * 0.28);
      runState.position.x = workflowState.position.x + (dx / distance) * targetDistance;
      runState.position.y = workflowState.position.y + (dy / distance) * targetDistance;
    });
  });
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function seededUnit(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isRunLikeNode(node: SigmaGraphNode) {
  return node.type === 'Run' || node.type === 'WorkflowRun' || node.type === 'StepRun';
}

function constellationLayoutDensity(document: SigmaGraphDocument): ConstellationLayoutDensity {
  const nodeCount = Math.max(document.nodes.length, 1);
  const clusterCount = Math.max(
    new Set(document.nodes.map((node) => node.clusterId || node.type)).size,
    1
  );
  const edgeDensity = document.edges.length / nodeCount;
  const archipelagoClusters = document.nodes.filter((node) =>
    (node.clusterId || '').startsWith('island-')
  ).length;
  const haloClusters = document.nodes.filter((node) =>
    (node.clusterId || '').startsWith('halo-')
  ).length;
  const hasArchipelagoShape = archipelagoClusters > 0 && haloClusters > 0;

  if (hasArchipelagoShape) {
    return {
      archipelagoSpread: true,
      clusterPull: 0.58,
      edgeLengthMultiplier: 1.22,
      outputScale: 1.32,
      seedRadius: 0.19,
      seedRingGap: 3.4,
    };
  }

  if (nodeCount >= 140 || edgeDensity >= 2.2) {
    return {
      archipelagoSpread: false,
      clusterPull: 1.5,
      edgeLengthMultiplier: 0.72,
      outputScale: 0.72,
      seedRadius: 0.14,
      seedRingGap: 1.45,
    };
  }

  if (nodeCount >= 70 || clusterCount >= 8 || edgeDensity >= 1.4) {
    return {
      archipelagoSpread: false,
      clusterPull: 1.28,
      edgeLengthMultiplier: 0.82,
      outputScale: 0.84,
      seedRadius: 0.17,
      seedRingGap: 1.75,
    };
  }

  return {
    archipelagoSpread: false,
    clusterPull: 1.08,
    edgeLengthMultiplier: 0.92,
    outputScale: 1,
    seedRadius: 0.21,
    seedRingGap: 2.15,
  };
}

function archipelagoRingForCluster(
  clusterId: string,
  index: number,
  layoutDensity: ConstellationLayoutDensity
) {
  const numericPart = Number(clusterId.split('-')[1] || index);
  if (clusterId.startsWith('halo-')) {
    return 12.2 + (numericPart % 5) * 0.45;
  }
  return 7.4 + (numericPart % 4) * 0.65 + Math.floor(index / 8) * (layoutDensity.seedRingGap * 0.4);
}

function archipelagoAngleForCluster(clusterId: string, clusterCount: number) {
  const numericPart = Number(clusterId.split('-')[1] || 0);
  const normalizedCount = Math.max(Math.floor(clusterCount / 2), 1);
  const baseAngle = (numericPart / normalizedCount) * Math.PI * 2;
  return clusterId.startsWith('halo-') ? baseAngle + 0.14 : baseAngle;
}
