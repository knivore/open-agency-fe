'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SigmaGraphDocument, SigmaGraphSelection } from './types';
import { normalizeSigmaGraphDocument } from './normalize';
import { sigmaDocumentToGraphology } from './graphologyAdapter';
import { createConstellationSigmaGraphPositions } from './layout';

export interface SigmaGraphCanvasProps {
  document: SigmaGraphDocument;
  animate?: boolean;
  appearance?: 'default' | 'constellation';
  theme?: 'dark' | 'light';
  rotationAngle?: number;
  className?: string;
  testId?: string;
  selection?: SigmaGraphSelection;
  settings?: Record<string, unknown>;
  onSelectionChange?: (selection: SigmaGraphSelection) => void;
}

export default function SigmaGraphCanvas({
  document,
  animate = false,
  appearance = 'default',
  theme = 'dark',
  rotationAngle = 0,
  className,
  testId,
  selection,
  settings,
  onSelectionChange,
}: SigmaGraphCanvasProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const backdropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<{
    getCamera(): {
      animate(
        state: Partial<{ angle: number; ratio: number; x: number; y: number }>,
        options?: Partial<{ duration: number; easing: string }>
      ): Promise<void>;
      animatedReset(options?: Partial<{ duration: number; easing: string }>): Promise<void>;
      getState(): { angle: number; ratio: number; x: number; y: number };
      on(event: string, handler: (payload?: unknown) => void): void;
      removeListener?(event: string, handler: (payload?: unknown) => void): void;
    };
    kill(): void;
    on(event: string, handler: (payload?: unknown) => void): void;
    refresh(): void;
  } | null>(null);
  const graphRef = useRef<{
    clear(): void;
    forEachEdge(callback: (edge: string, attributes: Record<string, unknown>) => void): void;
    forEachNode(callback: (node: string, attributes: Record<string, unknown>) => void): void;
    setEdgeAttribute(edge: string, key: string, value: unknown): void;
    setNodeAttribute(node: string, key: string, value: unknown): void;
  } | null>(null);
  const selectionStateRef = useRef<SigmaSelectionState | null>(null);
  const hoverClearTimerRef = useRef<number | null>(null);
  const cameraBackdropStateRef = useRef({ ratio: 1, x: 0.5, y: 0.5 });
  const zoomRatioRef = useRef(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState('');
  const normalizedDocument = useMemo(() => normalizeSigmaGraphDocument(document), [document]);
  const selectionState = useMemo(
    () => buildSelectionState(normalizedDocument, selection, hoveredNodeId),
    [hoveredNodeId, normalizedDocument, selection]
  );
  const cameraSelectionState = useMemo(
    () => buildSelectionState(normalizedDocument, selection),
    [normalizedDocument, selection]
  );
  const backdropRegions = useMemo(
    () =>
      appearance === 'constellation'
        ? buildConstellationBackdropRegions(
            normalizedDocument,
            createConstellationSigmaGraphPositions(normalizedDocument, {
              attraction: 0.015,
              clusterGravity: 0.011,
              hubGravity: 0.007,
              iterations: 140,
              repulsion: 0.048,
              scale: 9,
            })
          )
        : [],
    [appearance, normalizedDocument]
  );
  useEffect(() => {
    selectionStateRef.current = selectionState;
  }, [selectionState]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const graph = sigmaDocumentToGraphology(normalizedDocument, { appearance, theme });
    const palette = constellationPalette(theme);
    let animationFrame: number | null = null;
    let disposed = false;
    let teardownCameraUpdated: (() => void) | null = null;

    void import('sigma').then(({ default: Sigma }) => {
      if (disposed || !containerRef.current) {
        return;
      }
      const renderer = new Sigma(graph, containerRef.current, {
        renderEdgeLabels: appearance !== 'constellation',
        enableEdgeEvents: Boolean(onSelectionChange),
        defaultEdgeType: appearance === 'constellation' ? 'line' : 'arrow',
        allowInvalidContainer: true,
        defaultNodeColor: appearance === 'constellation' ? palette.defaultNodeColor : '#999999',
        defaultEdgeColor: appearance === 'constellation' ? palette.defaultEdgeColor : '#94a3b8',
        hideEdgesOnMove: appearance === 'constellation',
        hideLabelsOnMove: false,
        labelColor: {
          color: appearance === 'constellation' ? palette.labelColor : '#111827',
        },
        defaultDrawNodeLabel:
          appearance === 'constellation'
            ? (
                context: CanvasRenderingContext2D,
                data: Record<string, unknown>,
                settings: {
                  labelColor: { color?: string };
                  labelFont: string;
                  labelSize: number;
                  labelWeight: string;
                }
              ) => drawConstellationNodeLabel(context, data, settings, palette)
            : undefined,
        labelDensity: appearance === 'constellation' ? 0.72 : 1,
        labelRenderedSizeThreshold: appearance === 'constellation' ? 10 : 8,
        stagePadding: appearance === 'constellation' ? 48 : 30,
        zIndex: true,
        zoomToSizeRatioFunction:
          appearance === 'constellation' ? (ratio: number) => Math.sqrt(ratio) * 0.92 : undefined,
        defaultDrawNodeHover:
          appearance === 'constellation'
            ? (
                context: CanvasRenderingContext2D,
                data: Record<string, unknown>,
                settings: {
                  labelFont: string;
                  labelSize: number;
                  labelWeight: string;
                }
              ) => drawConstellationNodeHover(context, data, settings, palette)
            : undefined,
        nodeReducer:
          appearance === 'constellation'
            ? (nodeId: string, data: Record<string, unknown>) =>
                reduceConstellationNode(
                  nodeId,
                  data,
                  selectionStateRef.current || buildSelectionState(normalizedDocument),
                  palette,
                  constellationZoomDetail(zoomRatioRef.current)
                )
            : undefined,
        edgeReducer:
          appearance === 'constellation'
            ? (edgeId: string, data: Record<string, unknown>) =>
                reduceConstellationEdge(
                  edgeId,
                  data,
                  selectionStateRef.current || buildSelectionState(normalizedDocument),
                  palette,
                  constellationZoomDetail(zoomRatioRef.current)
                )
            : undefined,
        ...(settings || {}),
      });
      rendererRef.current = renderer;
      graphRef.current = graph;
      const camera = renderer.getCamera();
      cameraBackdropStateRef.current = camera.getState();
      zoomRatioRef.current = cameraBackdropStateRef.current.ratio;
      const handleCameraUpdated = (state?: unknown) => {
        const cameraState =
          typeof state === 'object' && state !== null
            ? {
                ratio:
                  'ratio' in state && Number.isFinite(Number(state.ratio))
                    ? Number(state.ratio)
                    : camera.getState().ratio,
                x:
                  'x' in state && Number.isFinite(Number(state.x))
                    ? Number(state.x)
                    : camera.getState().x,
                y:
                  'y' in state && Number.isFinite(Number(state.y))
                    ? Number(state.y)
                    : camera.getState().y,
              }
            : camera.getState();
        cameraBackdropStateRef.current = cameraState;
        zoomRatioRef.current =
          Number.isFinite(cameraState.ratio) && cameraState.ratio > 0 ? cameraState.ratio : 1;
      };
      camera.on('updated', handleCameraUpdated);
      teardownCameraUpdated = () => camera.removeListener?.('updated', handleCameraUpdated);

      if (onSelectionChange) {
        renderer.on('clickNode', (event: unknown) => {
          const node =
            typeof event === 'object' && event !== null && 'node' in event
              ? String(event.node)
              : '';
          onSelectionChange({ nodeIds: node ? [node] : [], edgeIds: [] });
        });
        renderer.on('clickEdge', (event: unknown) => {
          const edge =
            typeof event === 'object' && event !== null && 'edge' in event
              ? String(event.edge)
              : '';
          onSelectionChange({ nodeIds: [], edgeIds: edge ? [edge] : [] });
        });
        renderer.on('clickStage', () => onSelectionChange({ nodeIds: [], edgeIds: [] }));
      }
      if (appearance === 'constellation') {
        renderer.on('enterNode', (event: unknown) => {
          if (hoverClearTimerRef.current !== null) {
            window.clearTimeout(hoverClearTimerRef.current);
            hoverClearTimerRef.current = null;
          }
          const node =
            typeof event === 'object' && event !== null && 'node' in event
              ? String(event.node)
              : '';
          setHoveredNodeId(node);
        });
        renderer.on('leaveNode', () => {
          if (hoverClearTimerRef.current !== null) {
            window.clearTimeout(hoverClearTimerRef.current);
          }
          // A short linger avoids enter/leave thrash when the node drifts a pixel under the cursor.
          hoverClearTimerRef.current = window.setTimeout(() => {
            setHoveredNodeId('');
            hoverClearTimerRef.current = null;
          }, 90);
        });
      }

      if (appearance === 'constellation') {
        const focusNodeIds = focusNodeIdsForCamera(
          selectionStateRef.current || buildSelectionState(normalizedDocument)
        );
        if (focusNodeIds.size > 0) {
          const focusBounds = graphBoundsForNodes(graph, focusNodeIds);
          if (focusBounds) {
            const focusState = cameraStateForBounds(graphBoundsForNodes(graph), focusBounds);
            // Animating the camera into the selected neighborhood makes local focus feel spatial,
            // closer to Obsidian's graph exploration than a static filter toggle.
            void renderer
              .getCamera()
              .animate(
                {
                  ratio: focusState.ratio,
                  x: focusState.x,
                  y: focusState.y,
                },
                { duration: 520, easing: 'cubicOut' }
              )
              .catch(() => undefined);
          }
        } else {
          void renderer
            .getCamera()
            .animatedReset({ duration: 340, easing: 'quadraticOut' })
            .catch(() => undefined);
        }
      }

      if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const basePositions = new Map<
          string,
          {
            introDelay: number;
            introScale: number;
            phase: number;
            x: number;
            y: number;
          }
        >();
        let index = 0;
        graph.forEachNode((node, attributes) => {
          basePositions.set(String(node), {
            introDelay: appearance === 'constellation' ? index * 0.008 : index * 0.004,
            introScale: appearance === 'constellation' ? 0.18 : 0.35,
            phase: index * 0.45,
            x: Number(attributes.x || 0),
            y: Number(attributes.y || 0),
          });
          index += 1;
        });
        const startedAt = performance.now();
        const tick = (now: number) => {
          if (disposed) {
            return;
          }
          const elapsed = (now - startedAt) / 1000;
          const liveSelectionState =
            selectionStateRef.current || buildSelectionState(normalizedDocument);
          const interactionLocked =
            liveSelectionState.hoveredNodeIds.size > 0 ||
            liveSelectionState.selectedNodeIds.size > 0 ||
            liveSelectionState.selectedEdgeIds.size > 0;
          graph.forEachNode((node, attributes) => {
            const base = basePositions.get(String(node));
            if (!base) {
              return;
            }
            const introDuration = appearance === 'constellation' ? 1.15 : 0.7;
            const introProgress = clampNumberToRange(
              (elapsed - base.introDelay) / introDuration,
              0,
              1
            );
            const settled = easeOutCubic(introProgress);
            const drift = interactionLocked
              ? 0
              : appearance === 'constellation'
                ? 0.0075 + settled * 0.0035
                : 0.024 + settled * 0.011;
            const introX = base.x * (base.introScale + (1 - base.introScale) * settled);
            const introY = base.y * (base.introScale + (1 - base.introScale) * settled);
            const nodeId = String(node);
            const currentFocus = Number(attributes.focusFade ?? 1);
            const targetFocus = constellationNodeFocusTarget(nodeId, liveSelectionState);
            graph.setNodeAttribute(
              node,
              'x',
              introX +
                Math.cos(elapsed * 0.52 + base.phase) * drift +
                Math.sin(elapsed * 0.18 + base.phase * 0.6) * drift * 0.45
            );
            graph.setNodeAttribute(
              node,
              'y',
              introY +
                Math.sin(elapsed * 0.46 + base.phase) * drift +
                Math.cos(elapsed * 0.21 + base.phase * 0.72) * drift * 0.4
            );
            graph.setNodeAttribute(
              node,
              'focusFade',
              currentFocus + (targetFocus - currentFocus) * 0.18
            );
          });
          graph.forEachEdge((edge, attributes) => {
            const edgeId = String(edge);
            const currentFocus = Number(attributes.focusFade ?? 1);
            const targetFocus = constellationEdgeFocusTarget(
              edgeId,
              attributes,
              liveSelectionState
            );
            graph.setEdgeAttribute(
              edge,
              'focusFade',
              currentFocus + (targetFocus - currentFocus) * 0.22
            );
          });
          renderer.refresh();
          animationFrame = window.requestAnimationFrame(tick);
        };
        animationFrame = window.requestAnimationFrame(tick);
      }
    });

    return () => {
      disposed = true;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (hoverClearTimerRef.current !== null) {
        window.clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      teardownCameraUpdated?.();
      rendererRef.current?.kill();
      rendererRef.current = null;
      graphRef.current = null;
      graph.clear();
    };
  }, [animate, appearance, normalizedDocument, onSelectionChange, settings, theme]);

  useEffect(() => {
    if (appearance !== 'constellation' || !shellRef.current || !backdropCanvasRef.current) {
      return;
    }

    const shell = shellRef.current;
    const canvas = backdropCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let disposed = false;
    let animationFrame: number | null = null;
    let width = 0;
    let height = 0;
    const palette = constellationBackdropPalette(theme);
    const particleCount = Math.max(
      120,
      Math.min(260, Math.round(normalizedDocument.nodes.length * 1.45))
    );
    const particles = Array.from({ length: particleCount }, (_, index) =>
      createConstellationBackdropParticle(index)
    );

    const resizeCanvas = () => {
      const nextWidth = Math.max(1, Math.round(shell.clientWidth));
      const nextHeight = Math.max(1, Math.round(shell.clientHeight));
      width = nextWidth;
      height = nextHeight;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(nextWidth * ratio);
      canvas.height = Math.round(nextHeight * ratio);
      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(ratio, ratio);
    };

    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(shell);
    resizeCanvas();

    const draw = (now: number) => {
      if (disposed) {
        return;
      }
      const elapsed = now / 1000;
      context.clearRect(0, 0, width, height);
      const backdropOffset = constellationBackdropOffset(
        cameraBackdropStateRef.current,
        width,
        height
      );
      const zoomScale = clampNumberToRange(
        1 / Math.sqrt(cameraBackdropStateRef.current.ratio || 1),
        0.84,
        1.3
      );

      const glow = context.createRadialGradient(
        width * 0.5 + backdropOffset.glowX,
        height * 0.48 + backdropOffset.glowY,
        Math.min(width, height) * 0.04,
        width * 0.5 + backdropOffset.glowX,
        height * 0.48 + backdropOffset.glowY,
        Math.min(width, height) * 0.44
      );
      glow.addColorStop(0, palette.coreGlow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      backdropRegions.forEach((region) => {
        const centerX = width * region.x + backdropOffset.panX * region.parallax;
        const centerY = height * region.y + backdropOffset.panY * region.parallax;
        const radius = Math.min(width, height) * region.radius * zoomScale;
        const regionGlow = context.createRadialGradient(
          centerX,
          centerY,
          radius * 0.08,
          centerX,
          centerY,
          radius
        );
        regionGlow.addColorStop(0, withAlpha(region.color, palette.clusterGlowAlpha.core));
        regionGlow.addColorStop(0.48, withAlpha(region.color, palette.clusterGlowAlpha.mid));
        regionGlow.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = regionGlow;
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      });

      particles.forEach((particle, index) => {
        const cometProgress =
          particle.kind === 'comet'
            ? ((elapsed * particle.cometSpeed + particle.cometOffset) % 1) * 2 - 1
            : 0;
        const driftX =
          particle.kind === 'comet'
            ? cometProgress * particle.cometTravelX
            : Math.cos(elapsed * particle.speed + particle.phase) * particle.orbitX +
              Math.sin(elapsed * particle.speed * 0.32 + particle.phase * 0.6) *
                particle.orbitX *
                0.28;
        const driftY =
          particle.kind === 'comet'
            ? cometProgress * particle.cometTravelY
            : Math.sin(elapsed * particle.speed * 0.88 + particle.phase) * particle.orbitY +
              Math.cos(elapsed * particle.speed * 0.24 + particle.phase * 0.72) *
                particle.orbitY *
                0.24;
        const x = width * particle.anchorX + driftX + backdropOffset.panX * particle.parallax;
        const y = height * particle.anchorY + driftY + backdropOffset.panY * particle.parallax;
        const alphaPulse =
          particle.kind === 'comet'
            ? 0.32 + Math.sin(((cometProgress + 1) / 2) * Math.PI) * 0.72
            : 0.72 + Math.sin(elapsed * 0.52 + particle.phase + index * 0.03) * 0.12;
        const toneColor =
          particle.kind === 'comet'
            ? palette.cometColor
            : palette.asteroidTones[index % palette.asteroidTones.length];
        drawConstellationBackdropParticle(context, particle, {
          alpha: particle.alpha * alphaPulse,
          color: toneColor,
          elapsed,
          x,
          y,
          zoomScale,
        });
      });

      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [appearance, backdropRegions, normalizedDocument.nodes.length, theme]);

  useEffect(() => {
    if (appearance !== 'constellation' || !rendererRef.current || !graphRef.current) {
      return;
    }
    const focusNodeIds = focusNodeIdsForCamera(cameraSelectionState);
    if (focusNodeIds.size > 0) {
      const focusBounds = graphBoundsForNodes(graphRef.current, focusNodeIds);
      if (focusBounds) {
        const focusState = cameraStateForBounds(graphBoundsForNodes(graphRef.current), focusBounds);
        void rendererRef.current
          .getCamera()
          .animate(
            {
              ratio: focusState.ratio,
              x: focusState.x,
              y: focusState.y,
            },
            { duration: 520, easing: 'cubicOut' }
          )
          .catch(() => undefined);
        return;
      }
    }
    void rendererRef.current
      .getCamera()
      .animatedReset({ duration: 340, easing: 'quadraticOut' })
      .catch(() => undefined);
  }, [appearance, cameraSelectionState]);

  useEffect(() => {
    if (appearance !== 'constellation' || !rendererRef.current) {
      return;
    }
    void rendererRef.current
      .getCamera()
      .animate({ angle: rotationAngle }, { duration: 320, easing: 'quadraticOut' })
      .catch(() => undefined);
  }, [appearance, rotationAngle]);

  return (
    <div
      ref={shellRef}
      className={`relative ${className || ''}`}
      data-testid={testId}
      style={
        appearance === 'constellation'
          ? {
              background: constellationPalette(theme).background,
            }
          : undefined
      }
    >
      {appearance === 'constellation' ? (
        <canvas
          ref={backdropCanvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        />
      ) : null}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}

export { sigmaDocumentToGraphology } from './graphologyAdapter';

interface SigmaSelectionState {
  connectedNodeIds: Set<string>;
  emphasizedEdgeIds: Set<string>;
  hoveredEdgeIds: Set<string>;
  hoveredConnectedNodeIds: Set<string>;
  hoveredNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  selectedNodeIds: Set<string>;
}

function buildSelectionState(
  document: SigmaGraphDocument,
  selection?: SigmaGraphSelection,
  hoveredNodeId?: string
): SigmaSelectionState {
  const selectedNodeIds = new Set(selection?.nodeIds || []);
  const selectedEdgeIds = new Set(selection?.edgeIds || []);
  const hoveredNodeIds = new Set<string>(hoveredNodeId ? [hoveredNodeId] : []);
  const connectedNodeIds = new Set<string>(selectedNodeIds);
  const emphasizedEdgeIds = new Set<string>(selectedEdgeIds);
  const hoveredEdgeIds = new Set<string>();
  const hoveredConnectedNodeIds = new Set<string>(hoveredNodeIds);

  if (selectedEdgeIds.size > 0) {
    document.edges.forEach((edge) => {
      if (!selectedEdgeIds.has(edge.id)) {
        return;
      }
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
  }

  if (selectedNodeIds.size > 0) {
    document.edges.forEach((edge) => {
      if (!selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)) {
        return;
      }
      emphasizedEdgeIds.add(edge.id);
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
  }

  if (hoveredNodeIds.size > 0) {
    document.edges.forEach((edge) => {
      if (!hoveredNodeIds.has(edge.source) && !hoveredNodeIds.has(edge.target)) {
        return;
      }
      hoveredEdgeIds.add(edge.id);
      hoveredConnectedNodeIds.add(edge.source);
      hoveredConnectedNodeIds.add(edge.target);
    });
  }

  return {
    connectedNodeIds,
    emphasizedEdgeIds,
    hoveredEdgeIds,
    hoveredConnectedNodeIds,
    hoveredNodeIds,
    selectedEdgeIds,
    selectedNodeIds,
  };
}

function reduceConstellationNode(
  nodeId: string,
  data: Record<string, unknown>,
  selectionState: SigmaSelectionState,
  palette: ConstellationPalette,
  zoomDetail: ConstellationZoomDetail
) {
  const hasSelection =
    selectionState.selectedNodeIds.size > 0 || selectionState.selectedEdgeIds.size > 0;
  const isSelected = selectionState.selectedNodeIds.has(nodeId);
  const isConnected = selectionState.connectedNodeIds.has(nodeId);
  const isHovered = selectionState.hoveredNodeIds.has(nodeId);
  const isHoverConnected = selectionState.hoveredConnectedNodeIds.has(nodeId);
  const label = typeof data.label === 'string' ? data.label : '';
  const semanticSize = typeof data.size === 'number' ? data.size : 1;
  const focusFade = typeof data.focusFade === 'number' ? data.focusFade : 1;
  const ambientSize = constellationNodeSize(semanticSize) * zoomDetail.nodeScale;
  const ambientLabel = semanticSize >= zoomDetail.ambientLabelThreshold;

  if (!hasSelection && isHovered) {
    return {
      ...data,
      color: palette.selectedNodeColor,
      forceLabel: false,
      hoverLabel: label,
      label: '',
      size: ambientSize + 1.8 + zoomDetail.focusSizeBoost + (1 - focusFade) * 0.2,
      zIndex: 90,
    };
  }

  if (!hasSelection && isHoverConnected) {
    return {
      ...data,
      color: withAlpha(
        normalizeColor(data.color, palette.connectedNodeFallback),
        palette.hoverConnectedNodeAlpha.base + focusFade * palette.hoverConnectedNodeAlpha.gain
      ),
      forceLabel: semanticSize >= zoomDetail.connectedLabelThreshold,
      label: semanticSize >= zoomDetail.connectedLabelThreshold ? label : '',
      size: ambientSize + 0.34 + focusFade * (0.26 + zoomDetail.focusSizeBoost * 0.12),
      zIndex: 28,
    };
  }

  if (!hasSelection) {
    return {
      ...data,
      color: withAlpha(
        normalizeColor(data.color, palette.defaultNodeColor),
        ambientNodeAlpha(semanticSize) *
          (palette.ambientNodeAlpha.base + focusFade * palette.ambientNodeAlpha.gain)
      ),
      forceLabel: ambientLabel && focusFade > zoomDetail.ambientFocusThreshold,
      label: ambientLabel && focusFade > zoomDetail.ambientFocusThreshold ? label : '',
      size: ambientSize * (0.82 + focusFade * (0.1 + zoomDetail.focusSizeBoost * 0.04)),
      zIndex: Math.round(semanticSize),
    };
  }

  if (isSelected) {
    return {
      ...data,
      color: palette.selectedNodeColor,
      forceLabel: true,
      hoverLabel: label,
      label,
      size: ambientSize + 2.2 + zoomDetail.focusSizeBoost + focusFade * 0.44,
      zIndex: 100,
    };
  }

  if (isConnected) {
    return {
      ...data,
      color: withAlpha(
        normalizeColor(data.color, palette.connectedNodeFallback),
        palette.connectedNodeAlpha.base + focusFade * palette.connectedNodeAlpha.gain
      ),
      forceLabel: semanticSize >= zoomDetail.connectedLabelThreshold,
      label: semanticSize >= zoomDetail.connectedLabelThreshold ? label : '',
      size: ambientSize + 0.4 + focusFade * (0.36 + zoomDetail.focusSizeBoost * 0.18),
      zIndex: 48,
    };
  }

  // Dimming unrelated nodes preserves the "selected constellation" mental model without dropping context.
  return {
    ...data,
    color: withAlpha(palette.dimmedNodeColor, palette.dimmedNodeAlpha),
    forceLabel: false,
    label: '',
    size: Math.max(ambientSize * zoomDetail.dimmedNodeScale, 0.82),
    zIndex: 1,
  };
}

function reduceConstellationEdge(
  edgeId: string,
  data: Record<string, unknown>,
  selectionState: SigmaSelectionState,
  palette: ConstellationPalette,
  zoomDetail: ConstellationZoomDetail
) {
  const hasSelection =
    selectionState.selectedNodeIds.size > 0 || selectionState.selectedEdgeIds.size > 0;
  const size = typeof data.size === 'number' ? data.size : 1;
  const focusFade = typeof data.focusFade === 'number' ? data.focusFade : 1;
  const isSelected = selectionState.selectedEdgeIds.has(edgeId);
  const isEmphasized = selectionState.emphasizedEdgeIds.has(edgeId);
  const isHoveredEdge = selectionState.hoveredEdgeIds.has(edgeId);
  const touchesHoveredNode =
    selectionState.hoveredNodeIds.has(String(data.source || '')) ||
    selectionState.hoveredNodeIds.has(String(data.target || ''));

  if (!hasSelection) {
    if (isHoveredEdge || touchesHoveredNode) {
      return {
        ...data,
        color: withAlpha(
          normalizeColor(data.color, palette.emphasizedEdgeFallback),
          palette.hoverEdgeAlpha.base +
            focusFade * palette.hoverEdgeAlpha.gain +
            zoomDetail.edgeDetailBoost
        ),
        size:
          size *
          palette.emphasizedEdgeWidthScale *
          (1.06 + focusFade * (0.18 + zoomDetail.edgeScaleBoost)),
        zIndex: Math.round(size) + 16,
      };
    }
    return {
      ...data,
      color: withAlpha(
        normalizeColor(data.color, palette.ambientEdgeFallback),
        palette.ambientEdgeAlpha.base +
          focusFade * palette.ambientEdgeAlpha.gain +
          zoomDetail.edgeAmbientBoost
      ),
      size: size * palette.ambientEdgeWidthScale,
      zIndex: Math.round(size),
    };
  }

  if (isSelected) {
    return {
      ...data,
      color: withAlpha(
        palette.selectedEdgeColor,
        palette.selectedEdgeAlpha.base +
          focusFade * palette.selectedEdgeAlpha.gain +
          zoomDetail.edgeDetailBoost
      ),
      size:
        size *
        palette.selectedEdgeWidthScale *
        (1.08 + focusFade * (0.34 + zoomDetail.edgeScaleBoost)),
      zIndex: 90,
    };
  }

  if (isEmphasized) {
    return {
      ...data,
      color: withAlpha(
        normalizeColor(data.color, palette.emphasizedEdgeFallback),
        palette.emphasizedEdgeAlpha.base +
          focusFade * palette.emphasizedEdgeAlpha.gain +
          zoomDetail.edgeDetailBoost
      ),
      size:
        size *
        palette.emphasizedEdgeWidthScale *
        (1.01 + focusFade * (0.22 + zoomDetail.edgeScaleBoost)),
      zIndex: 62,
    };
  }

  return {
    ...data,
    color: withAlpha(
      normalizeColor(data.color, palette.dimmedEdgeColor),
      palette.dimmedEdgeAlpha.base +
        focusFade * palette.dimmedEdgeAlpha.gain +
        zoomDetail.edgeAmbientBoost * 0.6
    ),
    size: Math.max(size * palette.dimmedEdgeWidthScale, 0.42),
    zIndex: 1,
  };
}

interface ConstellationZoomDetail {
  ambientFocusThreshold: number;
  ambientLabelThreshold: number;
  connectedLabelThreshold: number;
  dimmedNodeScale: number;
  edgeAmbientBoost: number;
  edgeDetailBoost: number;
  edgeScaleBoost: number;
  focusSizeBoost: number;
  nodeScale: number;
}

function constellationZoomDetail(ratio: number): ConstellationZoomDetail {
  const ratioValue = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const zoomedInProgress = clampNumberToRange((1.2 - ratioValue) / 0.9, 0, 1);
  return {
    ambientFocusThreshold: 0.9 - zoomedInProgress * 0.16,
    ambientLabelThreshold: zoomedInProgress > 0.72 ? 8 : zoomedInProgress > 0.42 ? 10 : 13,
    connectedLabelThreshold: zoomedInProgress > 0.6 ? 7 : 9,
    dimmedNodeScale: 0.68 + zoomedInProgress * 0.14,
    edgeAmbientBoost: zoomedInProgress * 0.08,
    edgeDetailBoost: zoomedInProgress * 0.1,
    edgeScaleBoost: zoomedInProgress * 0.16,
    focusSizeBoost: zoomedInProgress * 0.9,
    nodeScale: 0.9 + zoomedInProgress * 0.18,
  };
}

function constellationNodeSize(semanticSize: number) {
  if (semanticSize >= 18) {
    return 6.2;
  }
  if (semanticSize >= 15) {
    return 5.2;
  }
  if (semanticSize >= 12) {
    return 4.3;
  }
  if (semanticSize >= 9) {
    return 3.5;
  }
  if (semanticSize >= 7) {
    return 2.9;
  }
  return 2.35;
}

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function drawConstellationNodeLabel(
  context: CanvasRenderingContext2D,
  data: Record<string, unknown>,
  settings: {
    labelColor: { color?: string };
    labelFont: string;
    labelSize: number;
    labelWeight: string;
  },
  palette: ConstellationPalette
) {
  const label = truncateCanvasLabel(
    context,
    typeof data.label === 'string' ? data.label : '',
    settings.labelFont,
    settings.labelSize,
    settings.labelWeight,
    360
  );
  if (!label) {
    return;
  }

  context.save();
  context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  const x = Number(data.x || 0);
  const y = Number(data.y || 0);
  const nodeSize = Number(data.size || 0);
  const labelSize = settings.labelSize;
  const color = settings.labelColor.color || palette.labelColor;
  const focusFade = typeof data.focusFade === 'number' ? data.focusFade : 1;
  const labelX = x + nodeSize + 8;
  const textWidth = context.measureText(label).width;
  const glowAlpha = palette.labelGlowAlpha.base + focusFade * palette.labelGlowAlpha.gain;
  const plateAlpha = palette.labelPlateAlpha.base + focusFade * palette.labelPlateAlpha.gain;

  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.fillStyle = alphaColor(palette.labelPlateColor, plateAlpha);
  roundRect(context, labelX - 6, y - labelSize / 2 - 5, textWidth + 12, labelSize + 10, 8);
  context.fill();
  context.strokeStyle = alphaColor(
    palette.labelPlateBorder,
    palette.labelPlateBorderAlpha.base + focusFade * palette.labelPlateBorderAlpha.gain
  );
  context.lineWidth = 1;
  context.stroke();
  context.strokeStyle = alphaColor(
    palette.labelTextStroke,
    palette.labelTextStrokeAlpha.base + focusFade * palette.labelTextStrokeAlpha.gain
  );
  context.lineWidth = 3;
  context.strokeText(label, labelX, y);
  context.fillStyle = color;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = palette.labelShadowBlur;
  context.shadowColor = alphaColor(palette.labelShadowColor, glowAlpha);
  context.fillText(label, labelX, y);
  context.restore();
}

function drawConstellationNodeHover(
  context: CanvasRenderingContext2D,
  data: Record<string, unknown>,
  settings: {
    labelSize: number;
    labelFont: string;
    labelWeight: string;
  },
  palette: ConstellationPalette
) {
  const rawLabel =
    typeof data.hoverLabel === 'string'
      ? data.hoverLabel
      : typeof data.label === 'string'
        ? data.label
        : '';
  const label = truncateCanvasLabel(
    context,
    rawLabel,
    settings.labelFont,
    settings.labelSize,
    settings.labelWeight,
    280
  );
  if (!label) {
    return;
  }
  const x = Number(data.x || 0);
  const y = Number(data.y || 0);
  const nodeSize = Number(data.size || 0);
  const labelSize = settings.labelSize;
  const paddingX = 10;
  const paddingY = 6;
  const radius = 10;
  const chipOffset = Math.max(nodeSize + 10, 16);
  const font = `${settings.labelWeight} ${labelSize}px ${settings.labelFont}`;

  context.save();
  context.font = font;
  const textWidth = context.measureText(label).width;
  const chipWidth = textWidth + paddingX * 2;
  const chipHeight = labelSize + paddingY * 2;
  const chipX = x + chipOffset;
  const chipY = y - chipHeight / 2;

  context.fillStyle = alphaColor(palette.hoverChipColor, palette.hoverChipAlpha);
  context.strokeStyle = alphaColor(palette.hoverChipBorder, palette.hoverChipBorderAlpha);
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x + nodeSize + 2, y);
  context.lineTo(chipX - 6, y);
  context.strokeStyle = alphaColor(palette.hoverConnectorColor, palette.hoverConnectorAlpha);
  context.lineWidth = 1.5;
  context.stroke();
  context.beginPath();
  context.arc(x, y, nodeSize + 4, 0, Math.PI * 2);
  context.fillStyle = alphaColor(palette.hoverHaloColor, palette.hoverHaloAlpha);
  context.fill();
  context.beginPath();
  context.arc(x, y, nodeSize + 2.2, 0, Math.PI * 2);
  context.strokeStyle = alphaColor(palette.hoverRingColor, palette.hoverRingAlpha);
  context.lineWidth = 1.2;
  context.stroke();
  roundRect(context, chipX, chipY, chipWidth, chipHeight, radius);
  context.fillStyle = alphaColor(palette.hoverChipColor, palette.hoverChipAlpha);
  context.fill();
  context.strokeStyle = alphaColor(palette.hoverChipBorder, palette.hoverChipBorderAlpha);
  context.lineWidth = 1;
  context.stroke();

  context.fillStyle = palette.hoverChipTextColor;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = palette.hoverChipShadowBlur;
  context.shadowColor = alphaColor(palette.hoverChipShadowColor, palette.hoverChipShadowAlpha);
  context.textBaseline = 'middle';
  context.fillText(label, chipX + paddingX, y);
  context.restore();
}

function truncateCanvasLabel(
  context: CanvasRenderingContext2D,
  label: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: string,
  maxWidth: number
) {
  if (!label) {
    return '';
  }
  context.save();
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  if (context.measureText(label).width <= maxWidth) {
    context.restore();
    return label;
  }
  const ellipsis = '...';
  let trimmed = label;
  while (trimmed.length > 1) {
    trimmed = trimmed.slice(0, -1);
    if (context.measureText(`${trimmed}${ellipsis}`).width <= maxWidth) {
      context.restore();
      return `${trimmed}${ellipsis}`;
    }
  }
  context.restore();
  return ellipsis;
}

interface ConstellationPalette {
  ambientEdgeAlpha: { base: number; gain: number };
  ambientEdgeFallback: string;
  ambientEdgeWidthScale: number;
  ambientNodeAlpha: { base: number; gain: number };
  background: string;
  connectedNodeAlpha: { base: number; gain: number };
  connectedNodeFallback: string;
  defaultEdgeColor: string;
  defaultNodeColor: string;
  dimmedEdgeAlpha: { base: number; gain: number };
  dimmedEdgeColor: string;
  dimmedEdgeWidthScale: number;
  dimmedNodeAlpha: number;
  dimmedNodeColor: string;
  emphasizedEdgeAlpha: { base: number; gain: number };
  emphasizedEdgeFallback: string;
  emphasizedEdgeWidthScale: number;
  hoverChipAlpha: number;
  hoverChipBorder: string;
  hoverChipBorderAlpha: number;
  hoverChipColor: string;
  hoverConnectorAlpha: number;
  hoverConnectorColor: string;
  hoverHaloAlpha: number;
  hoverHaloColor: string;
  hoverRingAlpha: number;
  hoverRingColor: string;
  hoverChipShadowAlpha: number;
  hoverChipShadowBlur: number;
  hoverChipShadowColor: string;
  hoverChipTextColor: string;
  hoverConnectedNodeAlpha: { base: number; gain: number };
  hoverEdgeAlpha: { base: number; gain: number };
  labelColor: string;
  labelGlowAlpha: { base: number; gain: number };
  labelPlateAlpha: { base: number; gain: number };
  labelPlateBorder: string;
  labelPlateBorderAlpha: { base: number; gain: number };
  labelPlateColor: string;
  labelShadowBlur: number;
  labelShadowColor: string;
  labelTextStroke: string;
  labelTextStrokeAlpha: { base: number; gain: number };
  selectedEdgeAlpha: { base: number; gain: number };
  selectedEdgeColor: string;
  selectedEdgeWidthScale: number;
  selectedNodeColor: string;
}

function constellationPalette(theme: 'dark' | 'light'): ConstellationPalette {
  if (theme === 'light') {
    return {
      ambientEdgeAlpha: { base: 0.66, gain: 0.14 },
      ambientEdgeFallback: '#334155',
      ambientEdgeWidthScale: 1.18,
      ambientNodeAlpha: { base: 0.94, gain: 0.08 },
      background: 'linear-gradient(180deg, rgba(245,248,252,0.98) 0%, rgba(228,236,246,0.98) 100%)',
      connectedNodeAlpha: { base: 0.92, gain: 0.08 },
      connectedNodeFallback: '#0f172a',
      defaultEdgeColor: '#334155',
      defaultNodeColor: '#1e293b',
      dimmedEdgeAlpha: { base: 0.52, gain: 0.08 },
      dimmedEdgeColor: '#64748b',
      dimmedEdgeWidthScale: 0.94,
      dimmedNodeAlpha: 0.98,
      dimmedNodeColor: '#475569',
      emphasizedEdgeAlpha: { base: 0.62, gain: 0.16 },
      emphasizedEdgeFallback: '#1e293b',
      emphasizedEdgeWidthScale: 1.22,
      hoverChipAlpha: 0.98,
      hoverChipBorder: '#60a5fa',
      hoverChipBorderAlpha: 0.62,
      hoverChipColor: '#f8fbff',
      hoverConnectorAlpha: 0.52,
      hoverConnectorColor: '#1d4ed8',
      hoverHaloAlpha: 0.1,
      hoverHaloColor: '#93c5fd',
      hoverRingAlpha: 0.72,
      hoverRingColor: '#1d4ed8',
      hoverChipShadowAlpha: 0.18,
      hoverChipShadowBlur: 18,
      hoverChipShadowColor: '#93c5fd',
      hoverChipTextColor: '#020617',
      hoverConnectedNodeAlpha: { base: 0.94, gain: 0.06 },
      hoverEdgeAlpha: { base: 0.72, gain: 0.12 },
      labelColor: '#020617',
      labelGlowAlpha: { base: 0.004, gain: 0.01 },
      labelPlateAlpha: { base: 0.95, gain: 0.04 },
      labelPlateBorder: '#60a5fa',
      labelPlateBorderAlpha: { base: 0.26, gain: 0.1 },
      labelPlateColor: '#f8fbff',
      labelShadowBlur: 8,
      labelShadowColor: '#93c5fd',
      labelTextStroke: '#ffffff',
      labelTextStrokeAlpha: { base: 0.92, gain: 0.04 },
      selectedEdgeAlpha: { base: 0.78, gain: 0.16 },
      selectedEdgeColor: '#0f172a',
      selectedEdgeWidthScale: 1.3,
      selectedNodeColor: '#020617',
    };
  }
  return {
    ambientEdgeAlpha: { base: 0.08, gain: 0.06 },
    ambientEdgeFallback: '#52525b',
    ambientEdgeWidthScale: 1,
    ambientNodeAlpha: { base: 0.55, gain: 0.45 },
    background:
      'radial-gradient(circle at 50% 45%, rgba(63,63,70,0.35), rgba(24,24,27,0.96) 45%, rgba(10,10,12,1) 100%)',
    connectedNodeAlpha: { base: 0.58, gain: 0.34 },
    connectedNodeFallback: '#d4d4d8',
    defaultEdgeColor: '#3f3f46',
    defaultNodeColor: '#d4d4d8',
    dimmedEdgeAlpha: { base: 0.01, gain: 0.025 },
    dimmedEdgeColor: '#52525b',
    dimmedEdgeWidthScale: 1,
    dimmedNodeAlpha: 1,
    dimmedNodeColor: '#3f3f46',
    emphasizedEdgeAlpha: { base: 0.3, gain: 0.34 },
    emphasizedEdgeFallback: '#d4d4d8',
    emphasizedEdgeWidthScale: 1,
    hoverChipAlpha: 0.96,
    hoverChipBorder: '#bfdbfe',
    hoverChipBorderAlpha: 0.34,
    hoverChipColor: '#060a12',
    hoverConnectorAlpha: 0.34,
    hoverConnectorColor: '#cbd5e1',
    hoverHaloAlpha: 0.16,
    hoverHaloColor: '#93c5fd',
    hoverRingAlpha: 0.56,
    hoverRingColor: '#e2e8f0',
    hoverChipShadowAlpha: 0.35,
    hoverChipShadowBlur: 12,
    hoverChipShadowColor: '#0f172a',
    hoverChipTextColor: '#f8fbff',
    hoverConnectedNodeAlpha: { base: 0.6, gain: 0.32 },
    hoverEdgeAlpha: { base: 0.34, gain: 0.24 },
    labelColor: '#e8eef8',
    labelGlowAlpha: { base: 0.18, gain: 0.24 },
    labelPlateAlpha: { base: 0.28, gain: 0.18 },
    labelPlateBorder: '#e2e8f0',
    labelPlateBorderAlpha: { base: 0.08, gain: 0.08 },
    labelPlateColor: '#060a12',
    labelShadowBlur: 14,
    labelShadowColor: '#0f172a',
    labelTextStroke: '#020617',
    labelTextStrokeAlpha: { base: 0.9, gain: -0.12 },
    selectedEdgeAlpha: { base: 0.5, gain: 0.28 },
    selectedEdgeColor: '#f4f4f5',
    selectedEdgeWidthScale: 1,
    selectedNodeColor: '#fafafa',
  };
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function ambientNodeAlpha(semanticSize: number) {
  if (semanticSize >= 18) {
    return 0.92;
  }
  if (semanticSize >= 12) {
    return 0.82;
  }
  if (semanticSize >= 9) {
    return 0.76;
  }
  return 0.68;
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return hex;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function alphaColor(hex: string, alpha: number) {
  return withAlpha(hex, alpha);
}

function focusNodeIdsForCamera(selectionState: SigmaSelectionState) {
  if (selectionState.selectedNodeIds.size > 0) {
    return selectionState.connectedNodeIds;
  }
  if (selectionState.selectedEdgeIds.size > 0) {
    return selectionState.connectedNodeIds;
  }
  return new Set<string>();
}

function constellationNodeFocusTarget(nodeId: string, selectionState: SigmaSelectionState) {
  const hasSelection =
    selectionState.selectedNodeIds.size > 0 || selectionState.selectedEdgeIds.size > 0;
  if (!hasSelection) {
    if (selectionState.hoveredNodeIds.has(nodeId)) {
      return 1;
    }
    if (selectionState.hoveredConnectedNodeIds.has(nodeId)) {
      return 0.86;
    }
    return 0.72;
  }
  if (selectionState.selectedNodeIds.has(nodeId)) {
    return 1;
  }
  if (selectionState.connectedNodeIds.has(nodeId)) {
    return 0.9;
  }
  return 0.16;
}

function constellationEdgeFocusTarget(
  edgeId: string,
  attributes: Record<string, unknown>,
  selectionState: SigmaSelectionState
) {
  const hasSelection =
    selectionState.selectedNodeIds.size > 0 || selectionState.selectedEdgeIds.size > 0;
  const touchesHoveredNode =
    selectionState.hoveredNodeIds.has(String(attributes.source || '')) ||
    selectionState.hoveredNodeIds.has(String(attributes.target || ''));
  if (!hasSelection) {
    if (selectionState.hoveredEdgeIds.has(edgeId) || touchesHoveredNode) {
      return 1;
    }
    return 0.45;
  }
  if (selectionState.selectedEdgeIds.has(edgeId)) {
    return 1;
  }
  if (selectionState.emphasizedEdgeIds.has(edgeId)) {
    return 0.88;
  }
  return 0.08;
}

function graphBoundsForNodes(
  graph: {
    forEachNode(callback: (node: string, attributes: Record<string, unknown>) => void): void;
  },
  nodeIds?: Set<string>
) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let count = 0;

  graph.forEachNode((node, attributes) => {
    if (nodeIds && !nodeIds.has(String(node))) {
      return;
    }
    const x = Number(attributes.x || 0);
    const y = Number(attributes.y || 0);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    count += 1;
  });

  if (count === 0) {
    return null;
  }

  return { maxX, maxY, minX, minY };
}

function cameraStateForBounds(
  graphBounds: ReturnType<typeof graphBoundsForNodes>,
  focusBounds: NonNullable<ReturnType<typeof graphBoundsForNodes>>
) {
  if (!graphBounds) {
    return { ratio: 0.18, x: 0.5, y: 0.5 };
  }
  const graphSpan = Math.max(
    graphBounds.maxX - graphBounds.minX,
    graphBounds.maxY - graphBounds.minY,
    0.001
  );
  const focusSpan = Math.max(
    focusBounds.maxX - focusBounds.minX,
    focusBounds.maxY - focusBounds.minY,
    0.001
  );
  const graphCenterX = (graphBounds.minX + graphBounds.maxX) / 2;
  const graphCenterY = (graphBounds.minY + graphBounds.maxY) / 2;
  const focusCenterX = (focusBounds.minX + focusBounds.maxX) / 2;
  const focusCenterY = (focusBounds.minY + focusBounds.maxY) / 2;
  const paddedRatio = Math.max((focusSpan / graphSpan) * 2.75, 0.11);
  return {
    ratio: Math.min(paddedRatio, 1),
    x: clampNumberToRange(0.5 + (focusCenterX - graphCenterX) / graphSpan, 0.08, 0.92),
    y: clampNumberToRange(0.5 + (focusCenterY - graphCenterY) / graphSpan, 0.08, 0.92),
  };
}

function clampNumberToRange(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function constellationBackdropPalette(theme: 'dark' | 'light') {
  if (theme === 'light') {
    return {
      accentColors: ['#d97706', '#f59e0b', '#ca8a04', '#0f766e', '#7c3aed'],
      asteroidTones: ['#6b7280', '#78716c', '#94a3b8', '#a8a29e', '#475569', '#9ca3af'],
      clusterGlowAlpha: { core: 0.08, mid: 0.03 },
      cometColor: '#64748b',
      coreGlow: 'rgba(251,191,36,0.12)',
      edgeColor: '#d6a54f',
      softColor: '#eab308',
    } as const;
  }
  return {
    accentColors: ['#67e8f9', '#93c5fd', '#34d399', '#fbbf24', '#c4b5fd'],
    asteroidTones: ['#52525b', '#71717a', '#94a3b8', '#a1a1aa', '#3f3f46', '#78716c'],
    clusterGlowAlpha: { core: 0.13, mid: 0.05 },
    cometColor: '#94a3b8',
    coreGlow: 'rgba(56,189,248,0.11)',
    edgeColor: '#e4e4e7',
    softColor: '#7dd3fc',
  } as const;
}

interface ConstellationBackdropParticle {
  alpha: number;
  anchorX: number;
  anchorY: number;
  cometAngle: number;
  cometOffset: number;
  cometSpeed: number;
  cometTravelX: number;
  cometTravelY: number;
  colorTone: 'edge' | 'soft' | 'accent';
  height: number;
  kind: 'asteroid' | 'comet' | 'dust' | 'square';
  orbitX: number;
  orbitY: number;
  parallax: number;
  phase: number;
  radius: number;
  rotation: number;
  speed: number;
  width: number;
}

interface ConstellationBackdropRegion {
  color: string;
  parallax: number;
  radius: number;
  x: number;
  y: number;
}

function createConstellationBackdropParticle(index: number): ConstellationBackdropParticle {
  const seed = (index + 3) * 9301;
  const normalized = ((seed * 49297) % 233280) / 233280;
  const secondary = ((seed * 233) % 1000) / 1000;
  const tertiary = ((seed * 71) % 1000) / 1000;
  const kind =
    index % 27 === 0 ? 'comet' : tertiary > 0.76 ? 'asteroid' : tertiary > 0.58 ? 'square' : 'dust';
  const radius =
    kind === 'asteroid'
      ? 1.9 + tertiary * 2.4
      : kind === 'square'
        ? 1.1 + tertiary * 1.3
        : 0.72 + tertiary * 0.72;
  const cometAngle = normalized * Math.PI * 2;
  return {
    alpha:
      kind === 'comet'
        ? 0.26 + tertiary * 0.18
        : kind === 'asteroid'
          ? 0.18 + tertiary * 0.18
          : 0.12 + tertiary * 0.14,
    anchorX: 0.12 + normalized * 0.76,
    anchorY: 0.12 + secondary * 0.76,
    cometAngle,
    cometOffset: secondary,
    cometSpeed: 0.035 + normalized * 0.035,
    cometTravelX: Math.cos(cometAngle) * (180 + tertiary * 120),
    cometTravelY: Math.sin(cometAngle) * (74 + secondary * 72),
    colorTone: tertiary > 0.76 ? 'accent' : tertiary > 0.52 ? 'soft' : 'edge',
    height: kind === 'comet' ? 2.8 + tertiary * 2.2 : radius * 2,
    kind,
    orbitX: 3 + normalized * 14,
    orbitY: 3 + secondary * 11,
    parallax: 0.5 + tertiary * 0.7,
    phase: tertiary * Math.PI * 2,
    radius,
    rotation: normalized * Math.PI * 2,
    speed: 0.08 + normalized * 0.18,
    width: kind === 'comet' ? 36 + normalized * 54 : radius * 2,
  };
}

function drawConstellationBackdropParticle(
  context: CanvasRenderingContext2D,
  particle: ConstellationBackdropParticle,
  {
    alpha,
    color,
    elapsed,
    x,
    y,
    zoomScale,
  }: {
    alpha: number;
    color: string;
    elapsed: number;
    x: number;
    y: number;
    zoomScale: number;
  }
) {
  const twinkle = 0.84 + Math.sin(elapsed * 0.42 + particle.phase) * 0.16;
  context.save();
  context.translate(x, y);
  context.rotate(
    particle.kind === 'comet'
      ? particle.cometAngle
      : particle.rotation + Math.sin(elapsed * 0.05 + particle.phase) * 0.05
  );
  context.fillStyle = withAlpha(color, alpha * twinkle);
  context.strokeStyle = withAlpha(color, alpha * 0.62);
  if (particle.kind === 'comet') {
    const width = particle.width * zoomScale;
    const height = particle.height * zoomScale;
    const gradient = context.createLinearGradient(-width / 2, 0, width / 2, 0);
    gradient.addColorStop(0, withAlpha(color, 0));
    gradient.addColorStop(0.24, withAlpha(color, alpha * 0.1));
    gradient.addColorStop(0.58, withAlpha(color, alpha * 0.32));
    gradient.addColorStop(0.88, withAlpha(color, alpha * 0.9));
    gradient.addColorStop(1, withAlpha(color, alpha * 0.12));
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.fill();
    const wakeWidth = width * (0.44 + Math.sin(elapsed * 1.6 + particle.phase) * 0.08);
    const wakeGradient = context.createLinearGradient(-wakeWidth / 2, 0, wakeWidth / 2, 0);
    wakeGradient.addColorStop(0, withAlpha(color, 0));
    wakeGradient.addColorStop(0.72, withAlpha(color, alpha * 0.3));
    wakeGradient.addColorStop(1, withAlpha(color, alpha * 0.04));
    context.fillStyle = wakeGradient;
    context.beginPath();
    context.ellipse(-width * 0.2, 0, wakeWidth / 2, height * 0.34, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = withAlpha(color, alpha * 1.08);
    context.beginPath();
    context.arc(width * 0.42, 0, Math.max(1.2, height * 0.54), 0, Math.PI * 2);
    context.fill();
  } else if (particle.kind === 'asteroid') {
    const radius = particle.radius * zoomScale;
    const dent = 0.12 + ((particle.phase * 100) % 9) / 80;
    context.beginPath();
    context.moveTo(radius * 0.15, -radius);
    context.lineTo(radius * (0.82 + dent), -radius * 0.42);
    context.lineTo(radius * 0.78, radius * 0.64);
    context.lineTo(-radius * (0.04 + dent), radius);
    context.lineTo(-radius * 0.9, radius * 0.36);
    context.lineTo(-radius * 0.72, -radius * (0.62 + dent));
    context.closePath();
    context.fill();
  } else if (particle.kind === 'square') {
    const width = particle.radius * (1.5 + Math.sin(particle.phase) * 0.28) * zoomScale;
    const height = particle.radius * (1.15 + Math.cos(particle.phase) * 0.22) * zoomScale;
    context.fillRect(-width / 2, -height / 2, width, height);
  } else {
    context.beginPath();
    context.arc(0, 0, particle.radius * zoomScale, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function buildConstellationBackdropRegions(
  document: SigmaGraphDocument,
  positions: Record<string, { x: number; y: number }>
) {
  const bounds = graphBoundsForPositionEntries(Object.values(positions));
  if (!bounds) {
    return [] as ConstellationBackdropRegion[];
  }
  const byCluster = new Map<
    string,
    {
      color: string;
      points: { x: number; y: number }[];
    }
  >();
  document.nodes.forEach((node) => {
    const point = positions[node.id];
    if (!point) {
      return;
    }
    const clusterId = node.clusterId || node.type || 'other';
    const cluster = byCluster.get(clusterId) || {
      color: node.color || normalizeColor(undefined, '#7dd3fc'),
      points: [],
    };
    cluster.points.push(point);
    if (!byCluster.has(clusterId)) {
      byCluster.set(clusterId, cluster);
    }
  });

  const spanX = Math.max(bounds.maxX - bounds.minX, 0.001);
  const spanY = Math.max(bounds.maxY - bounds.minY, 0.001);
  return Array.from(byCluster.values())
    .filter((cluster) => cluster.points.length >= 3)
    .map((cluster) => {
      const center = cluster.points.reduce(
        (accumulator, point) => ({
          x: accumulator.x + point.x / cluster.points.length,
          y: accumulator.y + point.y / cluster.points.length,
        }),
        { x: 0, y: 0 }
      );
      const spread = Math.max(
        ...cluster.points.map((point) => Math.hypot(point.x - center.x, point.y - center.y)),
        12
      );
      return {
        color: cluster.color,
        parallax: 0.62,
        radius: clampNumberToRange((spread / Math.max(spanX, spanY)) * 2.4, 0.08, 0.22),
        x: clampNumberToRange((center.x - bounds.minX) / spanX, 0.08, 0.92),
        y: clampNumberToRange((center.y - bounds.minY) / spanY, 0.08, 0.92),
      };
    });
}

function graphBoundsForPositionEntries(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return null;
  }
  return points.reduce(
    (bounds, point) => ({
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
    }
  );
}

function constellationBackdropOffset(
  cameraState: { ratio: number; x: number; y: number },
  width: number,
  height: number
) {
  const ratio = Number.isFinite(cameraState.ratio) && cameraState.ratio > 0 ? cameraState.ratio : 1;
  const x = Number.isFinite(cameraState.x) ? cameraState.x : 0.5;
  const y = Number.isFinite(cameraState.y) ? cameraState.y : 0.5;
  const panScale = clampNumberToRange(1 / Math.sqrt(ratio), 0.72, 1.34);
  return {
    glowX: (x - 0.5) * width * 0.2 * panScale,
    glowY: (y - 0.5) * height * 0.18 * panScale,
    panX: (x - 0.5) * width * 0.34 * panScale,
    panY: (y - 0.5) * height * 0.3 * panScale,
  };
}
