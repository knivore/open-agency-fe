'use client';

import dynamic from 'next/dynamic';
import type { ComponentType, MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ForceGraphMethods, ForceGraphProps } from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  CanvasTexture,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  Mesh,
  MeshPhongMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { createConstellationSigmaGraphPositions } from './layout';
import { normalizeSigmaGraphDocument } from './normalize';
import type {
  SigmaGraphDocument,
  SigmaGraphEdge,
  SigmaGraphNode,
  SigmaGraphSelection,
} from './types';

export interface ForceGraph3DCanvasProps {
  active?: boolean;
  autoRotate?: boolean;
  document: SigmaGraphDocument;
  className?: string;
  resetViewToken?: number;
  showAmbientLabels?: boolean;
  theme?: 'dark' | 'light';
  selection?: SigmaGraphSelection;
  onSelectionChange?: (selection: SigmaGraphSelection) => void;
}

interface ForceNode extends SigmaGraphNode {
  degree: number;
  importance: number;
  id: string;
  val: number;
  x?: number;
  y?: number;
  z?: number;
}

interface ForceLink extends Omit<SigmaGraphEdge, 'source' | 'target'> {
  curvature?: number;
  source: ForceNode | string;
  target: ForceNode | string;
}

export interface ForceGraph3DFrame {
  center: { x: number; y: number; z: number };
  radius: number;
}

export interface ForceGraph3DPositionedNode {
  val?: number;
  x?: number;
  y?: number;
  z?: number;
}

type SigmaForceGraph3DMethods = ForceGraphMethods<ForceNode, ForceLink>;
type SigmaForceGraph3DProps = ForceGraphProps<ForceNode, ForceLink> & {
  ref?:
    | ((instance: SigmaForceGraph3DMethods | null) => void)
    | MutableRefObject<SigmaForceGraph3DMethods | undefined>;
};

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
}) as ComponentType<SigmaForceGraph3DProps>;

export default function ForceGraph3DCanvas({
  active = true,
  autoRotate = true,
  document,
  className,
  resetViewToken = 0,
  showAmbientLabels = false,
  theme = 'dark',
  selection,
  onSelectionChange,
}: ForceGraph3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<SigmaForceGraph3DMethods>();
  const lastSelectionKeyRef = useRef('');
  const lastFocusedNodeIdRef = useRef('');
  const lastResetViewTokenRef = useRef(resetViewToken);
  const orbitAngleRef = useRef(0);
  const orbitDirectionRef = useRef(normalizedCameraDirection(null));
  const orbitInteractionPausedRef = useRef(false);
  const orbitResumeTimerRef = useRef<number | null>(null);
  const cameraDistanceRef = useRef(260);
  const committedCameraDistanceRef = useRef(260);
  const pendingInitialCameraRef = useRef(true);
  const initialCameraAppliedRef = useRef(false);
  const graphMountedRef = useRef(false);
  const lastRendererActiveRef = useRef<boolean | null>(null);
  const graphFrameRef = useRef({
    center: { x: 0, y: 0, z: 0 },
    radius: 0,
  });
  const [dimensions, setDimensions] = useState({ height: 640, width: 960 });
  const [cameraDistance, setCameraDistance] = useState(260);
  const [graphMountToken, setGraphMountToken] = useState(0);
  const [liveSceneFrame, setLiveSceneFrame] = useState<ForceGraph3DFrame | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState('');
  const [hoveredLinkId, setHoveredLinkId] = useState('');
  const normalizedDocument = useMemo(() => normalizeSigmaGraphDocument(document), [document]);
  const palette = useMemo(() => forceGraph3DPalette(theme), [theme]);
  const zoomDetail = useMemo(
    () => forceZoomDetail(cameraDistance, normalizedDocument.nodes.length),
    [cameraDistance, normalizedDocument.nodes.length]
  );
  const detailTier = useMemo(
    () =>
      forceGraph3DDetailTier({
        cameraDistance,
        hasSelection: Boolean(selection?.nodeIds?.length || selection?.edgeIds?.length),
        nodeCount: normalizedDocument.nodes.length,
      }),
    [
      cameraDistance,
      normalizedDocument.nodes.length,
      selection?.edgeIds?.length,
      selection?.nodeIds?.length,
    ]
  );
  const displayDocument = useMemo(
    // The 3D view can summarize runs without mutating the canonical panel document, so filters,
    // counts, and inspector state stay grounded in real graph records while the scene declutters.
    () => deriveForceGraph3DDisplayDocument(normalizedDocument, detailTier),
    [detailTier, normalizedDocument]
  );

  const graphData = useMemo(() => {
    const nodeDegrees = new Map<string, number>();
    displayDocument.edges.forEach((edge) => {
      nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
      nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
    });
    const positions = createConstellationSigmaGraphPositions(displayDocument, {
      attraction: 0.026,
      clusterGravity: 0.027,
      hubGravity: 0.018,
      iterations: 110,
      repulsion: 0.026,
      scale: 6,
    });
    const nodes: ForceNode[] = compactForceGraph3DInitialNodes(
      displayDocument.nodes.map((node, index) => {
        const fallbackPosition = positions[node.id];
        const radialDepth = forceDepthForNode(node, index);
        const degree = nodeDegrees.get(node.id) || 0;
        return {
          ...node,
          color: node.color || forceColorForNode(node, theme),
          degree,
          id: node.id,
          importance: forceNodeImportance(node, degree),
          val: forceValueForNode(node),
          x: node.position?.x ?? fallbackPosition?.x ?? 0,
          y: node.position?.y ?? fallbackPosition?.y ?? 0,
          z: radialDepth,
        };
      })
    );
    const links: ForceLink[] = displayDocument.edges.map((edge, index) => ({
      ...edge,
      color: edge.color || forceColorForEdge(edge),
      curvature: forceCurvatureForEdge(edge, index),
      source: edge.source,
      target: edge.target,
    }));
    return { links, nodes };
  }, [displayDocument, theme]);
  const graphMetrics = useMemo(() => {
    return deriveForceGraph3DSceneFrame(graphData.nodes);
  }, [graphData.nodes]);
  const sceneFrame = liveSceneFrame || graphMetrics;

  const selectedNodeIds = useMemo(() => new Set(selection?.nodeIds || []), [selection?.nodeIds]);
  const selectedEdgeIds = useMemo(() => new Set(selection?.edgeIds || []), [selection?.edgeIds]);
  const primarySelectedNodeId = selection?.nodeIds?.[0] || '';
  const selectionKey = useMemo(
    () => `${selection?.nodeIds?.join('|') || ''}::${selection?.edgeIds?.join('|') || ''}`,
    [selection?.edgeIds, selection?.nodeIds]
  );
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>(selectedNodeIds);
    graphData.links.forEach((link) => {
      const sourceId = forceLinkEndpointId(link.source);
      const targetId = forceLinkEndpointId(link.target);
      if (
        selectedEdgeIds.has(link.id) ||
        selectedNodeIds.has(sourceId) ||
        selectedNodeIds.has(targetId)
      ) {
        ids.add(sourceId);
        ids.add(targetId);
      }
    });
    return ids;
  }, [graphData.links, selectedEdgeIds, selectedNodeIds]);
  const hasPinnedSelection = Boolean(selection?.nodeIds?.length || selection?.edgeIds?.length);

  const commitCameraDistance = useCallback((distance: number, force = false) => {
    if (!Number.isFinite(distance)) {
      return;
    }
    cameraDistanceRef.current = distance;
    if (force || Math.abs(distance - committedCameraDistanceRef.current) >= 28) {
      committedCameraDistanceRef.current = distance;
      setCameraDistance(distance);
    }
  }, []);

  const clearOrbitResumeTimer = useCallback(() => {
    if (orbitResumeTimerRef.current !== null) {
      window.clearTimeout(orbitResumeTimerRef.current);
      orbitResumeTimerRef.current = null;
    }
  }, []);

  const scheduleOrbitResume = useCallback(() => {
    clearOrbitResumeTimer();
    if (!active || !autoRotate || hasPinnedSelection) {
      return;
    }
    orbitResumeTimerRef.current = window.setTimeout(() => {
      orbitInteractionPausedRef.current = false;
      graphRef.current?.refresh?.();
    }, 5000);
  }, [active, autoRotate, clearOrbitResumeTimer, hasPinnedSelection]);

  const pauseOrbitForInteraction = useCallback(() => {
    orbitInteractionPausedRef.current = true;
    clearOrbitResumeTimer();
  }, [clearOrbitResumeTimer]);

  const syncLiveSceneFrame = useCallback(() => {
    if (graphData.nodes.length === 0) {
      return null;
    }
    const graphFrame = deriveForceGraph3DSceneFrame(graphData.nodes);
    graphFrameRef.current = {
      center: graphFrame.center,
      radius: graphFrame.radius,
    };
    setLiveSceneFrame((current) =>
      current && forceGraphFrameEquals(current, graphFrame) ? current : graphFrame
    );
    return graphFrame;
  }, [graphData.nodes]);

  const applyOverviewCamera = useCallback(
    (transitionMs: number) => {
      if (!graphRef.current || graphData.nodes.length === 0) {
        return;
      }
      const graphFrame = syncLiveSceneFrame();
      if (!graphFrame) {
        return;
      }
      orbitDirectionRef.current = normalizedCameraDirection({
        x: 0.9,
        y: 0.42,
        z: 0.78,
      });
      const controls = graphRef.current.controls() as {
        target?: { set?: (x: number, y: number, z: number) => void };
      };
      controls.target?.set?.(graphFrame.center.x, graphFrame.center.y, graphFrame.center.z);
      const distance = orbitDistanceForFrame(graphFrame.radius, dimensions);
      graphRef.current.cameraPosition(
        {
          x: graphFrame.center.x + distance * 0.9,
          y: graphFrame.center.y + distance * 0.42,
          z: graphFrame.center.z + distance * 0.78,
        },
        graphFrame.center,
        transitionMs
      );
      commitCameraDistance(distance, true);
    },
    [commitCameraDistance, dimensions, graphData.nodes.length, syncLiveSceneFrame]
  );

  const handleGraphRef = useCallback((instance: SigmaForceGraph3DMethods | null) => {
    const previousInstance = graphRef.current;
    if (previousInstance && previousInstance !== instance) {
      // Ref detachment runs before react-kapsule's passive destructor. Stop WebGL frames here so
      // none can render against framebuffer state that is already being disposed.
      previousInstance.pauseAnimation?.();
      lastRendererActiveRef.current = null;
    }
    graphRef.current = instance || undefined;
    if (instance && !graphMountedRef.current) {
      graphMountedRef.current = true;
      setGraphMountToken((current) => current + 1);
      // react-kapsule attaches the imperative ref before its layout effect initializes the
      // renderer. Calling graph methods here can start a frame while renderObjs is still absent.
      return;
    }
    if (!instance && graphMountedRef.current) {
      graphMountedRef.current = false;
    }
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || lastRendererActiveRef.current === active) {
      return;
    }
    if (active) {
      graph.resumeAnimation?.();
      lastRendererActiveRef.current = true;
      return;
    }
    graph.pauseAnimation?.();
    lastRendererActiveRef.current = false;
  }, [active, graphMountToken]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const width = Math.max(320, Math.round(entry.contentRect.width));
      const height = Math.max(420, Math.round(entry.contentRect.height));
      setDimensions({ height, width });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!active || !graphRef.current) {
      return;
    }
    const graphInstance = graphRef.current;
    const chargeForce = graphInstance.d3Force('charge');
    if (chargeForce && 'strength' in chargeForce && typeof chargeForce.strength === 'function') {
      chargeForce.strength(-38);
    }
    if (
      chargeForce &&
      'distanceMax' in chargeForce &&
      typeof chargeForce.distanceMax === 'function'
    ) {
      chargeForce.distanceMax(175);
    }
    const linkForce = graphInstance.d3Force('link');
    if (linkForce && 'distance' in linkForce && typeof linkForce.distance === 'function') {
      linkForce.distance((link: ForceLink) =>
        forceLinkEndpointId(link.source) === forceLinkEndpointId(link.target)
          ? 5
          : link.type.includes('FAILED')
            ? 24
            : 19
      );
    }
    if (linkForce && 'strength' in linkForce && typeof linkForce.strength === 'function') {
      linkForce.strength((link: ForceLink) => (link.type.includes('FAILED') ? 0.82 : 0.68));
    }
    graphInstance.d3Force('agency-cluster-gravity', createForceGraph3DClusterGravityForce());
    graphInstance.d3ReheatSimulation?.();
    const controls = graphInstance.controls() as {
      addEventListener?: (eventName: string, listener: () => void) => void;
      autoRotate?: boolean;
      autoRotateSpeed?: number;
      dampingFactor?: number;
      enableDamping?: boolean;
      maxDistance?: number;
      minDistance?: number;
      removeEventListener?: (eventName: string, listener: () => void) => void;
      rotateSpeed?: number;
      target?: { set?: (x: number, y: number, z: number) => void };
      zoomSpeed?: number;
    };
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.78;
    controls.minDistance = 42;
    controls.maxDistance = Math.max(
      720,
      orbitDistanceForFrame(graphMetrics.radius, dimensions) * 2.8
    );
    const scene = graphInstance.scene();
    scene.fog = theme === 'dark' ? new FogExp2(palette.atmosphere, 0.00155) : null;
    graphInstance.lights([
      new AmbientLight(palette.ambientLight, theme === 'dark' ? 1.9 : 2.1),
      createDirectionalLight(palette.keyLight, 1.8, 160, 120, 180),
      createDirectionalLight(palette.fillLight, 1.15, -120, -80, -120),
    ]);
  }, [active, dimensions, graphData, graphMetrics.radius, graphMountToken, palette, theme]);

  useEffect(() => {
    if (!active || !graphRef.current) {
      return;
    }
    const controls = graphRef.current.controls() as {
      autoRotate?: boolean;
      autoRotateSpeed?: number;
    };
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    if (!autoRotate) {
      orbitInteractionPausedRef.current = true;
      clearOrbitResumeTimer();
    } else if (!hasPinnedSelection) {
      orbitInteractionPausedRef.current = false;
    }
  }, [active, autoRotate, clearOrbitResumeTimer, graphMountToken, hasPinnedSelection]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    pendingInitialCameraRef.current = true;
    initialCameraAppliedRef.current = false;
    setLiveSceneFrame(null);
  }, [graphData]);

  useEffect(() => {
    if (!graphRef.current || !pendingInitialCameraRef.current || initialCameraAppliedRef.current) {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (
        !graphRef.current ||
        !pendingInitialCameraRef.current ||
        initialCameraAppliedRef.current
      ) {
        return;
      }
      pendingInitialCameraRef.current = false;
      initialCameraAppliedRef.current = true;
      applyOverviewCamera(0);
    }, 140);
    return () => window.clearTimeout(timeout);
  }, [applyOverviewCamera, graphData, graphMountToken]);

  useEffect(() => {
    if (!active || !graphRef.current) {
      return;
    }
    let disposed = false;
    let animationFrame: number | null = null;
    let lastFrameTime = 0;

    const tick = (now: number) => {
      if (disposed) {
        return;
      }
      const graph = graphRef.current;
      const controls = graph?.controls() as { update?: () => void } | undefined;
      controls?.update?.();
      if (graph && autoRotate && !orbitInteractionPausedRef.current && !hasPinnedSelection) {
        const frame = graphFrameRef.current;
        const radius = Math.max(
          orbitDistanceForFrame(frame.radius, dimensions),
          cameraDistanceRef.current
        );
        const deltaSeconds = lastFrameTime > 0 ? (now - lastFrameTime) / 1000 : 1 / 60;
        lastFrameTime = now;
        orbitAngleRef.current += deltaSeconds * 0.1;
        const horizontalDirection = orbitDirectionRef.current;
        const cosine = Math.cos(orbitAngleRef.current);
        const sine = Math.sin(orbitAngleRef.current);
        const orbitX = horizontalDirection.x * cosine - horizontalDirection.z * sine;
        const orbitZ = horizontalDirection.x * sine + horizontalDirection.z * cosine;
        const verticalWave = Math.sin(orbitAngleRef.current * 0.45) * radius * 0.08;
        graph.cameraPosition(
          {
            x: frame.center.x + orbitX * radius,
            y: frame.center.y + horizontalDirection.y * radius + verticalWave,
            z: frame.center.z + orbitZ * radius,
          },
          frame.center,
          0
        );
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [active, autoRotate, dimensions, graphMountToken, hasPinnedSelection]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    const controls = graphRef.current.controls() as {
      addEventListener?: (eventName: string, listener: () => void) => void;
      removeEventListener?: (eventName: string, listener: () => void) => void;
    };
    const handleStart = () => {
      pauseOrbitForInteraction();
    };
    const handleEnd = () => {
      scheduleOrbitResume();
    };
    controls.addEventListener?.('start', handleStart);
    controls.addEventListener?.('end', handleEnd);
    return () => {
      controls.removeEventListener?.('start', handleStart);
      controls.removeEventListener?.('end', handleEnd);
    };
  }, [graphMountToken, pauseOrbitForInteraction, scheduleOrbitResume]);

  useEffect(() => {
    if (hasPinnedSelection) {
      pauseOrbitForInteraction();
      return;
    }
    if (autoRotate) {
      scheduleOrbitResume();
    }
  }, [autoRotate, hasPinnedSelection, pauseOrbitForInteraction, scheduleOrbitResume]);

  useEffect(
    () => () => {
      clearOrbitResumeTimer();
    },
    [clearOrbitResumeTimer]
  );

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    const scene = graphRef.current.scene();
    const starfield = buildAtmosphereStarfield({
      graphCenter: sceneFrame.center,
      graphRadius: sceneFrame.radius,
      nodeCount: graphData.nodes.length,
      palette,
      theme,
    });
    scene.add(starfield);

    return () => {
      scene.remove(starfield);
      starfield.traverse((object) => {
        const disposableObject = object as {
          geometry?: { dispose?: () => void };
          material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
        };
        if (disposableObject.geometry?.dispose) {
          disposableObject.geometry.dispose();
        }
        if (disposableObject.material) {
          if (Array.isArray(disposableObject.material)) {
            disposableObject.material.forEach((material) => material.dispose?.());
          } else {
            disposableObject.material.dispose?.();
          }
        }
      });
    };
  }, [graphData.nodes, graphMountToken, palette, sceneFrame, theme]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    const scene = graphRef.current.scene();
    const clusterGlowField = buildClusterGlowField(graphData.nodes, palette);
    scene.add(clusterGlowField);

    return () => {
      scene.remove(clusterGlowField);
      clusterGlowField.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          if (object.material instanceof MeshPhongMaterial) {
            object.material.dispose();
          }
        }
      });
    };
  }, [graphData.nodes, graphMountToken, palette, sceneFrame]);

  useEffect(() => {
    if (
      !active ||
      !graphRef.current ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const scene = graphRef.current.scene();
    let disposed = false;
    let animationFrame: number | null = null;

    const tick = (now: number) => {
      if (disposed) {
        return;
      }
      const elapsed = now / 1000;
      scene.traverse((object) => {
        const atmosphereDrift = object.userData?.forceAtmosphereDrift as
          | {
              baseY: number;
              phase: number;
              rotationSpeed: number;
              verticalAmplitude: number;
            }
          | undefined;
        if (atmosphereDrift) {
          object.rotation.y = elapsed * atmosphereDrift.rotationSpeed + atmosphereDrift.phase;
          object.position.y =
            atmosphereDrift.baseY +
            Math.sin(elapsed * 0.16 + atmosphereDrift.phase) * atmosphereDrift.verticalAmplitude;
        }
        const cometFlight = object.userData?.forceCometFlight as
          | {
              baseX: number;
              baseY: number;
              baseZ: number;
              dirX: number;
              dirY: number;
              dirZ: number;
              distance: number;
              opacity: number;
              phase: number;
              speed: number;
            }
          | undefined;
        if (cometFlight) {
          const progress = ((elapsed * cometFlight.speed + cometFlight.phase) % 1) * 2 - 1;
          const fade = Math.sin(((progress + 1) / 2) * Math.PI);
          object.position.set(
            cometFlight.baseX + cometFlight.dirX * cometFlight.distance * progress,
            cometFlight.baseY + cometFlight.dirY * cometFlight.distance * progress,
            cometFlight.baseZ + cometFlight.dirZ * cometFlight.distance * progress
          );
          if (object instanceof Sprite && object.material instanceof SpriteMaterial) {
            object.material.opacity = cometFlight.opacity * (0.22 + fade * 0.9);
          }
        }
        const pulse = object.userData?.forceNodePulse as
          | {
              emissiveGain?: number;
              haloOpacity?: number;
              phase: number;
              pulseAmplitude: number;
              scaleAmplitude: number;
              shellOpacity?: number;
            }
          | undefined;
        if (!pulse) {
          return;
        }
        const wave = 0.5 + Math.sin(elapsed * 0.72 + pulse.phase) * 0.5;
        const scale = 1 + (wave - 0.5) * pulse.scaleAmplitude;
        object.scale.setScalar(scale);

        object.children.forEach((child) => {
          const material = child instanceof Mesh ? child.material : null;
          if (!(material instanceof MeshPhongMaterial)) {
            return;
          }
          const baseOpacity = Number(child.userData?.baseOpacity ?? material.opacity);
          const baseEmissiveIntensity = Number(
            child.userData?.baseEmissiveIntensity ?? material.emissiveIntensity
          );
          const kind = String(child.userData?.pulseKind || 'core');

          if (kind === 'core') {
            material.emissiveIntensity =
              baseEmissiveIntensity + wave * Number(pulse.emissiveGain || 0);
          }
          if (kind === 'shell') {
            material.opacity = baseOpacity + wave * Number(pulse.shellOpacity || 0);
            material.emissiveIntensity =
              baseEmissiveIntensity + wave * Number(pulse.emissiveGain || 0) * 0.8;
          }
          if (kind === 'halo') {
            material.opacity = baseOpacity + wave * Number(pulse.haloOpacity || 0);
            material.emissiveIntensity =
              baseEmissiveIntensity + wave * Number(pulse.emissiveGain || 0) * 0.65;
          }
        });
      });
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [active, graphData.nodes.length, theme]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    const graph = graphRef.current;
    const controls = graph.controls() as {
      addEventListener?: (eventName: string, listener: () => void) => void;
      removeEventListener?: (eventName: string, listener: () => void) => void;
    };
    const updateCameraDistance = () => {
      const camera = graph.camera() as { position?: { x: number; y: number; z: number } };
      const position = camera.position;
      if (!position) {
        return;
      }
      const focusCenter = graphFrameRef.current.center;
      const distance = Math.sqrt(
        (position.x - focusCenter.x) * (position.x - focusCenter.x) +
          (position.y - focusCenter.y) * (position.y - focusCenter.y) +
          (position.z - focusCenter.z) * (position.z - focusCenter.z)
      );
      commitCameraDistance(distance);
    };

    updateCameraDistance();
    controls.addEventListener?.('change', updateCameraDistance);

    return () => {
      controls.removeEventListener?.('change', updateCameraDistance);
    };
  }, [commitCameraDistance, graphData.nodes.length]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    if (lastResetViewTokenRef.current === resetViewToken) {
      return;
    }
    lastResetViewTokenRef.current = resetViewToken;
    applyOverviewCamera(980);
    lastSelectionKeyRef.current = '';
    lastFocusedNodeIdRef.current = '';
    pendingInitialCameraRef.current = false;
    initialCameraAppliedRef.current = true;
  }, [applyOverviewCamera, resetViewToken]);

  useEffect(() => {
    if (!graphRef.current) {
      return;
    }
    if (lastSelectionKeyRef.current === selectionKey) {
      return;
    }
    lastSelectionKeyRef.current = selectionKey;
    if (!primarySelectedNodeId) {
      lastFocusedNodeIdRef.current = '';
      return;
    }
    if (lastFocusedNodeIdRef.current === primarySelectedNodeId) {
      return;
    }
    const selectedNode = graphData.nodes.find((node) => node.id === primarySelectedNodeId);
    if (
      selectedNode &&
      Number.isFinite(selectedNode.x) &&
      Number.isFinite(selectedNode.y) &&
      Number.isFinite(selectedNode.z)
    ) {
      const camera = graphRef.current.camera() as {
        position?: { x: number; y: number; z: number };
      };
      const targetX = selectedNode.x || 0;
      const targetY = selectedNode.y || 0;
      const targetZ = selectedNode.z || 0;
      const currentPosition = camera.position;
      const direction = normalizedCameraDirection(
        currentPosition
          ? {
              x: currentPosition.x - targetX,
              y: currentPosition.y - targetY,
              z: currentPosition.z - targetZ,
            }
          : null
      );
      const distance = clampNumberToRange(
        78 + selectedNode.importance * 2.2 + Math.sqrt(Math.max(selectedNode.degree, 1)) * 4,
        88,
        164
      );
      graphRef.current.cameraPosition(
        {
          x: targetX + direction.x * distance,
          y: targetY + direction.y * distance,
          z: targetZ + direction.z * distance,
        },
        {
          x: targetX,
          y: targetY,
          z: targetZ,
        },
        940
      );
      orbitDirectionRef.current = direction;
      const controls = graphRef.current.controls() as {
        target?: { set?: (x: number, y: number, z: number) => void };
      };
      controls.target?.set?.(targetX, targetY, targetZ);
      graphFrameRef.current = {
        center: {
          x: targetX,
          y: targetY,
          z: targetZ,
        },
        radius: graphFrameRef.current.radius,
      };
      window.requestAnimationFrame(() => commitCameraDistance(distance, true));
      lastFocusedNodeIdRef.current = primarySelectedNodeId;
    }
  }, [commitCameraDistance, graphData.nodes, primarySelectedNodeId, selectionKey]);

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <ForceGraph3D
        ref={handleGraphRef}
        backgroundColor={palette.background}
        enableNodeDrag={false}
        enableNavigationControls
        graphData={graphData}
        height={dimensions.height}
        linkColor={(link: ForceLink) =>
          forceLinkVisualColor(link as ForceLink, {
            connectedNodeIds,
            hoveredLinkId,
            hoveredNodeId,
            palette,
            selectedEdgeIds,
            selectedNodeIds,
            zoomDetail,
          })
        }
        linkCurvature={(link: ForceLink) => Number((link as ForceLink).curvature || 0)}
        linkDirectionalParticleColor={(link: ForceLink) =>
          forceLinkVisualColor(link as ForceLink, {
            connectedNodeIds,
            hoveredLinkId,
            hoveredNodeId,
            palette,
            selectedEdgeIds,
            selectedNodeIds,
            zoomDetail,
          })
        }
        linkDirectionalParticleSpeed={(link: ForceLink) =>
          selectedEdgeIds.has((link as ForceLink).id)
            ? 0.012
            : hoveredLinkId === (link as ForceLink).id
              ? 0.009
              : 0.0036 * zoomDetail.particleScale
        }
        linkDirectionalParticleWidth={(link: ForceLink) =>
          selectedEdgeIds.has((link as ForceLink).id)
            ? 3.2
            : hoveredLinkId === (link as ForceLink).id
              ? 2.4
              : 1.2 * zoomDetail.particleScale
        }
        linkDirectionalParticles={(link: ForceLink) => {
          const typedLink = link as ForceLink;
          const sourceId = forceLinkEndpointId(typedLink.source);
          const targetId = forceLinkEndpointId(typedLink.target);
          if (selectedEdgeIds.has(typedLink.id)) {
            return 5;
          }
          if (hoveredLinkId === typedLink.id) {
            return 3;
          }
          if (hoveredNodeId && (sourceId === hoveredNodeId || targetId === hoveredNodeId)) {
            return 2;
          }
          return zoomDetail.directionalParticles;
        }}
        linkVisibility={(link: ForceLink) =>
          forceLinkVisibility(link as ForceLink, {
            connectedNodeIds,
            hoveredLinkId,
            hoveredNodeId,
            selectedEdgeIds,
            selectedNodeIds,
            zoomDetail,
            nodeCount: graphData.nodes.length,
          })
        }
        linkHoverPrecision={10}
        linkOpacity={zoomDetail.linkOpacity}
        linkWidth={(link: ForceLink) =>
          forceLinkVisualWidth(link as ForceLink, {
            connectedNodeIds,
            hoveredLinkId,
            hoveredNodeId,
            palette,
            selectedEdgeIds,
            selectedNodeIds,
            zoomDetail,
          })
        }
        nodeColor={(node: ForceNode) =>
          forceNodeVisualColor(node as ForceNode, {
            connectedNodeIds,
            hoveredNodeId,
            palette,
            selectedNodeIds,
            showAmbientLabels,
            zoomDetail,
          })
        }
        nodeOpacity={0.96}
        nodeRelSize={2.65}
        nodeResolution={8}
        nodeVisibility={(node: ForceNode) =>
          forceNodeVisibility(node as ForceNode, {
            connectedNodeIds,
            hoveredNodeId,
            selectedNodeIds,
            zoomDetail,
            nodeCount: graphData.nodes.length,
          })
        }
        nodeThreeObject={(node: ForceNode) =>
          buildForceNodeObject(node as ForceNode, {
            connectedNodeIds,
            hoveredNodeId,
            palette,
            selectedNodeIds,
            showAmbientLabels,
            zoomDetail,
          })
        }
        numDimensions={3}
        onBackgroundClick={() => onSelectionChange?.({ nodeIds: [], edgeIds: [] })}
        onLinkClick={(link: ForceLink) =>
          onSelectionChange?.({ edgeIds: [(link as ForceLink).id], nodeIds: [] })
        }
        onLinkHover={(link: ForceLink | null) =>
          setHoveredLinkId(link ? (link as ForceLink).id : '')
        }
        onEngineStop={() => {
          syncLiveSceneFrame();
          if (pendingInitialCameraRef.current && !initialCameraAppliedRef.current) {
            pendingInitialCameraRef.current = false;
            initialCameraAppliedRef.current = true;
            applyOverviewCamera(820);
          }
        }}
        onNodeClick={(node: ForceNode) => {
          if ((node as ForceNode).metadata?.synthetic === true) {
            return;
          }
          onSelectionChange?.({ edgeIds: [], nodeIds: [(node as ForceNode).id] });
        }}
        onNodeHover={(node: ForceNode | null) =>
          setHoveredNodeId(node ? (node as ForceNode).id : '')
        }
        showNavInfo={false}
        cooldownTicks={90}
        warmupTicks={60}
        width={dimensions.width}
      />
    </div>
  );
}

interface ForceNodeVisualContext {
  connectedNodeIds: Set<string>;
  hoveredNodeId: string;
  palette: ForceGraph3DPalette;
  selectedNodeIds: Set<string>;
  showAmbientLabels: boolean;
  zoomDetail: ForceGraph3DZoomDetail;
}

interface ForceLinkVisualContext {
  connectedNodeIds: Set<string>;
  hoveredLinkId: string;
  hoveredNodeId: string;
  palette: ForceGraph3DPalette;
  selectedEdgeIds: Set<string>;
  selectedNodeIds: Set<string>;
  zoomDetail: ForceGraph3DZoomDetail;
}

interface ForceNodeVisibilityContext {
  connectedNodeIds: Set<string>;
  hoveredNodeId: string;
  nodeCount: number;
  selectedNodeIds: Set<string>;
  zoomDetail: ForceGraph3DZoomDetail;
}

interface ForceLinkVisibilityContext {
  connectedNodeIds: Set<string>;
  hoveredLinkId: string;
  hoveredNodeId: string;
  nodeCount: number;
  selectedEdgeIds: Set<string>;
  selectedNodeIds: Set<string>;
  zoomDetail: ForceGraph3DZoomDetail;
}

interface ForceGraph3DZoomDetail {
  ambientLabelOpacity: number;
  ambientImportanceThreshold: number;
  ambientLabelSizeThreshold: number;
  collapseMinorNodes: boolean;
  collapseThreshold: number;
  directionalParticles: number;
  dimmedNodeOpacity: number;
  haloThreshold: number;
  labelTextHeight: number;
  linkOpacity: number;
  linkWidth: number;
  nodeScale: number;
  particleScale: number;
}

export type ForceGraph3DDetailTier = 'detail' | 'mid' | 'overview';

interface ForceGraph3DPalette {
  ambientLight: string;
  atmosphere: string;
  background: string;
  chipLabel: string;
  clusterGlowAlpha: number;
  dimmedLink: string;
  dimmedNode: string;
  fillLight: string;
  halo: string;
  keyLight: string;
  labelBackgroundSoft: string;
  labelBackgroundStrong: string;
  linkWarning: string;
  linkOperational: string;
  linkSubtle: string;
  link: string;
  linkWidthScale: {
    base: number;
    dimmed: number;
    focus: number;
    hover: number;
    selected: number;
  };
  nodeCore: string;
  nodeHaloSoft: string;
  selectedLink: string;
  selectedNode: string;
  starfield: string;
  starfieldMuted: string;
  text: string;
}

export function deriveForceGraph3DDisplayDocument(
  document: SigmaGraphDocument,
  detailTier: ForceGraph3DDetailTier
) {
  if (detailTier === 'detail') {
    return document;
  }

  const runNodes = document.nodes.filter((node) => agencyGraph3DNodeCategory(node.type) === 'Run');
  if (runNodes.length < (detailTier === 'overview' ? 8 : 6)) {
    return document;
  }

  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const workflowNodeIds = new Set(
    document.nodes
      .filter((node) => agencyGraph3DNodeCategory(node.type) === 'Workflow')
      .map((node) => node.id)
  );
  const incomingWorkflowEdgeByRunId = new Map<string, SigmaGraphEdge>();
  const incidentEdgesByNodeId = new Map<string, SigmaGraphEdge[]>();

  for (const edge of document.edges) {
    const sourceCategory = agencyGraph3DNodeCategory(nodeById.get(edge.source)?.type || '');
    const targetCategory = agencyGraph3DNodeCategory(nodeById.get(edge.target)?.type || '');
    if (sourceCategory === 'Workflow' && targetCategory === 'Run') {
      incomingWorkflowEdgeByRunId.set(edge.target, edge);
    }
    const sourceEdges = incidentEdgesByNodeId.get(edge.source) || [];
    sourceEdges.push(edge);
    incidentEdgesByNodeId.set(edge.source, sourceEdges);
    const targetEdges = incidentEdgesByNodeId.get(edge.target) || [];
    targetEdges.push(edge);
    incidentEdgesByNodeId.set(edge.target, targetEdges);
  }

  const syntheticNodes: SigmaGraphNode[] = [];
  const syntheticEdges: SigmaGraphEdge[] = [];
  const hiddenNodeIds = new Set<string>();
  const hiddenEdgeIds = new Set<string>();

  for (const workflowNodeId of workflowNodeIds) {
    const workflowRuns = runNodes
      .filter((node) => incomingWorkflowEdgeByRunId.get(node.id)?.source === workflowNodeId)
      .sort((left, right) => agencyGraph3DRunTimestamp(right) - agencyGraph3DRunTimestamp(left));

    const clusterPolicy = agencyGraph3DClusterPolicy({
      detailTier,
      totalRunCount: runNodes.length,
      workflowRunCount: workflowRuns.length,
    });

    if (workflowRuns.length < clusterPolicy.minRunsToCluster) {
      continue;
    }

    const keptRunCount = Math.min(clusterPolicy.keptRunCount, workflowRuns.length);
    const keptRunIds = new Set(workflowRuns.slice(0, keptRunCount).map((node) => node.id));
    const aggregatedRuns = workflowRuns.filter((node) => !keptRunIds.has(node.id));
    const groups = agencyGraph3DGroupRuns(aggregatedRuns, detailTier);

    for (const run of aggregatedRuns) {
      hiddenNodeIds.add(run.id);
      hiddenEdgeIds.add(incomingWorkflowEdgeByRunId.get(run.id)?.id || '');
      for (const edge of incidentEdgesByNodeId.get(run.id) || []) {
        hiddenEdgeIds.add(edge.id);
        if (edge.source === run.id) {
          const targetNode = nodeById.get(edge.target);
          if (targetNode && agencyGraph3DNodeCategory(targetNode.type) !== 'Workflow') {
            hiddenNodeIds.add(targetNode.id);
          }
        }
        if (edge.target === run.id) {
          const sourceNode = nodeById.get(edge.source);
          if (sourceNode && agencyGraph3DNodeCategory(sourceNode.type) !== 'Workflow') {
            hiddenNodeIds.add(sourceNode.id);
          }
        }
      }
    }

    for (const group of groups) {
      if (group.runs.length === 0) {
        continue;
      }
      const newestRun = group.runs[0];
      const aggregateId = `run-cluster:${workflowNodeId}:${group.status}:${group.bucket}`;
      const errorCount = group.runs.filter((run) => agencyGraph3DRunHasError(run)).length;
      syntheticNodes.push({
        id: aggregateId,
        type: 'RunCluster',
        label: agencyGraph3DRunClusterLabel(
          group.status,
          group.bucket,
          group.runs.length,
          errorCount
        ),
        clusterId: `workflow-orbit:${workflowNodeId}`,
        color: agencyGraph3DStatusColor(group.status),
        startedAt: newestRun.startedAt,
        endedAt: newestRun.endedAt,
        size: 10 + Math.min(12, Math.sqrt(group.runs.length) * 2.4),
        data: {
          aggregate_bucket: group.bucket,
          aggregate_count: group.runs.length,
          aggregate_kind: 'run-cluster',
          aggregate_run_ids: group.runs.map((run) => run.id),
          error_count: errorCount,
          status: group.status,
          workflow_id: workflowNodeId,
        },
        metadata: {
          aggregate: true,
          aggregate_count: group.runs.length,
          aggregate_kind: 'run-cluster',
          synthetic: true,
        },
      });
      syntheticEdges.push({
        id: `${workflowNodeId}:STARTED:${aggregateId}`,
        source: workflowNodeId,
        target: aggregateId,
        type: 'STARTED',
        label: 'STARTED',
        color: agencyGraph3DStatusColor(group.status),
        size: 1.8,
      });
    }
  }

  if (syntheticNodes.length === 0) {
    return document;
  }

  return normalizeSigmaGraphDocument({
    ...document,
    edges: [
      ...document.edges.filter((edge) => !hiddenEdgeIds.has(edge.id)),
      ...syntheticEdges,
    ].filter((edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target)),
    metadata: {
      ...(document.metadata || {}),
      graph_3d_detail_tier: detailTier,
      graph_3d_synthetic_run_clusters: syntheticNodes.length,
    },
    nodes: [...document.nodes.filter((node) => !hiddenNodeIds.has(node.id)), ...syntheticNodes],
  });
}

export function deriveForceGraph3DSceneFrame(
  nodes: ForceGraph3DPositionedNode[]
): ForceGraph3DFrame {
  const center = forceGraphCenter(nodes);
  const radius = forceGraphRadius(nodes, center);
  return forcePaddedGraphFrame({ center, radius }, nodes.length);
}

export function deriveForceGraph3DCameraDistance(
  frame: ForceGraph3DFrame,
  dimensions?: { height: number; width: number }
) {
  return orbitDistanceForFrame(frame.radius, dimensions);
}

function forceGraph3DPalette(theme: 'dark' | 'light'): ForceGraph3DPalette {
  if (theme === 'light') {
    return {
      ambientLight: '#ffffff',
      atmosphere: '#f1f5f9',
      background: '#e8eff8',
      chipLabel: '#020617',
      clusterGlowAlpha: 0,
      dimmedLink: '#94a3b8',
      dimmedNode: '#64748b',
      fillLight: '#cbd5e1',
      halo: '#2563eb',
      keyLight: '#ffffff',
      labelBackgroundSoft: 'rgba(241,247,255,0.76)',
      labelBackgroundStrong: 'rgba(248,251,255,0.96)',
      link: '#475569',
      linkOperational: '#0f766e',
      linkSubtle: '#cbd5e1',
      linkWarning: '#ef4444',
      linkWidthScale: { base: 1.12, dimmed: 0.88, focus: 1.22, hover: 1.28, selected: 1.34 },
      nodeCore: '#ffffff',
      nodeHaloSoft: '#bfdbfe',
      selectedLink: '#0f172a',
      selectedNode: '#0f172a',
      starfield: '#f59e0b',
      starfieldMuted: '#f5e1b8',
      text: '#0f172a',
    };
  }
  return {
    ambientLight: '#dbeafe',
    atmosphere: '#09111f',
    background: '#07090f',
    chipLabel: '#f8fafc',
    clusterGlowAlpha: 0.035,
    dimmedLink: '#4b5563',
    dimmedNode: '#52525b',
    fillLight: '#93c5fd',
    halo: '#93c5fd',
    keyLight: '#f8fafc',
    labelBackgroundSoft: 'rgba(15,23,42,0.56)',
    labelBackgroundStrong: 'rgba(15,23,42,0.88)',
    link: '#cbd5e1',
    linkOperational: '#67e8f9',
    linkSubtle: '#94a3b8',
    linkWarning: '#fca5a5',
    linkWidthScale: { base: 1, dimmed: 1, focus: 1, hover: 1, selected: 1 },
    nodeCore: '#f8fafc',
    nodeHaloSoft: '#7dd3fc',
    selectedLink: '#f8fafc',
    selectedNode: '#ffffff',
    starfield: '#cbd5e1',
    starfieldMuted: '#334155',
    text: '#f8fafc',
  };
}

function forceGraph3DDetailTier({
  cameraDistance,
  hasSelection,
  nodeCount,
}: {
  cameraDistance: number;
  hasSelection: boolean;
  nodeCount: number;
}): ForceGraph3DDetailTier {
  if (hasSelection || nodeCount < 24 || cameraDistance <= 220) {
    return 'detail';
  }
  if (cameraDistance <= 360 || nodeCount < 80) {
    return 'mid';
  }
  return 'overview';
}

function agencyGraph3DNodeCategory(type: string) {
  if (type === 'Workflow' || type === 'Schedule' || type === 'WorkflowVersion') {
    return 'Workflow';
  }
  if (type === 'Run' || type === 'WorkflowRun' || type === 'StepRun') {
    return 'Run';
  }
  return 'Other';
}

function agencyGraph3DRunTimestamp(node: SigmaGraphNode) {
  return Math.max(
    agencyGraph3DDateValue(node.startedAt),
    agencyGraph3DDateValue(node.endedAt),
    agencyGraph3DDateValue(String(node.data?.started_at || '')),
    agencyGraph3DDateValue(String(node.data?.completed_at || '')),
    agencyGraph3DDateValue(String(node.data?.created_at || ''))
  );
}

function agencyGraph3DDateValue(value?: string) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function agencyGraph3DRunHasError(node: SigmaGraphNode) {
  return (
    String(node.data?.status || '')
      .toLowerCase()
      .includes('fail') || Boolean(node.data?.error)
  );
}

function agencyGraph3DRunStatus(node: SigmaGraphNode) {
  const status = String(node.data?.status || '').toLowerCase();
  if (!status) {
    return 'unknown';
  }
  if (status.includes('fail') || status.includes('error')) {
    return 'failed';
  }
  if (status.includes('running') || status.includes('pending')) {
    return 'running';
  }
  if (status.includes('cancel')) {
    return 'cancelled';
  }
  if (status.includes('complete') || status.includes('success')) {
    return 'completed';
  }
  return status;
}

function agencyGraph3DGroupRuns(runs: SigmaGraphNode[], detailTier: ForceGraph3DDetailTier) {
  const now = Date.now();
  const groups = new Map<string, { bucket: string; runs: SigmaGraphNode[]; status: string }>();

  for (const run of runs) {
    const status = agencyGraph3DRunStatus(run);
    const bucket =
      detailTier === 'overview'
        ? agencyGraph3DTimeBucket(agencyGraph3DRunTimestamp(run), now)
        : 'older';
    const key = `${status}:${bucket}`;
    const group = groups.get(key) || { bucket, runs: [], status };
    group.runs.push(run);
    groups.set(key, group);
  }

  return [...groups.values()].sort((left, right) => {
    const statusOrder =
      agencyGraph3DStatusOrder(left.status) - agencyGraph3DStatusOrder(right.status);
    if (statusOrder !== 0) {
      return statusOrder;
    }
    return agencyGraph3DBucketOrder(left.bucket) - agencyGraph3DBucketOrder(right.bucket);
  });
}

function agencyGraph3DTimeBucket(timestamp: number, now: number) {
  if (!timestamp) {
    return 'older';
  }
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs <= 24 * 60 * 60 * 1000) {
    return '24h';
  }
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) {
    return '7d';
  }
  return 'older';
}

function agencyGraph3DStatusOrder(status: string) {
  if (status === 'failed') {
    return 0;
  }
  if (status === 'running') {
    return 1;
  }
  if (status === 'completed') {
    return 2;
  }
  if (status === 'cancelled') {
    return 3;
  }
  return 4;
}

function agencyGraph3DBucketOrder(bucket: string) {
  if (bucket === '24h') {
    return 0;
  }
  if (bucket === '7d') {
    return 1;
  }
  if (bucket === 'older') {
    return 2;
  }
  return 3;
}

function agencyGraph3DStatusColor(status: string) {
  if (status === 'failed') {
    return '#f87171';
  }
  if (status === 'running') {
    return '#38bdf8';
  }
  if (status === 'completed') {
    return '#4ade80';
  }
  if (status === 'cancelled') {
    return '#94a3b8';
  }
  return '#cbd5e1';
}

function agencyGraph3DClusterPolicy({
  detailTier,
  totalRunCount,
  workflowRunCount,
}: {
  detailTier: ForceGraph3DDetailTier;
  totalRunCount: number;
  workflowRunCount: number;
}) {
  const workflowShare = totalRunCount > 0 ? workflowRunCount / totalRunCount : 0;
  const denseWorkflow = workflowRunCount >= 10 || workflowShare >= 0.34;

  if (detailTier === 'overview') {
    return {
      keptRunCount: 0,
      minRunsToCluster: denseWorkflow ? 3 : 5,
    };
  }

  return {
    keptRunCount: denseWorkflow ? 2 : 4,
    minRunsToCluster: denseWorkflow ? 4 : 7,
  };
}

function agencyGraph3DRunClusterLabel(
  status: string,
  bucket: string,
  count: number,
  errorCount: number
) {
  const parts = [`${count} ${status} run${count === 1 ? '' : 's'}`];
  if (bucket !== 'older') {
    parts.push(bucket === '24h' ? 'last 24h' : 'last 7d');
  } else {
    parts.push('older');
  }
  if (errorCount > 0 && status !== 'failed') {
    parts.push(`${errorCount} errors`);
  }
  return parts.join(' · ');
}

function forceColorForNode(node: SigmaGraphNode, theme: 'dark' | 'light') {
  const palette =
    theme === 'light'
      ? ['#0369a1', '#1d4ed8', '#0f766e', '#b45309', '#b91c1c', '#6d28d9']
      : ['#60a5fa', '#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];
  const index =
    Math.abs([...node.type].reduce((total, character) => total + character.charCodeAt(0), 0)) %
    palette.length;
  return palette[index];
}

function forceColorForEdge(edge: SigmaGraphEdge) {
  return edge.type.toLowerCase().includes('warn') ? '#f97316' : '#64748b';
}

function normalizedCameraDirection(vector: { x: number; y: number; z: number } | null | undefined) {
  if (!vector) {
    return { x: 0.72, y: 0.34, z: 0.6 };
  }
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(magnitude) || magnitude < 0.001) {
    return { x: 0.72, y: 0.34, z: 0.6 };
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

function clampNumberToRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function orbitDistanceForFrame(
  graphRadius: number,
  dimensions: { height: number; width: number } = { height: 640, width: 960 }
) {
  const viewportShortSide = Math.max(360, Math.min(dimensions.height, dimensions.width));
  const compactViewport = viewportShortSide < 640;
  const responsiveFloor = compactViewport ? 210 : 235;
  const responsiveCeiling = compactViewport ? 560 : 720;
  return clampNumberToRange(96 + graphRadius * 1.02, responsiveFloor, responsiveCeiling);
}

function forceCurvatureForEdge(edge: SigmaGraphEdge, index: number) {
  if (edge.source === edge.target) {
    return 0.34;
  }
  const polarity = index % 2 === 0 ? 1 : -1;
  return ((index % 5) / 40) * polarity;
}

function forceGraphCenter(nodes: ForceGraph3DPositionedNode[]) {
  if (nodes.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const total = nodes.reduce<{ x: number; y: number; z: number }>(
    (accumulator, node) => ({
      x: accumulator.x + (node.x || 0),
      y: accumulator.y + (node.y || 0),
      z: accumulator.z + (node.z || 0),
    }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: total.x / nodes.length,
    y: total.y / nodes.length,
    z: total.z / nodes.length,
  };
}

function forceGraphRadius(
  nodes: ForceGraph3DPositionedNode[],
  center: { x: number; y: number; z: number }
) {
  return nodes.reduce((maxRadius, node) => {
    const radius = Math.hypot(
      (node.x || 0) - center.x,
      (node.y || 0) - center.y,
      (node.z || 0) - center.z
    );
    return Math.max(maxRadius, radius + (node.val || 0));
  }, 0);
}

function forcePaddedGraphFrame(frame: ForceGraph3DFrame, nodeCount: number): ForceGraph3DFrame {
  const densityPadding = clampNumberToRange(
    1.04 + Math.log10(Math.max(nodeCount, 2)) * 0.06,
    1.1,
    1.22
  );
  return {
    center: frame.center,
    radius: Math.max(48, frame.radius * densityPadding),
  };
}

export function compactForceGraph3DInitialNodes<T extends ForceGraph3DPositionedNode>(
  nodes: T[]
): T[] {
  if (nodes.length === 0) {
    return nodes;
  }
  const center = forceGraphCenter(nodes);
  const planarScale = nodes.length >= 120 ? 0.48 : nodes.length >= 48 ? 0.54 : 0.62;
  const depthScale = nodes.length >= 120 ? 0.34 : 0.42;

  return nodes.map((node) => ({
    ...node,
    // The 3D force engine separates disconnected components aggressively; compacting the seeded
    // positions gives the later simulation a navigable constellation instead of scattered islands.
    x: center.x + ((node.x || 0) - center.x) * planarScale,
    y: center.y + ((node.y || 0) - center.y) * planarScale,
    z: center.z + ((node.z || 0) - center.z) * depthScale,
  }));
}

interface ForceGraph3DVelocityNode extends ForceNode {
  vx?: number;
  vy?: number;
  vz?: number;
}

interface ForceGraph3DClusterTarget {
  strength: number;
  x: number;
  y: number;
  z: number;
}

interface ForceGraph3DForceFunction {
  (alpha: number): void;
  initialize?: (incomingNodes: unknown[], ...args: unknown[]) => void;
  [key: string]: unknown;
}

function createForceGraph3DClusterGravityForce(): ForceGraph3DForceFunction {
  let nodes: ForceGraph3DVelocityNode[] = [];
  let targets = new Map<string, ForceGraph3DClusterTarget>();

  const force = ((alpha: number) => {
    const alphaScale = Math.max(0.001, alpha);
    nodes.forEach((node) => {
      const target = targets.get(node.id);
      if (!target) {
        return;
      }
      const pull = alphaScale * target.strength;
      node.vx = (node.vx || 0) + (target.x - (node.x || 0)) * pull;
      node.vy = (node.vy || 0) + (target.y - (node.y || 0)) * pull;
      node.vz = (node.vz || 0) + (target.z - (node.z || 0)) * pull * 1.18;
    });
  }) as ForceGraph3DForceFunction;

  force.initialize = (incomingNodes: unknown[]) => {
    nodes = incomingNodes as ForceGraph3DVelocityNode[];
    targets = deriveForceGraph3DClusterTargets(nodes);
  };

  return force;
}

function deriveForceGraph3DClusterTargets(nodes: ForceGraph3DVelocityNode[]) {
  const clusterIds = Array.from(new Set(nodes.map(forceGraph3DClusterKey))).sort();
  const targetByClusterId = new Map<string, ForceGraph3DClusterTarget>();
  const orbitRadius =
    clusterIds.length <= 1 ? 0 : clampNumberToRange(28 + Math.sqrt(nodes.length) * 2.7, 42, 92);

  clusterIds.forEach((clusterId, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(clusterIds.length, 1);
    targetByClusterId.set(clusterId, {
      strength: nodes.length >= 120 ? 0.036 : 0.031,
      x: Math.cos(angle) * orbitRadius,
      y: Math.sin(angle) * orbitRadius * 0.72,
      z: ((index % 5) - 2) * 5.2,
    });
  });

  const targetByNodeId = new Map<string, ForceGraph3DClusterTarget>();
  nodes.forEach((node) => {
    const target = targetByClusterId.get(forceGraph3DClusterKey(node));
    if (target) {
      targetByNodeId.set(node.id, {
        ...target,
        strength:
          target.strength *
          (agencyGraph3DNodeCategory(node.type) === 'Workflow'
            ? 0.78
            : node.degree <= 1
              ? 1.12
              : 1),
      });
    }
  });

  return targetByNodeId;
}

function forceGraph3DClusterKey(node: ForceNode) {
  return String(node.clusterId || agencyGraph3DNodeCategory(node.type) || node.type || 'other');
}

function forceGraphFrameEquals(left: ForceGraph3DFrame, right: ForceGraph3DFrame) {
  const tolerance = 0.25;
  return (
    Math.abs(left.radius - right.radius) < tolerance &&
    Math.abs(left.center.x - right.center.x) < tolerance &&
    Math.abs(left.center.y - right.center.y) < tolerance &&
    Math.abs(left.center.z - right.center.z) < tolerance
  );
}

function forceDepthForNode(node: SigmaGraphNode, index: number) {
  const seed = Math.abs(
    [...(node.clusterId || node.type || node.id)].reduce(
      (total, character) => total * 31 + character.charCodeAt(0),
      7
    )
  );
  const layer = (seed % 11) - 5;
  return layer * 3.2 + (index % 3) * 0.8;
}

function forceValueForNode(node: SigmaGraphNode) {
  const baseSize = Number(node.size || 5);
  const type = node.type.toLowerCase();
  const dominantHubScale =
    type === 'workflow' || type === 'memory'
      ? 0.72
      : type === 'document' || type === 'entity'
        ? 0.82
        : 1;
  return Math.max(2.6, baseSize * 1.02 * dominantHubScale);
}

function forceNodeImportance(node: SigmaGraphNode, degree: number) {
  const sizeWeight = Number(node.size || 0) * 0.9;
  const degreeWeight = Math.min(18, degree) * 0.7;
  const statusWeight = String(node.metadata?.status || '')
    .toLowerCase()
    .includes('failed')
    ? 3
    : 0;
  return Math.max(1, sizeWeight + degreeWeight + statusWeight);
}

function buildForceNodeObject(node: ForceNode, context: ForceNodeVisualContext) {
  const isSelected = context.selectedNodeIds.has(node.id);
  const isHovered = context.hoveredNodeId === node.id;
  const isConnected = context.connectedNodeIds.has(node.id);
  const group = new Group();
  const hubScale = 1 + Math.min(0.14, node.importance / 96);
  const radius =
    Math.max(0.92, Math.min(3.55, (node.val || 4) * 0.2)) * context.zoomDetail.nodeScale * hubScale;
  const nodeColor = new Color(forceNodeVisualColor(node, context));
  const coreColor = nodeColor.clone().lerp(new Color(context.palette.nodeCore), 0.08);
  const shouldShowHalo =
    isSelected || isHovered || isConnected || node.importance >= context.zoomDetail.haloThreshold;
  if (shouldShowHalo) {
    const haloMaterial = new SpriteMaterial({
      blending: AdditiveBlending,
      color:
        isSelected || isHovered
          ? new Color(context.palette.selectedNode)
          : nodeColor.clone().lerp(new Color(context.palette.nodeHaloSoft), 0.36),
      depthWrite: false,
      fog: false,
      map: getForceNodeHaloTexture(),
      opacity: isSelected ? 0.34 : isHovered ? 0.28 : isConnected ? 0.18 : 0.12,
      transparent: true,
    });
    const haloSprite = new Sprite(haloMaterial);
    const haloScale =
      radius *
      (isSelected
        ? 5.4
        : isHovered
          ? 4.9
          : node.importance >= context.zoomDetail.haloThreshold
            ? 3.9
            : 3.3);
    haloSprite.scale.set(haloScale, haloScale, haloScale);
    haloSprite.renderOrder = -6;
    group.add(haloSprite);
  }
  const coreMaterial = new MeshPhongMaterial({
    color: coreColor,
    emissive: isSelected || isHovered ? context.palette.halo : nodeColor,
    emissiveIntensity: isSelected
      ? 0.3
      : isHovered
        ? 0.22
        : node.importance >= 12
          ? 0.09
          : isConnected
            ? 0.07
            : 0.025,
    shininess: isSelected || isHovered ? 16 : 7,
    specular: nodeColor.clone().multiplyScalar(0.34),
    transparent: true,
    opacity: isConnected || isHovered || isSelected ? 1 : context.zoomDetail.dimmedNodeOpacity,
  });
  const sphere = new Mesh(new SphereGeometry(radius, 8, 8), coreMaterial);
  sphere.userData.baseEmissiveIntensity = coreMaterial.emissiveIntensity;
  sphere.userData.baseOpacity = coreMaterial.opacity;
  sphere.userData.pulseKind = 'core';
  group.add(sphere);

  if (isHovered || isSelected) {
    const haloMaterial = new MeshPhongMaterial({
      color: context.palette.nodeHaloSoft,
      emissive: context.palette.halo,
      emissiveIntensity: isSelected ? 0.2 : 0.16,
      opacity: isSelected ? 0.045 : 0.035,
      shininess: 14,
      transparent: true,
    });
    const halo = new Mesh(
      new SphereGeometry(radius * (isSelected ? 1.38 : 1.28), 10, 10),
      haloMaterial
    );
    halo.userData.baseEmissiveIntensity = haloMaterial.emissiveIntensity;
    halo.userData.baseOpacity = haloMaterial.opacity;
    halo.userData.pulseKind = 'halo';
    group.add(halo);
  }

  const shouldRenderLabel =
    isHovered ||
    isSelected ||
    (context.showAmbientLabels &&
      (Number(node.size || 0) >= context.zoomDetail.ambientLabelSizeThreshold ||
        node.importance >= context.zoomDetail.ambientImportanceThreshold));
  if (shouldRenderLabel) {
    const label = new SpriteText(node.label);
    label.color =
      isHovered || isSelected
        ? context.palette.chipLabel
        : forceLabelTone(context.palette.text, context.zoomDetail.ambientLabelOpacity);
    label.backgroundColor =
      isHovered || isSelected
        ? context.palette.labelBackgroundStrong
        : forceBackgroundTone(
            context.palette.labelBackgroundSoft,
            context.zoomDetail.ambientLabelOpacity
          );
    label.padding = 3;
    label.borderRadius = 4;
    label.textHeight =
      (isSelected ? context.zoomDetail.labelTextHeight + 1.5 : context.zoomDetail.labelTextHeight) *
      (isHovered
        ? 1.06
        : node.importance >= context.zoomDetail.ambientImportanceThreshold
          ? 1.04
          : 1);
    // Hovered labels sit above the node rather than across its face, which keeps the text readable
    // from more camera angles and avoids the sphere visually punching through the label.
    const labelOffsetX = isHovered || isSelected ? radius * 0.34 : radius * 1.65;
    const labelOffsetY =
      radius *
      (isHovered || isSelected
        ? node.importance >= context.zoomDetail.ambientImportanceThreshold
          ? 2.75
          : 2.45
        : node.importance >= context.zoomDetail.ambientImportanceThreshold
          ? 2.05
          : 1.8);
    const labelOffsetZ = isHovered || isSelected ? radius * 0.16 : radius * 0.72;
    label.position.set(labelOffsetX, labelOffsetY, labelOffsetZ);
    group.add(label);
  }

  group.userData.forceNodePulse = {
    emissiveGain:
      isSelected || isHovered
        ? 0.014
        : node.importance >= 12
          ? 0.018
          : node.importance >= 8
            ? 0.012
            : 0.008,
    haloOpacity: isSelected ? 0.01 : isHovered ? 0.008 : 0.004,
    phase: node.importance * 0.31 + node.degree * 0.17,
    pulseAmplitude: node.importance >= 12 ? 1 : 0.8,
    scaleAmplitude: node.importance >= 12 ? 0.014 : 0.008,
    shellOpacity: node.importance >= 10 ? 0.012 : 0.006,
  };

  return group;
}

function forceNodeVisualColor(node: ForceNode, context: ForceNodeVisualContext) {
  if (context.selectedNodeIds.has(node.id)) {
    return context.palette.selectedNode;
  }
  if (context.hoveredNodeId === node.id) {
    return new Color(String(node.color || context.palette.dimmedNode))
      .lerp(new Color(context.palette.nodeCore), 0.32)
      .getStyle();
  }
  if (context.connectedNodeIds.size > 0 && !context.connectedNodeIds.has(node.id)) {
    return context.palette.dimmedNode;
  }
  return String(node.color || context.palette.dimmedNode);
}

function forceLinkVisualColor(link: ForceLink, context: ForceLinkVisualContext) {
  const sourceId = forceLinkEndpointId(link.source);
  const targetId = forceLinkEndpointId(link.target);
  const baseColor = forceEdgeTone(link, context.palette);
  if (context.selectedEdgeIds.has(link.id)) {
    return context.palette.selectedLink;
  }
  if (context.hoveredLinkId === link.id) {
    return context.palette.selectedLink;
  }
  if (
    context.hoveredNodeId &&
    (sourceId === context.hoveredNodeId || targetId === context.hoveredNodeId)
  ) {
    return context.palette.link;
  }
  if (
    context.selectedNodeIds.size > 0 &&
    !context.selectedNodeIds.has(sourceId) &&
    !context.selectedNodeIds.has(targetId)
  ) {
    return context.palette.dimmedLink;
  }
  return baseColor;
}

function forceLinkVisualWidth(link: ForceLink, context: ForceLinkVisualContext) {
  const sourceId = forceLinkEndpointId(link.source);
  const targetId = forceLinkEndpointId(link.target);
  if (context.selectedEdgeIds.has(link.id)) {
    return 2.8 * context.palette.linkWidthScale.selected;
  }
  if (context.hoveredLinkId === link.id) {
    return 2.2 * context.palette.linkWidthScale.hover;
  }
  if (
    context.hoveredNodeId &&
    (sourceId === context.hoveredNodeId || targetId === context.hoveredNodeId)
  ) {
    return 1.7 * context.palette.linkWidthScale.focus;
  }
  if (
    context.selectedNodeIds.size > 0 &&
    !context.selectedNodeIds.has(sourceId) &&
    !context.selectedNodeIds.has(targetId)
  ) {
    return 0.45 * context.palette.linkWidthScale.dimmed;
  }
  const operationalBoost = link.type.toLowerCase().includes('run') ? 0.14 : 0;
  const relationshipType = link.type.toLowerCase();
  const warningBoost =
    relationshipType.includes('fail') ||
    relationshipType.includes('error') ||
    relationshipType.includes('warn')
      ? 0.36
      : 0;
  const defaultTrim =
    warningBoost === 0 && operationalBoost === 0 && !relationshipType.includes('workflow')
      ? 0.12
      : 0;
  return (
    Math.max(0.36, context.zoomDetail.linkWidth + operationalBoost + warningBoost - defaultTrim) *
    context.palette.linkWidthScale.base
  );
}

function forceNodeVisibility(node: ForceNode, context: ForceNodeVisibilityContext) {
  if (
    context.selectedNodeIds.has(node.id) ||
    context.connectedNodeIds.has(node.id) ||
    context.hoveredNodeId === node.id
  ) {
    return true;
  }
  if (!context.zoomDetail.collapseMinorNodes || context.nodeCount < 120) {
    return true;
  }
  return node.importance >= context.zoomDetail.collapseThreshold || node.degree >= 2;
}

function forceLinkVisibility(link: ForceLink, context: ForceLinkVisibilityContext) {
  const sourceId = forceLinkEndpointId(link.source);
  const targetId = forceLinkEndpointId(link.target);
  if (
    context.selectedEdgeIds.has(link.id) ||
    context.hoveredLinkId === link.id ||
    sourceId === context.hoveredNodeId ||
    targetId === context.hoveredNodeId
  ) {
    return true;
  }
  if (
    context.selectedNodeIds.has(sourceId) ||
    context.selectedNodeIds.has(targetId) ||
    context.connectedNodeIds.has(sourceId) ||
    context.connectedNodeIds.has(targetId)
  ) {
    return true;
  }
  if (!context.zoomDetail.collapseMinorNodes || context.nodeCount < 120) {
    return true;
  }
  const sourceImportance = typeof link.source === 'string' ? 0 : link.source.importance;
  const targetImportance = typeof link.target === 'string' ? 0 : link.target.importance;
  const sourceDegree = typeof link.source === 'string' ? 0 : link.source.degree;
  const targetDegree = typeof link.target === 'string' ? 0 : link.target.degree;
  return (
    sourceImportance >= context.zoomDetail.collapseThreshold ||
    targetImportance >= context.zoomDetail.collapseThreshold ||
    sourceDegree >= 2 ||
    targetDegree >= 2
  );
}

function forceLinkEndpointId(endpoint: ForceNode | string) {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

function forceZoomDetail(cameraDistance: number, nodeCount: number): ForceGraph3DZoomDetail {
  const denseGraph = nodeCount > 200;
  if (cameraDistance <= 150) {
    return {
      ambientImportanceThreshold: denseGraph ? 13 : 10,
      ambientLabelOpacity: 0.82,
      ambientLabelSizeThreshold: denseGraph ? 14 : 10,
      collapseMinorNodes: false,
      collapseThreshold: 0,
      directionalParticles: 1,
      dimmedNodeOpacity: 0.86,
      haloThreshold: 8,
      labelTextHeight: 7.8,
      linkOpacity: 0.84,
      linkWidth: 1.2,
      nodeScale: 1.08,
      particleScale: 1.2,
    };
  }
  if (cameraDistance <= 265) {
    return {
      ambientImportanceThreshold: denseGraph ? 15 : 12,
      ambientLabelOpacity: 0.66,
      ambientLabelSizeThreshold: denseGraph ? 18 : 14,
      collapseMinorNodes: denseGraph,
      collapseThreshold: denseGraph ? 8 : 0,
      directionalParticles: 0,
      dimmedNodeOpacity: 0.78,
      haloThreshold: 10,
      labelTextHeight: 6.8,
      linkOpacity: 0.76,
      linkWidth: 0.95,
      nodeScale: 1,
      particleScale: 1,
    };
  }
  return {
    ambientImportanceThreshold: denseGraph ? 18 : 15,
    ambientLabelOpacity: 0.54,
    ambientLabelSizeThreshold: denseGraph ? 24 : 18,
    collapseMinorNodes: denseGraph,
    collapseThreshold: denseGraph ? 11 : 0,
    directionalParticles: 0,
    dimmedNodeOpacity: 0.76,
    haloThreshold: 13,
    labelTextHeight: 5.9,
    linkOpacity: 0.72,
    linkWidth: 0.72,
    nodeScale: 0.96,
    particleScale: 0.82,
  };
}

function forceEdgeTone(link: ForceLink, palette: ForceGraph3DPalette) {
  const type = link.type.toLowerCase();
  if (type.includes('fail') || type.includes('warn') || type.includes('error')) {
    return palette.linkWarning;
  }
  if (type.includes('run') || type.includes('workflow') || type.includes('operational')) {
    return palette.linkOperational;
  }
  if (type.includes('document') || type.includes('memory') || type.includes('entity')) {
    return palette.linkSubtle;
  }
  return String(link.color || palette.dimmedLink);
}

function buildAtmosphereStarfield({
  graphCenter,
  graphRadius,
  nodeCount,
  palette,
  theme,
}: {
  graphCenter: { x: number; y: number; z: number };
  graphRadius: number;
  nodeCount: number;
  palette: ForceGraph3DPalette;
  theme: 'dark' | 'light';
}) {
  const group = new Group();
  const bright = new Color(palette.starfield);
  const muted = new Color(palette.starfieldMuted);
  const radiusSpread = Math.max(60, graphRadius);

  group.add(
    createAtmosphereSpriteLayer({
      bright,
      muted,
      nodeCount,
      opacity: theme === 'dark' ? 0.82 : 0.74,
      particleCount: Math.max(220, Math.min(520, Math.round(nodeCount * 2.05))),
      radiusMax: Math.max(
        radiusSpread * 1.62,
        Math.min(radiusSpread * 1.95, 170 + nodeCount * 0.36)
      ),
      radiusMin: Math.max(46, radiusSpread * 0.44),
      seedOffset: 11,
      size: theme === 'dark' ? 1.65 : 1.95,
      shape: 'circle',
      theme,
    })
  );
  group.add(
    createAtmosphereSpriteLayer({
      bright,
      muted,
      nodeCount,
      opacity: theme === 'dark' ? 0.24 : 0.32,
      particleCount: Math.max(90, Math.min(230, Math.round(nodeCount * 0.68))),
      radiusMax: Math.max(radiusSpread * 2.4, Math.min(radiusSpread * 3.2, 280 + nodeCount * 0.56)),
      radiusMin: Math.max(118, radiusSpread * 1.16),
      seedOffset: 37,
      size: theme === 'dark' ? 1.1 : 1.35,
      shape: 'circle',
      theme,
    })
  );
  group.add(
    createAtmosphereSpriteLayer({
      bright,
      muted,
      nodeCount,
      opacity: theme === 'dark' ? 0.26 : 0.34,
      particleCount: Math.max(18, Math.min(44, Math.round(nodeCount * 0.16))),
      radiusMax: Math.max(
        radiusSpread * 1.95,
        Math.min(radiusSpread * 2.5, 230 + nodeCount * 0.42)
      ),
      radiusMin: Math.max(84, radiusSpread * 0.82),
      seedOffset: 73,
      size: theme === 'dark' ? 2.2 : 2.7,
      shape: 'asteroid',
      theme,
    })
  );
  group.add(
    createAtmosphereSpriteLayer({
      banded: true,
      bright,
      heightScale: 0.78,
      muted,
      nodeCount,
      opacity: theme === 'dark' ? 0.34 : 0.38,
      particleCount: Math.max(5, Math.min(14, Math.round(nodeCount * 0.04))),
      radiusMax: Math.max(
        radiusSpread * 2.12,
        Math.min(radiusSpread * 2.85, 270 + nodeCount * 0.5)
      ),
      radiusMin: Math.max(112, radiusSpread * 1.08),
      seedOffset: 109,
      size: theme === 'dark' ? 2.6 : 3.1,
      shape: 'comet',
      theme,
      widthScale: 6.2,
    })
  );
  group.add(
    createAtmosphereSpriteLayer({
      bright,
      muted,
      nodeCount,
      opacity: theme === 'dark' ? 0.2 : 0.28,
      particleCount: Math.max(16, Math.min(44, Math.round(nodeCount * 0.14))),
      radiusMax: Math.max(
        radiusSpread * 3.55,
        Math.min(radiusSpread * 4.8, 420 + nodeCount * 0.84)
      ),
      radiusMin: Math.max(176, radiusSpread * 1.9),
      seedOffset: 137,
      size: theme === 'dark' ? 2.2 : 2.75,
      shape: 'square',
      theme,
    })
  );

  // Keep the atmosphere subtly alive even while the camera is idle so the dust reads as suspended,
  // not stamped onto the backdrop.
  group.userData.forceAtmosphereDrift = {
    baseY: graphCenter.y,
    phase: (nodeCount % 23) * 0.21,
    rotationSpeed: theme === 'dark' ? 0.016 : 0.014,
    verticalAmplitude: Math.max(1.4, Math.min(4.8, radiusSpread * 0.014)),
  };
  group.position.set(graphCenter.x, graphCenter.y, graphCenter.z);
  return group;
}

function createAtmosphereSpriteLayer({
  banded = false,
  bright,
  heightScale = 1,
  muted,
  nodeCount,
  opacity,
  particleCount,
  radiusMax,
  radiusMin,
  seedOffset,
  size,
  shape,
  theme,
  widthScale = 1,
}: {
  banded?: boolean;
  bright: Color;
  heightScale?: number;
  muted: Color;
  nodeCount: number;
  opacity: number;
  particleCount: number;
  radiusMax: number;
  radiusMin: number;
  seedOffset: number;
  size: number;
  shape: AtmosphereSpriteShape;
  theme: 'dark' | 'light';
  widthScale?: number;
}) {
  const group = new Group();
  const accentSequence = themeAwareAtmosphereAccentSequence(bright, muted, theme);
  const texture = getAtmosphereTexture(shape);

  for (let index = 0; index < particleCount; index += 1) {
    const seed = (index + 1 + seedOffset) * 16807;
    const theta = ((seed % 360) * Math.PI) / 180;
    const phi = ((((seed * 13 + nodeCount) % 180) + 1) * Math.PI) / 180;
    const radialMix = 0.58 + (seed % 37) / 100;
    const distance = radiusMin + (radiusMax - radiusMin) * radialMix;
    const mix = 0.22 + (index % 6) * 0.1;
    const accent = accentSequence[index % accentSequence.length];
    const color = muted.clone().lerp(accent, Math.min(0.82, mix));
    const material = new SpriteMaterial({
      blending: AdditiveBlending,
      color,
      depthTest: false,
      depthWrite: false,
      fog: false,
      map: texture,
      opacity,
      rotation: shape === 'circle' ? 0 : ((seed * 19) % 360) * (Math.PI / 180),
      transparent: true,
    });
    const sprite = new Sprite(material);
    let baseX = 0;
    let baseY = 0;
    let baseZ = 0;
    if (banded) {
      const verticalPhase = (((seed * 29) % 100) / 100) * Math.PI * 2;
      baseX = Math.cos(theta) * distance;
      baseY = Math.sin(theta) * distance * 0.64;
      baseZ = Math.sin(verticalPhase) * distance * 0.22;
      sprite.position.set(baseX, baseY, baseZ);
    } else {
      baseX = Math.cos(theta) * Math.sin(phi) * distance;
      baseY = Math.sin(theta) * Math.sin(phi) * distance;
      baseZ = Math.cos(phi) * distance;
      sprite.position.set(baseX, baseY, baseZ);
    }
    const scaleJitter = shape === 'circle' ? ((seed % 5) / 10) * size : ((seed % 7) / 10) * size;
    const scale = size + scaleJitter;
    sprite.scale.set(scale * widthScale, scale * heightScale, scale);
    if (shape === 'comet') {
      const flightAngle = (((seed * 31) % 360) * Math.PI) / 180;
      const rawDirX = Math.cos(flightAngle);
      const rawDirY = Math.sin(flightAngle) * 0.66;
      const rawDirZ = (((seed * 17) % 100) / 100 - 0.5) * 0.58;
      const magnitude = Math.hypot(rawDirX, rawDirY, rawDirZ) || 1;
      const dirX = rawDirX / magnitude;
      const dirY = rawDirY / magnitude;
      const dirZ = rawDirZ / magnitude;
      material.rotation = Math.atan2(dirY, dirX);
      // Comets use their own flight loop instead of the whole-field drift, so they read as objects
      // entering and leaving the canvas while dust remains softly suspended around the graph.
      sprite.userData.forceCometFlight = {
        baseX,
        baseY,
        baseZ,
        dirX,
        dirY,
        dirZ,
        distance: Math.max(110, Math.min(260, radiusMax - radiusMin)),
        opacity,
        phase: ((seed * 43) % 100) / 100,
        speed: 0.018 + ((seed * 7) % 100) / 2600,
      };
    }
    sprite.renderOrder = shape === 'comet' ? -18 : shape === 'asteroid' ? -19 : -20;
    group.add(sprite);
  }

  return group;
}

type AtmosphereSpriteShape = 'asteroid' | 'circle' | 'comet' | 'square';

const atmosphereTextureCache = new Map<AtmosphereSpriteShape, CanvasTexture>();
let forceNodeHaloTextureCache: CanvasTexture | null = null;

function getForceNodeHaloTexture() {
  if (forceNodeHaloTextureCache) {
    return forceNodeHaloTextureCache;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) {
    forceNodeHaloTextureCache = new CanvasTexture(canvas);
    return forceNodeHaloTextureCache;
  }

  const gradient = context.createRadialGradient(48, 48, 5, 48, 48, 44);
  gradient.addColorStop(0, 'rgba(255,255,255,0.82)');
  gradient.addColorStop(0.32, 'rgba(255,255,255,0.34)');
  gradient.addColorStop(0.72, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(48, 48, 44, 0, Math.PI * 2);
  context.fill();

  forceNodeHaloTextureCache = new CanvasTexture(canvas);
  return forceNodeHaloTextureCache;
}

function getAtmosphereTexture(shape: AtmosphereSpriteShape) {
  const cached = atmosphereTextureCache.get(shape);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) {
    const fallback = new CanvasTexture(canvas);
    atmosphereTextureCache.set(shape, fallback);
    return fallback;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (shape === 'circle') {
    const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 28);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.92)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(32, 32, 28, 0, Math.PI * 2);
    context.fill();
  } else if (shape === 'square') {
    context.fillStyle = 'rgba(255,255,255,0.94)';
    context.fillRect(18, 18, 28, 28);
  } else if (shape === 'asteroid') {
    const gradient = context.createRadialGradient(30, 24, 4, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.64)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(32, 8);
    context.lineTo(48, 14);
    context.lineTo(56, 30);
    context.lineTo(47, 50);
    context.lineTo(28, 57);
    context.lineTo(12, 46);
    context.lineTo(8, 26);
    context.lineTo(19, 12);
    context.closePath();
    context.fill();
  } else {
    const gradient = context.createLinearGradient(6, 32, 58, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.26)');
    gradient.addColorStop(0.82, 'rgba(255,255,255,0.86)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(32, 32, 28, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.95)';
    context.beginPath();
    context.arc(48, 32, 4.5, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  atmosphereTextureCache.set(shape, texture);
  return texture;
}

function themeAwareAtmosphereAccentSequence(bright: Color, muted: Color, theme: 'dark' | 'light') {
  if (theme === 'dark') {
    return [muted.clone().lerp(bright, 0.35), muted.clone().lerp(bright, 0.55), bright.clone()];
  }
  return [
    muted.clone().lerp(new Color('#f59e0b'), 0.52),
    muted.clone().lerp(new Color('#fbbf24'), 0.48),
    muted.clone().lerp(new Color('#fdba74'), 0.46),
    muted.clone().lerp(new Color('#fde68a'), 0.4),
    muted.clone().lerp(new Color('#fff7cc'), 0.32),
    bright.clone(),
  ];
}

function buildClusterGlowField(nodes: ForceNode[], palette: ForceGraph3DPalette) {
  const group = new Group();
  const byCluster = new Map<string, ForceNode[]>();
  nodes.forEach((node) => {
    const clusterId = node.clusterId || node.type || 'other';
    const cluster = byCluster.get(clusterId) || [];
    cluster.push(node);
    byCluster.set(clusterId, cluster);
  });

  byCluster.forEach((clusterNodes) => {
    if (clusterNodes.length < 3) {
      return;
    }
    const center = clusterNodes.reduce(
      (accumulator, node) => ({
        x: accumulator.x + (node.x || 0) / clusterNodes.length,
        y: accumulator.y + (node.y || 0) / clusterNodes.length,
        z: accumulator.z + (node.z || 0) / clusterNodes.length,
      }),
      { x: 0, y: 0, z: 0 }
    );
    const radius = Math.max(
      ...clusterNodes.map((node) =>
        Math.hypot((node.x || 0) - center.x, (node.y || 0) - center.y, (node.z || 0) - center.z)
      ),
      10
    );
    const baseColor = new Color(String(clusterNodes[0]?.color || palette.nodeHaloSoft)).lerp(
      new Color(palette.nodeHaloSoft),
      0.32
    );
    const material = new MeshPhongMaterial({
      blending: AdditiveBlending,
      color: baseColor,
      depthWrite: false,
      emissive: baseColor,
      emissiveIntensity: 0.16,
      opacity: palette.clusterGlowAlpha,
      side: BackSide,
      transparent: true,
    });
    const mesh = new Mesh(
      new SphereGeometry(Math.min(radius * 1.18, radius + 26), 18, 18),
      material
    );
    mesh.position.set(center.x, center.y, center.z);
    group.add(mesh);
  });

  return group;
}

function createDirectionalLight(color: string, intensity: number, x: number, y: number, z: number) {
  const light = new DirectionalLight(color, intensity);
  light.position.set(x, y, z);
  return light;
}

function forceLabelTone(hexColor: string, opacity: number) {
  const color = new Color(hexColor);
  const red = Math.round(color.r * 255);
  const green = Math.round(color.g * 255);
  const blue = Math.round(color.b * 255);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function forceBackgroundTone(backgroundColor: string, opacity: number) {
  const match = backgroundColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  if (!match) {
    return backgroundColor;
  }
  const [, red, green, blue, alpha] = match;
  const scaledAlpha = Math.min(0.96, Number(alpha) * opacity);
  return `rgba(${red}, ${green}, ${blue}, ${scaledAlpha})`;
}
