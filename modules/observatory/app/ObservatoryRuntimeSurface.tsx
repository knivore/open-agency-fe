'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';

import ObservatoryGameCanvas from '@/modules/observatory/components/ObservatoryGameCanvas';
import RuntimeActivityFeed, {
  type ObservatoryFeedLevelFilter,
} from '@/modules/observatory/components/RuntimeActivityFeed';
import RuntimeRawEventPanel from '@/modules/observatory/components/RuntimeRawEventPanel';
import RuntimeReplayControls from '@/modules/observatory/components/RuntimeReplayControls';
import RuntimeSourceManager from '@/modules/observatory/components/RuntimeSourceManager';
import RuntimeStateSummary from '@/modules/observatory/components/RuntimeStateSummary';
import {
  dispatchObservatoryAgentVisualState,
  type ObservatoryAgentVisualState,
} from '@/modules/observatory/engine/rendering/agentVisualState';
import {
  isObservatoryGridWalkable,
  observatoryRoomInteriorBounds,
  pickObservatoryObjectAdjacentWalkablePoint,
} from '@/modules/observatory/engine/rendering/agentBehaviorTargets';
import { pointInGridRect } from '@/modules/observatory/engine/world/grid';
import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import { getObservatoryModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleAssetRegistry';
import type {
  ObservatoryCanvasGridClick,
  ObservatoryCanvasSelection,
} from '@/modules/observatory/engine/selection';
import type { RunSessionSummary } from '@/types/runtime';
import type { WorkflowDefinition } from '@/types/workflows';
import {
  cloneObservatoryLayout,
  deleteObservatoryObject,
  deleteObservatoryRoom,
  duplicateObservatoryObject,
  moveObservatoryRoom,
  type ObservatoryLayoutEditResult,
  resizeObservatoryRoom,
  setObservatoryRoomFloorAsset,
  setObservatoryRoomFloorCellAsset,
  setObservatoryRoomWallAsset,
  setObservatoryRoomWallCellAsset,
  toggleObservatoryRoomWallCellKind,
  toggleObservatoryRoomWallTile,
  updateObservatoryObject,
} from '@/modules/observatory/engine/world/layoutEditing';
import type {
  ObservatoryLayoutDocument,
  ObservatoryLayoutIssue,
  ObservatoryObjectRenderOptions,
} from '@/modules/observatory/engine/world/layoutTypes';
import {
  readObservatoryDraftLayoutFromStorage,
  readObservatoryViewerLayoutFromStorage,
} from '@/modules/observatory/engine/world/layoutPersistence';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import repoPublishedLayout from '@/modules/observatory/layouts/publishedLayout.json';
import { createObservatoryLocalSdkClient } from '@/modules/observatory/integrations/localSdkClient';
import { createObservatoryPostMessageReceiver } from '@/modules/observatory/integrations/postMessageBridge';
import { createObservatorySourceRegistry } from '@/modules/observatory/integrations/sourceRegistry';
import { normalizeObservatoryRuntimeEvent } from '@/modules/observatory/runtime/eventNormalizer';
import type {
  ObservatoryEventValidationIssue,
  ObservatoryNormalizedOfficeEvent,
} from '@/modules/observatory/runtime/events';
import { observatoryRuntimeDemoFixtures } from '@/modules/observatory/runtime/demoFixtures';
import {
  createObservatoryLayoutInspectionLogEntries,
  createObservatoryRuntimeContextInspectionLogEntries,
  createObservatoryStaticRuntimeLogAdapter,
  type ObservatoryInspectionLogEntry,
  type ObservatoryInspectionLogResult,
  type ObservatoryInspectionLogSource,
  type ObservatoryRuntimeLogAdapter,
} from '@/modules/observatory/runtime/inspectionLogs';
import { observatorySampleExternalRuntimeEvents } from '@/modules/observatory/runtime/sampleEvents';
import {
  mapRuntimeStateToAgentVisualStates,
  mapRuntimeStateToRoomVisualStates,
} from '@/modules/observatory/runtime/visualBehaviorMapping';
import {
  type ObservatoryAgentVisibilityMode,
  readObservatoryAgentVisibilityMode,
  writeObservatoryAgentVisibilityMode,
} from '@/modules/observatory/runtime/agentVisibility';
import {
  createInitialObservatoryRuntimeVisualState,
  reduceObservatoryRuntimeEvents,
} from '@/modules/observatory/runtime/visualState';
import { createObservatoryRuntimeVisualStore } from '@/modules/observatory/state/runtimeVisualStore';
import { useObservatoryRuntimeVisualStoreSnapshot } from '@/modules/observatory/state/useRuntimeVisualStore';

import styles from './ObservatoryRuntimeSurface.module.css';

const AssetPackSummary = dynamic(
  () => import('@/modules/observatory/components/AssetPackSummary'),
  { ssr: false }
);
const ManualLayoutEditorPanel = dynamic(
  () => import('@/modules/observatory/components/ManualLayoutEditorPanel'),
  { ssr: false }
);

export interface ObservatoryRuntimeSurfaceProps {
  agents?: ObservatoryRuntimeAgentSource[];
  compact?: boolean;
  mode?: 'builder' | 'viewer' | 'embed';
  readOnly?: boolean;
  layoutSource?: 'repo' | 'storedOrRepo';
  runtimeObjectOverlays?: boolean;
  runtimeContext?: ObservatoryRuntimeRunContext[];
  runtimePreviewMode?: ObservatoryRuntimePreviewMode;
  runs?: RunSessionSummary[];
  useLayoutAgentsWhenEmpty?: boolean;
}

export type ObservatoryRuntimePreviewMode = 'historical' | 'live';

export interface ObservatoryRuntimeAgentSource {
  assignedWorkflows?: Array<{
    id: string;
    name?: string | null;
  }>;
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
}

export interface ObservatoryRuntimeRunContext {
  events: ObservatoryRuntimeEventContext[];
  logs: string[];
  run: RunSessionSummary;
  workflow: WorkflowDefinition | null;
}

export interface ObservatoryRuntimeEventContext {
  agentId?: string | null;
  eventType: string;
  message: string;
  sequence: number;
  taskId?: string | null;
  timestamp?: string | null;
}

export default function ObservatoryRuntimeSurface({
  agents = [],
  compact = false,
  layoutSource = 'storedOrRepo',
  mode,
  readOnly = false,
  runtimeContext = [],
  runtimeObjectOverlays = true,
  runtimePreviewMode = 'live',
  runs = [],
  useLayoutAgentsWhenEmpty = true,
}: ObservatoryRuntimeSurfaceProps) {
  const resolvedMode = mode ?? (compact || readOnly ? 'embed' : 'builder');
  const isBuilderMode = resolvedMode === 'builder';
  const isViewerMode = resolvedMode === 'viewer';
  const isEmbedMode = resolvedMode === 'embed';
  const normalizedSampleEvents = useMemo(
    () =>
      observatorySampleExternalRuntimeEvents.flatMap((event) => {
        const result = normalizeObservatoryRuntimeEvent(event);
        return result.event ? [result.event] : [];
      }),
    []
  );
  const seededRuntimeEvents = useMemo(
    () => (isBuilderMode ? normalizedSampleEvents : []),
    [isBuilderMode, normalizedSampleEvents]
  );
  const initialRuntimeState = useMemo(
    () =>
      reduceObservatoryRuntimeEvents(
        createInitialObservatoryRuntimeVisualState(),
        seededRuntimeEvents
      ),
    [seededRuntimeEvents]
  );
  const runtimeStore = useMemo(
    () => createObservatoryRuntimeVisualStore(initialRuntimeState),
    [initialRuntimeState]
  );
  const state = useObservatoryRuntimeVisualStoreSnapshot(runtimeStore);
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState<ObservatoryFeedLevelFilter>('all');
  const [bridgeIssues, setBridgeIssues] = useState<ObservatoryEventValidationIssue[]>([]);
  const [rawEventIssues, setRawEventIssues] = useState<ObservatoryEventValidationIssue[]>([]);
  const [acceptedEventCount, setAcceptedEventCount] = useState(seededRuntimeEvents.length);
  const [ambientTick, setAmbientTick] = useState(0);
  const [replayEvents, setReplayEvents] =
    useState<ObservatoryNormalizedOfficeEvent[]>(seededRuntimeEvents);
  const [replayCursor, setReplayCursor] = useState(seededRuntimeEvents.length - 1);
  const replayEventsRef = useRef<ObservatoryNormalizedOfficeEvent[]>(seededRuntimeEvents);
  const activeRoomHudIdRef = useRef<string | null>(null);
  const ambientSocialStateRef = useRef<AmbientSocialState>(createAmbientSocialState());
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [assetPackOpen, setAssetPackOpen] = useState(false);
  const [canvasSelection, setCanvasSelection] = useState<ObservatoryCanvasSelection | null>(null);
  const [canvasWallEditRoom, setCanvasWallEditRoom] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [canvasWallEditEnabled, setCanvasWallEditEnabled] = useState(false);
  const [canvasWallEditTool, setCanvasWallEditTool] = useState<
    'door' | 'floor' | 'opening' | 'paint' | 'tile'
  >('opening');
  const [canvasEditResult, setCanvasEditResult] = useState<ObservatoryLayoutEditResult | null>(
    null
  );
  const [builderCanvasPresentation, setBuilderCanvasPresentation] = useState<
    'builder' | 'viewerCompact' | 'viewerFull'
  >('builder');
  const [builderCameraLocked, setBuilderCameraLocked] = useState(false);
  const [builderRuntimeDemoId, setBuilderRuntimeDemoId] = useState('none');
  const [builderAgentVisibilityDefault, setBuilderAgentVisibilityDefault] =
    useState<ObservatoryAgentVisibilityMode>('workflow');
  const [builderPaletteSelection, setBuilderPaletteSelection] = useState<{
    assetId: string;
    category: string;
    label: string;
  } | null>(null);
  const [roomHudFloorAssetId, setRoomHudFloorAssetId] = useState<string | null>(null);
  const [roomHudWallBrushAssetId, setRoomHudWallBrushAssetId] = useState<string | null>(null);
  const [viewerRoomFilter, setViewerRoomFilter] = useState<
    'all' | 'commons' | 'runtime' | 'workspace'
  >('all');
  const [viewerLayerFilter, setViewerLayerFilter] = useState<'all' | 'agents' | 'objects'>('all');
  const [viewerSearch, setViewerSearch] = useState('');
  const [viewerMapId, setViewerMapId] = useState<string | null>(null);
  const [sampleEventCursor, setSampleEventCursor] = useState(0);
  const [layout, setLayout] = useState<ObservatoryLayoutDocument | null>(() =>
    isBuilderMode ? createRepoPublishedLayout() : null
  );
  const [viewerLayoutStatus, setViewerLayoutStatus] = useState<
    'invalid' | 'loading' | 'missing' | 'ready'
  >(isBuilderMode ? 'ready' : 'loading');
  const [viewerLayoutIssues, setViewerLayoutIssues] = useState<ObservatoryLayoutIssue[]>([]);
  const sourceRegistry = useMemo(() => createObservatorySourceRegistry(), []);
  const sourceStatuses = useMemo(() => sourceRegistry.listSources(), [sourceRegistry]);

  useEffect(() => {
    if (!isBuilderMode) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBuilderAgentVisibilityDefault(readObservatoryAgentVisibilityMode('workflow'));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isBuilderMode]);

  const builderRuntimeDemo = useMemo(
    () =>
      observatoryRuntimeDemoFixtures.find((fixture) => fixture.id === builderRuntimeDemoId) ?? null,
    [builderRuntimeDemoId]
  );
  const effectiveAgents = builderRuntimeDemo?.agents ?? agents;
  const effectiveRuntimeContext = builderRuntimeDemo?.runtimeContext ?? runtimeContext;
  const effectiveRuntimePreviewMode: ObservatoryRuntimePreviewMode = builderRuntimeDemo
    ? 'live'
    : runtimePreviewMode;
  const effectiveRuns = builderRuntimeDemo
    ? builderRuntimeDemo.runtimeContext.map((context) => context.run)
    : runs;
  const isRuntimeCanvasMode = isViewerMode || isEmbedMode || Boolean(builderRuntimeDemo);
  const canvasViewFilter = useMemo(() => {
    if (!isViewerMode && !isEmbedMode) {
      return undefined;
    }

    return {
      layer: viewerLayerFilter,
      roomKind: viewerRoomFilter,
      search: viewerSearch,
    };
  }, [isEmbedMode, isViewerMode, viewerLayerFilter, viewerRoomFilter, viewerSearch]);
  const runtimeSourceRuns = useMemo(
    () =>
      effectiveRuntimeContext.length > 0
        ? effectiveRuntimeContext.map((context) => context.run)
        : effectiveRuns,
    [effectiveRuntimeContext, effectiveRuns]
  );
  const visualizedRuntimeSourceRuns = useMemo(
    () => getVisualizableRuns(runtimeSourceRuns, effectiveRuntimePreviewMode),
    [effectiveRuntimePreviewMode, runtimeSourceRuns]
  );
  const runtimeViewerLayout = useMemo(() => {
    if (!layout || !isRuntimeCanvasMode) {
      return layout;
    }

    return runtimeObjectOverlays
      ? ensureRuntimeOverflowMaps(layout, visualizedRuntimeSourceRuns)
      : layout;
  }, [isRuntimeCanvasMode, layout, runtimeObjectOverlays, visualizedRuntimeSourceRuns]);
  const viewerMaps = runtimeViewerLayout?.world.maps ?? [];
  const selectedViewerMapId =
    viewerMapId && viewerMaps.some((map) => map.id === viewerMapId)
      ? viewerMapId
      : (viewerMaps[0]?.id ?? null);
  const workflowMapAssignments = useMemo(
    () => assignRuntimeWorkflowMapIds(runtimeViewerLayout, visualizedRuntimeSourceRuns),
    [runtimeViewerLayout, visualizedRuntimeSourceRuns]
  );
  const selectedRuntimeContext = useMemo(
    () =>
      getVisualizableRuntimeContexts(effectiveRuntimeContext, effectiveRuntimePreviewMode).filter(
        (context) =>
          workflowMapAssignments.get(getRunWorkflowId(context.run)) === selectedViewerMapId
      ),
    [
      effectiveRuntimeContext,
      effectiveRuntimePreviewMode,
      selectedViewerMapId,
      workflowMapAssignments,
    ]
  );
  const selectedRuns = useMemo(
    () =>
      getVisualizableRuns(effectiveRuns, effectiveRuntimePreviewMode).filter(
        (run) => workflowMapAssignments.get(getRunWorkflowId(run)) === selectedViewerMapId
      ),
    [effectiveRuns, effectiveRuntimePreviewMode, selectedViewerMapId, workflowMapAssignments]
  );
  const activeLayout = useMemo(() => {
    if (!runtimeViewerLayout || !isRuntimeCanvasMode) {
      return runtimeViewerLayout;
    }

    return selectObservatoryLayoutMap(runtimeViewerLayout, selectedViewerMapId);
  }, [isRuntimeCanvasMode, runtimeViewerLayout, selectedViewerMapId]);
  const renderedLayout = useMemo(() => {
    if (!activeLayout || !isRuntimeCanvasMode) {
      return activeLayout;
    }

    const agentSources =
      effectiveAgents.length > 0
        ? effectiveAgents
        : useLayoutAgentsWhenEmpty
          ? createLayoutAgentSources(activeLayout)
          : [];

    if (selectedRuns.length === 0 && selectedRuntimeContext.length === 0) {
      return applyIdleAgentsToLayout(activeLayout, agentSources, useLayoutAgentsWhenEmpty);
    }

    return applyRuntimeAgentsToLayout(
      activeLayout,
      agentSources,
      selectedRuns,
      selectedRuntimeContext,
      effectiveRuntimePreviewMode,
      runtimeObjectOverlays
    );
  }, [
    activeLayout,
    effectiveAgents,
    effectiveRuntimePreviewMode,
    isRuntimeCanvasMode,
    selectedRuntimeContext,
    selectedRuns,
    runtimeObjectOverlays,
    useLayoutAgentsWhenEmpty,
  ]);
  const runtimeStatus = useMemo(
    () =>
      summarizeRuntimeContext(
        effectiveRuntimeContext,
        selectedRuntimeContext,
        renderedLayout,
        effectiveRuntimePreviewMode
      ),
    [effectiveRuntimeContext, effectiveRuntimePreviewMode, renderedLayout, selectedRuntimeContext]
  );
  const registryAssetsById = useMemo(
    () => new Map(getObservatoryModuleAssetRegistry().assets.map((asset) => [asset.id, asset])),
    []
  );
  const roomFloorOptions = useMemo(
    () =>
      Array.from(registryAssetsById.values())
        .filter((asset) => asset.category === 'floor')
        .map((asset) => ({ label: asset.label, value: asset.id })),
    [registryAssetsById]
  );
  const roomWallOptions = useMemo(
    () =>
      Array.from(registryAssetsById.values())
        .filter((asset) => asset.category === 'wall' && !asset.tags?.includes('builder-hidden'))
        .map((asset) => ({ label: asset.label, value: asset.id })),
    [registryAssetsById]
  );
  const activeWallEditRoomState = useMemo(
    () => layout?.world.maps[0]?.rooms.find((room) => room.id === canvasWallEditRoom?.id) ?? null,
    [canvasWallEditRoom?.id, layout]
  );
  const selectedCanvasRoomState = useMemo(
    () =>
      canvasSelection?.kind === 'room'
        ? (layout?.world.maps[0]?.rooms.find((room) => room.id === canvasSelection.id) ?? null)
        : null,
    [canvasSelection, layout]
  );
  const selectedCanvasObjectState = useMemo(
    () =>
      canvasSelection?.kind === 'object'
        ? (layout?.world.maps[0]?.objects.find((object) => object.id === canvasSelection.id) ??
          null)
        : null,
    [canvasSelection, layout]
  );
  const selectedCanvasObjectAsset = selectedCanvasObjectState
    ? registryAssetsById.get(selectedCanvasObjectState.assetId)
    : undefined;
  const selectedCanvasObjectCollisionSize = {
    height:
      selectedCanvasObjectAsset?.collision?.height ?? selectedCanvasObjectState?.size?.height ?? 1,
    width:
      selectedCanvasObjectAsset?.collision?.width ?? selectedCanvasObjectState?.size?.width ?? 1,
  };
  const selectedCanvasObjectBaseSizePx = useMemo(() => {
    if (!selectedCanvasObjectState || !layout) {
      return null;
    }

    const tileSize = layout.world.grid.tileSize;
    return {
      width: (selectedCanvasObjectState.size?.width ?? 1) * tileSize,
      height: (selectedCanvasObjectState.size?.height ?? 1) * tileSize,
    };
  }, [layout, selectedCanvasObjectState]);
  const activeRoomHudState =
    selectedCanvasRoomState ?? (canvasWallEditEnabled ? activeWallEditRoomState : null);
  const primaryInspectableSelection = useMemo(
    () => createPrimaryInspectableSelection(renderedLayout),
    [renderedLayout]
  );
  const inspectionLogAdapter = useMemo(() => {
    if (!renderedLayout) {
      return createObservatoryStaticRuntimeLogAdapter([]);
    }

    const runtimeEntries =
      createObservatoryRuntimeContextInspectionLogEntries(selectedRuntimeContext);
    const layoutEntries = createObservatoryLayoutInspectionLogEntries(renderedLayout);
    return createObservatoryStaticRuntimeLogAdapter([...runtimeEntries, ...layoutEntries]);
  }, [renderedLayout, selectedRuntimeContext]);
  const renderedAgentCount = renderedLayout?.world.maps[0]?.agents.length ?? 0;

  useEffect(() => {
    if (!activeRoomHudState) {
      activeRoomHudIdRef.current = null;
      return;
    }

    const nextDefaultFloorAssetId =
      activeRoomHudState.floorAssetId ??
      layout?.world.maps[0]?.defaultFloorAssetId ??
      roomFloorOptions[0]?.value ??
      null;
    const activeRoomWallAssetId = roomWallOptions.some(
      (option) => option.value === activeRoomHudState.wallAssetId
    )
      ? activeRoomHudState.wallAssetId
      : null;
    const nextDefaultWallAssetId = activeRoomWallAssetId ?? roomWallOptions[0]?.value ?? null;
    const roomChanged = activeRoomHudIdRef.current !== activeRoomHudState.id;

    if (roomChanged) {
      activeRoomHudIdRef.current = activeRoomHudState.id;
      setRoomHudFloorAssetId(nextDefaultFloorAssetId);
      setRoomHudWallBrushAssetId(nextDefaultWallAssetId);
      return;
    }

    if (
      roomHudFloorAssetId &&
      roomFloorOptions.some((option) => option.value === roomHudFloorAssetId)
    ) {
      // Keep the user's current floor brush while editing this room.
    } else {
      setRoomHudFloorAssetId(nextDefaultFloorAssetId);
    }

    if (
      roomHudWallBrushAssetId &&
      roomWallOptions.some((option) => option.value === roomHudWallBrushAssetId)
    ) {
      // Keep the user's current wall brush while editing this room.
    } else {
      setRoomHudWallBrushAssetId(nextDefaultWallAssetId);
    }
  }, [
    activeRoomHudState,
    layout,
    roomFloorOptions,
    roomHudFloorAssetId,
    roomHudWallBrushAssetId,
    roomWallOptions,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (isBuilderMode) {
        const stored = readObservatoryDraftLayoutFromStorage(window.localStorage);
        setViewerLayoutStatus('ready');
        setViewerLayoutIssues(stored.issues);
        setLayout(cloneObservatoryLayout(stored.layout ?? createRepoPublishedLayout()));
        return;
      }

      const repoLayout = createRepoPublishedLayout();

      if (layoutSource === 'repo') {
        setViewerLayoutIssues([]);
        setLayout(repoLayout);
        setViewerLayoutStatus('ready');
        return;
      }

      const stored = readObservatoryViewerLayoutFromStorage(window.localStorage);
      setViewerLayoutIssues(stored.issues);

      if (
        stored.layout &&
        (stored.layout.metadata?.version ?? 0) >= (repoLayout.metadata?.version ?? 0)
      ) {
        setLayout(cloneObservatoryLayout(stored.layout));
        setViewerLayoutStatus('ready');
        return;
      }

      setLayout(repoLayout);
      setViewerLayoutStatus('ready');
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isBuilderMode, layoutSource]);

  useEffect(() => {
    if (!isViewerMode || renderedAgentCount === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setAmbientTick((tick) => tick + 1);
    }, 2_600);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isViewerMode, renderedAgentCount]);

  useEffect(() => {
    const currentMap = renderedLayout?.world.maps[0];
    const runtimeAgentVisualStates = mapRuntimeStateToAgentVisualStates(state).map(
      (agentState, index) =>
        enrichRuntimeAgentVisualStateWithChatter(currentMap, agentState, ambientTick + index)
    );
    const runtimeAgentIds = new Set(runtimeAgentVisualStates.map((agent) => agent.agentId));
    const ambientAgentVisualStates = createAmbientAgentVisualStates(
      renderedLayout,
      registryAssetsById,
      ambientTick,
      isViewerMode && renderedAgentCount > 0,
      ambientSocialStateRef.current
    ).filter((agent) => !runtimeAgentIds.has(agent.agentId));
    const agentVisualStates = [...runtimeAgentVisualStates, ...ambientAgentVisualStates];
    const roomVisualStates = mapRuntimeStateToRoomVisualStates(state);
    dispatchObservatoryAgentVisualState(agentVisualStates, roomVisualStates);
    const timeoutId = window.setTimeout(() => {
      dispatchObservatoryAgentVisualState(agentVisualStates, roomVisualStates);
    }, 750);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ambientTick, isViewerMode, registryAssetsById, renderedAgentCount, renderedLayout, state]);

  useEffect(() => {
    return createObservatoryPostMessageReceiver({
      getState: runtimeStore.getState,
      onAcceptedEvent: (event) => {
        setAcceptedEventCount((count) => count + 1);
        const nextEvents = [...replayEventsRef.current, event];
        replayEventsRef.current = nextEvents;
        setReplayEvents(nextEvents);
        setReplayCursor(nextEvents.length - 1);
      },
      onIssues: setBridgeIssues,
      registry: sourceRegistry,
      setState: runtimeStore.setState,
    });
  }, [runtimeStore, sourceRegistry]);

  const trackAcceptedEvent = (event: ObservatoryNormalizedOfficeEvent) => {
    setAcceptedEventCount((count) => count + 1);
    const nextEvents = [...replayEventsRef.current, event];
    replayEventsRef.current = nextEvents;
    setReplayEvents(nextEvents);
    setReplayCursor(nextEvents.length - 1);
  };

  const createLocalSdkClient = () =>
    createObservatoryLocalSdkClient({
      getState: runtimeStore.getState,
      onAcceptedEvent: trackAcceptedEvent,
      onIssues: setBridgeIssues,
      setState: runtimeStore.setState,
    });

  const pushNextSampleEvent = () => {
    if (paused || readOnly) {
      return;
    }

    const event =
      observatorySampleExternalRuntimeEvents[
        sampleEventCursor % observatorySampleExternalRuntimeEvents.length
      ];
    createLocalSdkClient().pushEvent(event);
    setSampleEventCursor((cursor) => cursor + 1);
  };

  const pushRawEvent = (rawEvent: unknown) => {
    if (paused || readOnly) {
      return;
    }

    const issues = createLocalSdkClient().pushEvent(rawEvent);
    setRawEventIssues(issues);
  };

  const updateLayout = (nextLayout: ObservatoryLayoutDocument) => {
    setLayout(cloneObservatoryLayout(nextLayout));
    setCanvasSelection(null);
    setCanvasWallEditRoom(null);
    setCanvasWallEditEnabled(false);
    setCanvasEditResult(null);
  };

  const resizeRoomFromCanvas = (
    roomId: string,
    bounds: { x: number; y: number; width: number; height: number }
  ) => {
    if (!isBuilderMode || !layout) {
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === roomId);

    if (!map || !room) {
      return;
    }

    const result = resizeObservatoryRoom(layout, map.id, room.id, bounds);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection({
      id: room.id,
      kind: 'room',
      label: room.name,
    });
    setCanvasWallEditRoom({ id: room.id, label: room.name });
  };

  const moveSelectedObjectToGrid = (point: ObservatoryCanvasGridClick) => {
    if (!isBuilderMode || !layout) {
      return;
    }

    const map = layout.world.maps[0];

    if (!map) {
      return;
    }

    if (canvasWallEditEnabled && canvasWallEditRoom) {
      if (canvasWallEditTool === 'floor' && !roomHudFloorAssetId) {
        setCanvasEditResult({
          changed: false,
          issues: [
            {
              path: 'room.floor',
              reason: 'Select a floor asset before painting individual floor cells.',
            },
          ],
          layout,
          message: 'Select a floor asset before painting individual floor cells.',
        });
        return;
      }

      if (
        canvasWallEditTool === 'paint' &&
        !(roomHudWallBrushAssetId || roomWallOptions[0]?.value)
      ) {
        setCanvasEditResult({
          changed: false,
          issues: [
            {
              path: 'room.wall',
              reason: 'Select a wall brush before painting individual wall cells.',
            },
          ],
          layout,
          message: 'Select a wall brush before painting individual wall cells.',
        });
        return;
      }

      const result =
        canvasWallEditTool === 'floor'
          ? setObservatoryRoomFloorCellAsset(
              layout,
              map.id,
              canvasWallEditRoom.id,
              point,
              roomHudFloorAssetId ?? ''
            )
          : canvasWallEditTool === 'paint'
            ? setObservatoryRoomWallCellAsset(
                layout,
                map.id,
                canvasWallEditRoom.id,
                point,
                roomHudWallBrushAssetId ?? roomWallOptions[0]?.value ?? ''
              )
            : canvasWallEditTool === 'tile'
              ? toggleObservatoryRoomWallTile(layout, map.id, canvasWallEditRoom.id, point)
              : toggleObservatoryRoomWallCellKind(
                  layout,
                  map.id,
                  canvasWallEditRoom.id,
                  point,
                  canvasWallEditTool
                );
      setCanvasEditResult(result);

      if (!result.changed) {
        return;
      }

      setLayout(cloneObservatoryLayout(result.layout));
      setCanvasSelection({
        id: canvasWallEditRoom.id,
        kind: 'room',
        label: canvasWallEditRoom.label,
      });
      return;
    }

    const clickedObject = findObservatoryObjectAtGrid(map, point);
    if (clickedObject) {
      setCanvasWallEditEnabled(false);
      setCanvasWallEditRoom(null);
      setCanvasEditResult(null);
      setCanvasSelection({
        id: clickedObject.id,
        kind: 'object',
        label: clickedObject.assetId,
      });
      return;
    }

    const clickedRoom = findObservatoryRoomAtGrid(map, point);
    if (clickedRoom) {
      setCanvasEditResult(null);
      setCanvasSelection({
        id: clickedRoom.id,
        kind: 'room',
        label: clickedRoom.name,
      });
      setCanvasWallEditRoom({ id: clickedRoom.id, label: clickedRoom.name });
      return;
    }

    setCanvasEditResult(null);
    setCanvasSelection(null);
    setCanvasWallEditRoom(null);
    setCanvasWallEditEnabled(false);
  };

  const nudgeSelectedObjectFromDrawer = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!isBuilderMode || !layout || canvasSelection?.kind !== 'object') {
      return;
    }

    const map = layout.world.maps[0];
    const object = map?.objects.find((candidate) => candidate.id === canvasSelection.id);

    if (!map || !object) {
      return;
    }

    const width = object.size?.width ?? 1;
    const height = object.size?.height ?? 1;
    const delta =
      direction === 'up'
        ? { x: 0, y: -1 }
        : direction === 'down'
          ? { x: 0, y: 1 }
          : direction === 'left'
            ? { x: -1, y: 0 }
            : { x: 1, y: 0 };
    const result = updateObservatoryObject(layout, map.id, object.id, {
      position: {
        x: Math.max(0, Math.min(map.size.width - width, object.position.x + delta.x)),
        y: Math.max(0, Math.min(map.size.height - height, object.position.y + delta.y)),
      },
    });
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection({
      id: object.id,
      kind: 'object',
      label: object.assetId,
    });
  };

  const deleteSelectedObjectFromDrawer = () => {
    if (!isBuilderMode || !layout || canvasSelection?.kind !== 'object') {
      return;
    }

    const map = layout.world.maps[0];
    const object = map?.objects.find((candidate) => candidate.id === canvasSelection.id);

    if (!map || !object) {
      return;
    }

    const result = deleteObservatoryObject(layout, map.id, object.id);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection(null);
  };

  const nudgeSelectedRoomFromDrawer = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!isBuilderMode || !layout || canvasSelection?.kind !== 'room') {
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === canvasSelection.id);

    if (!map || !room) {
      return;
    }

    const nextOrigin =
      direction === 'up'
        ? { x: room.bounds.x, y: Math.max(0, room.bounds.y - 1) }
        : direction === 'down'
          ? {
              x: room.bounds.x,
              y: Math.min(map.size.height - room.bounds.height, room.bounds.y + 1),
            }
          : direction === 'left'
            ? { x: Math.max(0, room.bounds.x - 1), y: room.bounds.y }
            : {
                x: Math.min(map.size.width - room.bounds.width, room.bounds.x + 1),
                y: room.bounds.y,
              };
    const result = moveObservatoryRoom(layout, map.id, room.id, nextOrigin);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection({
      id: room.id,
      kind: 'room',
      label: room.name,
    });
  };

  const resizeSelectedRoomFromDrawer = () => {
    if (!isBuilderMode || !layout || canvasSelection?.kind !== 'room') {
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === canvasSelection.id);

    if (!map || !room) {
      return;
    }

    const nextBounds = {
      ...room.bounds,
      width:
        room.bounds.x + room.bounds.width < map.size.width
          ? room.bounds.width + 1
          : room.bounds.width,
      height:
        room.bounds.y + room.bounds.height < map.size.height
          ? room.bounds.height + 1
          : room.bounds.height,
    };
    const result = resizeObservatoryRoom(layout, map.id, room.id, nextBounds);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection({
      id: room.id,
      kind: 'room',
      label: room.name,
    });
  };

  const updateSelectedRoomBoundsFromDrawer = (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    if (!isBuilderMode || !layout || !activeRoomHudState) {
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === activeRoomHudState.id);

    if (!map || !room) {
      return;
    }

    const result = resizeObservatoryRoom(layout, map.id, room.id, bounds);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection({
      id: room.id,
      kind: 'room',
      label: room.name,
    });
  };

  const applySelectedRoomFloorFromCanvas = () => {
    if (!isBuilderMode || !layout || !activeRoomHudState) {
      return;
    }

    if (!roomHudFloorAssetId) {
      setCanvasEditResult({
        changed: false,
        issues: [
          {
            path: 'room.floor',
            reason: 'Select a floor asset in the room HUD before applying it.',
          },
        ],
        layout,
        message: 'Select a floor asset in the room HUD before applying it.',
      });
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === activeRoomHudState.id);

    if (!map || !room) {
      return;
    }

    const result = setObservatoryRoomFloorAsset(layout, map.id, room.id, roomHudFloorAssetId);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection({
      id: room.id,
      kind: 'room',
      label: room.name,
    });
  };

  const applySelectedRoomWallFromCanvas = () => {
    if (!isBuilderMode || !layout || !activeRoomHudState) {
      return;
    }

    if (!roomHudWallBrushAssetId) {
      setCanvasEditResult({
        changed: false,
        issues: [
          { path: 'room.wall', reason: 'Select a wall brush in the room HUD before applying it.' },
        ],
        layout,
        message: 'Select a wall brush in the room HUD before applying it.',
      });
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === activeRoomHudState.id);

    if (!map || !room) {
      return;
    }

    const result = setObservatoryRoomWallAsset(layout, map.id, room.id, roomHudWallBrushAssetId);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasSelection({
      id: room.id,
      kind: 'room',
      label: room.name,
    });
  };

  const deleteSelectedRoomFromDrawer = () => {
    if (!isBuilderMode || !layout || !activeRoomHudState) {
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === activeRoomHudState.id);

    if (!map || !room) {
      return;
    }

    const result = deleteObservatoryRoom(layout, map.id, room.id);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    setCanvasWallEditEnabled(false);
    setCanvasWallEditRoom(null);
    setCanvasSelection(null);
  };

  const toggleSelectedRoomWallEditFromDrawer = () => {
    if (!isBuilderMode || !layout || !activeRoomHudState) {
      return;
    }

    const map = layout.world.maps[0];
    const room = map?.rooms.find((candidate) => candidate.id === activeRoomHudState.id);

    if (!map || !room) {
      return;
    }

    setCanvasWallEditRoom({ id: room.id, label: room.name });
    setCanvasWallEditEnabled((enabled) => !(enabled && canvasWallEditRoom?.id === room.id));
  };

  const returnToRoomSelectModeFromCanvas = () => {
    setCanvasWallEditEnabled(false);
    setCanvasWallEditTool('opening');
    setCanvasEditResult(null);
  };

  const closeSelectedRoomHudFromCanvas = () => {
    setCanvasSelection(null);
    setCanvasWallEditRoom(null);
    setCanvasWallEditEnabled(false);
    setCanvasWallEditTool('opening');
    setCanvasEditResult(null);
  };

  const updateSelectedObjectFromDrawer = (input: {
    blocksMovement?: boolean;
    position?: { x: number; y: number };
    render?: ObservatoryObjectRenderOptions;
    roomId?: string | null;
    size?: { width: number; height: number };
  }) => {
    if (!isBuilderMode || !layout || canvasSelection?.kind !== 'object') {
      return;
    }

    const map = layout.world.maps[0];
    const object = map?.objects.find((candidate) => candidate.id === canvasSelection.id);

    if (!map || !object) {
      return;
    }

    const result = updateObservatoryObject(layout, map.id, object.id, input);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    const nextObject = result.layout.world.maps[0]?.objects.find(
      (candidate) => candidate.id === object.id
    );
    setCanvasSelection({
      id: object.id,
      kind: 'object',
      label: nextObject?.assetId ?? object.assetId,
    });
  };

  const applySelectedObjectRenderSizeFromCanvas = (size: { width: number; height: number }) => {
    if (!selectedCanvasObjectState) {
      return;
    }

    updateSelectedObjectFromDrawer({
      render: {
        ...selectedCanvasObjectState.render,
        sizePx: {
          width: size.width,
          height: size.height,
        },
      },
    });
  };

  const resetSelectedObjectRenderSizeFromCanvas = () => {
    if (!selectedCanvasObjectState) {
      return;
    }

    updateSelectedObjectFromDrawer({
      render: selectedCanvasObjectState.render
        ? {
            ...selectedCanvasObjectState.render,
            sizePx: undefined,
          }
        : undefined,
    });
  };

  const applySelectedObjectScaleFromCanvas = (scale: number) => {
    if (!selectedCanvasObjectBaseSizePx || !Number.isFinite(scale) || scale <= 0) {
      return;
    }

    applySelectedObjectRenderSizeFromCanvas({
      width: selectedCanvasObjectBaseSizePx.width * scale,
      height: selectedCanvasObjectBaseSizePx.height * scale,
    });
  };

  const applySelectedObjectRenderOffsetFromCanvas = (offset: { x: number; y: number }) => {
    if (!selectedCanvasObjectState) {
      return;
    }

    updateSelectedObjectFromDrawer({
      render: {
        ...selectedCanvasObjectState.render,
        offsetPx: {
          x: offset.x,
          y: offset.y,
        },
      },
    });
  };

  const resetSelectedObjectRenderOffsetFromCanvas = () => {
    if (!selectedCanvasObjectState) {
      return;
    }

    updateSelectedObjectFromDrawer({
      render: selectedCanvasObjectState.render
        ? {
            ...selectedCanvasObjectState.render,
            offsetPx: undefined,
          }
        : undefined,
    });
  };

  const toggleSelectedObjectBlocksMovementFromCanvas = () => {
    if (!selectedCanvasObjectState) {
      return;
    }

    updateSelectedObjectFromDrawer({
      blocksMovement: !(selectedCanvasObjectState.blocksMovement ?? true),
    });
  };

  const duplicateSelectedObjectFromCanvas = () => {
    if (!isBuilderMode || !layout || canvasSelection?.kind !== 'object') {
      return;
    }

    const map = layout.world.maps[0];
    const object = map?.objects.find((candidate) => candidate.id === canvasSelection.id);

    if (!map || !object) {
      return;
    }

    const result = duplicateObservatoryObject(layout, map.id, object.id);
    setCanvasEditResult(result);

    if (!result.changed) {
      return;
    }

    setLayout(cloneObservatoryLayout(result.layout));
    const duplicatedId = result.selectedObjectId ?? object.id;
    const duplicatedObject = result.layout.world.maps[0]?.objects.find(
      (candidate) => candidate.id === duplicatedId
    );
    setCanvasSelection({
      id: duplicatedId,
      kind: 'object',
      label: duplicatedObject?.assetId ?? object.assetId,
    });
  };

  const applySelectedObjectCollisionSizeFromCanvas = (size: { width: number; height: number }) => {
    updateSelectedObjectFromDrawer({
      size,
    });
  };

  const resetSelectedObjectCollisionSizeFromCanvas = () => {
    updateSelectedObjectFromDrawer({
      size: { width: 1, height: 1 },
    });
  };

  const handleCanvasSelectionChange = (selection: ObservatoryCanvasSelection) => {
    setCanvasSelection(selection);
    setCanvasEditResult(null);

    if (selection.kind === 'room') {
      setCanvasWallEditRoom({ id: selection.id, label: selection.label });
    }
  };

  const appendReplayEvents = (events: ObservatoryNormalizedOfficeEvent[]) => {
    const nextEvents = [...replayEventsRef.current, ...events];
    replayEventsRef.current = nextEvents;
    setReplayEvents(nextEvents);
    setReplayCursor(nextEvents.length - 1);
  };

  const clearReplayEvents = () => {
    replayEventsRef.current = [];
    setReplayEvents([]);
    setReplayCursor(-1);
  };

  const applyReplayCursor = (cursor: number) => {
    const frame = runtimeStore.replay(replayEvents, cursor);
    setReplayCursor(frame.cursor);
  };

  const replayLatest = () => {
    applyReplayCursor(replayEvents.length - 1);
  };

  return (
    <section
      className={`${styles.shell} ${compact || isEmbedMode ? styles.compact : ''} ${isViewerMode || isEmbedMode ? styles.viewerShell : ''}`}
      aria-label="Observatory runtime surface"
    >
      {isViewerMode || isEmbedMode ? null : (
        <div className={`${styles.hero} ${compact ? styles.heroCompact : ''}`}>
          <p className={styles.eyebrow}>Observatory Preview</p>
          <h2 className={styles.title}>
            {compact || isEmbedMode ? 'Observable runtime office' : 'Observatory Builder'}
          </h2>
          <p className={styles.description}>
            {compact || isEmbedMode
              ? 'Compact embed surface for same-origin postMessage runtime events.'
              : 'Developer view for editing, validating, debugging, and publishing a layout snapshot. Published layouts render as canvas-only runtime views in host surfaces such as /runs.'}
          </p>
          {readOnly ? <p className={styles.modeBadge}>Read-only embed mode</p> : null}
          {isBuilderMode ? (
            <div className={styles.actions}>
              <button
                className={styles.button}
                type="button"
                onClick={() => {
                  if (!paused) {
                    runtimeStore.reduceEvents(normalizedSampleEvents);
                    appendReplayEvents(normalizedSampleEvents);
                    setAcceptedEventCount((count) => count + normalizedSampleEvents.length);
                    setBridgeIssues([]);
                    setRawEventIssues([]);
                  }
                }}
              >
                Replay sample events
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                type="button"
                onClick={() => {
                  runtimeStore.reset();
                  setAcceptedEventCount(0);
                  clearReplayEvents();
                  setBridgeIssues([]);
                  setRawEventIssues([]);
                }}
              >
                Reset runtime state
              </button>
            </div>
          ) : null}
        </div>
      )}

      {isViewerMode ? (
        <ObservatoryViewerControls
          layerFilter={viewerLayerFilter}
          onMapChange={setViewerMapId}
          onLayerFilterChange={setViewerLayerFilter}
          onRoomFilterChange={setViewerRoomFilter}
          onSearchChange={setViewerSearch}
          maps={viewerMaps.map((map) => ({ id: map.id, name: map.name }))}
          roomFilter={viewerRoomFilter}
          search={viewerSearch}
          selectedMapId={selectedViewerMapId}
        />
      ) : null}

      <div className={`${styles.grid} ${isViewerMode || isEmbedMode ? styles.viewerGrid : ''}`}>
        {renderedLayout ? (
          <div className={styles.canvasColumn}>
            {isBuilderMode ? (
              <section
                className={styles.canvasTuner}
                aria-label="Observatory canvas presentation controls"
              >
                <div>
                  <h3 className={styles.canvasTunerTitle}>Canvas preview</h3>
                  <p className={styles.canvasTunerDescription}>
                    Switch between editor framing and the compact runtime framing used in /runs.
                  </p>
                </div>
                <div className={styles.canvasTunerActions}>
                  <button
                    className={`${styles.button} ${builderCanvasPresentation === 'builder' ? '' : styles.buttonSecondary}`}
                    onClick={() => setBuilderCanvasPresentation('builder')}
                    type="button"
                  >
                    Builder
                  </button>
                  <button
                    className={`${styles.button} ${builderCanvasPresentation === 'viewerCompact' ? '' : styles.buttonSecondary}`}
                    onClick={() => setBuilderCanvasPresentation('viewerCompact')}
                    type="button"
                  >
                    Runtime compact
                  </button>
                  <button
                    className={`${styles.button} ${builderCanvasPresentation === 'viewerFull' ? '' : styles.buttonSecondary}`}
                    onClick={() => setBuilderCanvasPresentation('viewerFull')}
                    type="button"
                  >
                    Full 1024
                  </button>
                  <button
                    aria-pressed={builderCameraLocked}
                    className={`${styles.button} ${builderCameraLocked ? '' : styles.buttonSecondary}`}
                    onClick={() => setBuilderCameraLocked((locked) => !locked)}
                    type="button"
                  >
                    {builderCameraLocked ? 'Camera locked' : 'Pan/zoom enabled'}
                  </button>
                </div>
              </section>
            ) : null}
            {isBuilderMode ? (
              <section className={styles.canvasTuner} aria-label="Runs agent visibility default">
                <div>
                  <h3 className={styles.canvasTunerTitle}>Runs agent default</h3>
                  <p className={styles.canvasTunerDescription}>
                    Choose which agent set /runs uses when it opens.
                  </p>
                </div>
                <div className={styles.checkboxGroup}>
                  {(
                    [
                      ['workflow', 'Workflow agents'],
                      ['executedWorkflow', 'Executed workflows'],
                      ['all', 'All agents'],
                    ] as const
                  ).map(([mode, label]) => (
                    <label key={mode} className={styles.checkboxOption}>
                      <input
                        checked={builderAgentVisibilityDefault === mode}
                        onChange={() => {
                          setBuilderAgentVisibilityDefault(mode);
                          writeObservatoryAgentVisibilityMode(mode);
                        }}
                        type="checkbox"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            {isBuilderMode ? (
              <BuilderRuntimeDemoControls
                demoId={builderRuntimeDemoId}
                maps={viewerMaps.map((map) => ({ id: map.id, name: map.name }))}
                onDemoChange={(nextDemoId) => {
                  setBuilderRuntimeDemoId(nextDemoId);
                  setViewerMapId(null);
                  setCanvasSelection(null);
                  setCanvasEditResult(null);
                }}
                onMapChange={setViewerMapId}
                selectedDemo={builderRuntimeDemo}
                selectedMapId={selectedViewerMapId}
                status={runtimeStatus}
              />
            ) : null}
            {isViewerMode ? (
              <RuntimeStatusStrip
                onInspect={
                  primaryInspectableSelection
                    ? () => setCanvasSelection(primaryInspectableSelection)
                    : undefined
                }
                status={runtimeStatus}
              />
            ) : null}
            <ObservatoryGameCanvas
              activeWallEditRoomId={canvasWallEditEnabled ? (canvasWallEditRoom?.id ?? null) : null}
              activeWallEditDoorCount={
                canvasWallEditEnabled ? (activeWallEditRoomState?.wallDoors?.length ?? 0) : 0
              }
              activeWallEditRoomLabel={
                canvasWallEditEnabled ? (canvasWallEditRoom?.label ?? null) : null
              }
              activeWallEditTool={canvasWallEditTool}
              activeWallEditWallAssetId={
                canvasWallEditTool === 'floor'
                  ? (roomHudFloorAssetId ??
                    activeWallEditRoomState?.floorAssetId ??
                    layout?.world.maps[0]?.defaultFloorAssetId ??
                    roomFloorOptions[0]?.value ??
                    null)
                  : (roomHudWallBrushAssetId ?? roomWallOptions[0]?.value ?? null)
              }
              activeWallEditOpeningCount={
                canvasWallEditEnabled ? countRoomWallOpenings(activeWallEditRoomState) : 0
              }
              allowPan={isEmbedMode ? false : isViewerMode ? true : !builderCameraLocked}
              allowZoom={isEmbedMode ? false : isViewerMode ? true : !builderCameraLocked}
              enableAmbientAutoplay={false}
              initialZoom={isViewerMode ? 0.85 : null}
              layout={renderedLayout}
              onActiveWallEditClose={returnToRoomSelectModeFromCanvas}
              onActiveWallEditToolChange={setCanvasWallEditTool}
              onGridClick={isBuilderMode ? moveSelectedObjectToGrid : undefined}
              onSelectedObjectClose={isBuilderMode ? () => setCanvasSelection(null) : undefined}
              onSelectedObjectDuplicate={
                isBuilderMode && selectedCanvasObjectState
                  ? duplicateSelectedObjectFromCanvas
                  : undefined
              }
              onSelectedObjectDelete={
                isBuilderMode && selectedCanvasObjectState
                  ? deleteSelectedObjectFromDrawer
                  : undefined
              }
              onSelectedObjectMove={
                isBuilderMode && selectedCanvasObjectState
                  ? nudgeSelectedObjectFromDrawer
                  : undefined
              }
              onSelectedObjectCollisionSizeApply={
                isBuilderMode && selectedCanvasObjectState
                  ? applySelectedObjectCollisionSizeFromCanvas
                  : undefined
              }
              onSelectedObjectCollisionSizeReset={
                isBuilderMode && selectedCanvasObjectState
                  ? resetSelectedObjectCollisionSizeFromCanvas
                  : undefined
              }
              onSelectedObjectOffsetApply={
                isBuilderMode && selectedCanvasObjectState
                  ? applySelectedObjectRenderOffsetFromCanvas
                  : undefined
              }
              onSelectedObjectOffsetReset={
                isBuilderMode && selectedCanvasObjectState
                  ? resetSelectedObjectRenderOffsetFromCanvas
                  : undefined
              }
              onSelectedObjectRenderSizeApply={
                isBuilderMode && selectedCanvasObjectState
                  ? applySelectedObjectRenderSizeFromCanvas
                  : undefined
              }
              onSelectedObjectRenderSizeReset={
                isBuilderMode && selectedCanvasObjectState
                  ? resetSelectedObjectRenderSizeFromCanvas
                  : undefined
              }
              onSelectedObjectScaleApply={
                isBuilderMode && selectedCanvasObjectState
                  ? applySelectedObjectScaleFromCanvas
                  : undefined
              }
              onSelectedObjectToggleBlocksMovement={
                isBuilderMode && selectedCanvasObjectState
                  ? toggleSelectedObjectBlocksMovementFromCanvas
                  : undefined
              }
              onRoomResizeCommit={
                isBuilderMode && !canvasWallEditEnabled ? resizeRoomFromCanvas : undefined
              }
              onSelectedRoomBoundsApply={
                isBuilderMode && activeRoomHudState ? updateSelectedRoomBoundsFromDrawer : undefined
              }
              onSelectedRoomClose={isBuilderMode ? closeSelectedRoomHudFromCanvas : undefined}
              onSelectedRoomDelete={
                isBuilderMode && activeRoomHudState ? deleteSelectedRoomFromDrawer : undefined
              }
              onSelectedRoomFloorApply={
                isBuilderMode && activeRoomHudState ? applySelectedRoomFloorFromCanvas : undefined
              }
              onSelectedRoomFloorSelect={isBuilderMode ? setRoomHudFloorAssetId : undefined}
              onSelectedRoomWallApply={
                isBuilderMode && activeRoomHudState ? applySelectedRoomWallFromCanvas : undefined
              }
              onSelectedRoomWallBrushSelect={isBuilderMode ? setRoomHudWallBrushAssetId : undefined}
              onSelectedRoomWallEditToggle={
                isBuilderMode && activeRoomHudState
                  ? toggleSelectedRoomWallEditFromDrawer
                  : undefined
              }
              onSelectionChange={isEmbedMode ? undefined : handleCanvasSelectionChange}
              presentation={
                isViewerMode || isEmbedMode ? 'viewerCompact' : builderCanvasPresentation
              }
              selectedAgentId={
                !isEmbedMode && canvasSelection?.kind === 'agent' ? canvasSelection.id : null
              }
              selectedObjectId={
                isBuilderMode && !canvasWallEditEnabled
                  ? (selectedCanvasObjectState?.id ?? null)
                  : null
              }
              selectedObjectBaseHeightPx={selectedCanvasObjectBaseSizePx?.height ?? null}
              selectedObjectBaseWidthPx={selectedCanvasObjectBaseSizePx?.width ?? null}
              selectedObjectBlocksMovement={selectedCanvasObjectState?.blocksMovement ?? true}
              selectedObjectCollisionHeight={selectedCanvasObjectCollisionSize.height}
              selectedObjectCollisionWidth={selectedCanvasObjectCollisionSize.width}
              selectedObjectLabel={selectedCanvasObjectState?.assetId ?? null}
              selectedObjectOffsetX={selectedCanvasObjectState?.render?.offsetPx?.x ?? 0}
              selectedObjectOffsetY={selectedCanvasObjectState?.render?.offsetPx?.y ?? 0}
              selectedObjectPositionLabel={
                selectedCanvasObjectState
                  ? `${selectedCanvasObjectState.position.x},${selectedCanvasObjectState.position.y}`
                  : null
              }
              selectedObjectRenderHeightPx={
                selectedCanvasObjectState?.render?.sizePx?.height ??
                selectedCanvasObjectBaseSizePx?.height ??
                null
              }
              selectedObjectRenderWidthPx={
                selectedCanvasObjectState?.render?.sizePx?.width ??
                selectedCanvasObjectBaseSizePx?.width ??
                null
              }
              selectedRoomDoorCount={
                selectedCanvasRoomState?.wallDoors?.length ??
                activeWallEditRoomState?.wallDoors?.length ??
                0
              }
              selectedRoomFloorLabel={
                selectedCanvasRoomState
                  ? (registryAssetsById.get(
                      selectedCanvasRoomState.floorAssetId ??
                        layout?.world.maps[0]?.defaultFloorAssetId ??
                        ''
                    )?.label ??
                    (selectedCanvasRoomState.floorAssetId
                      ? selectedCanvasRoomState.floorAssetId
                      : 'Map default'))
                  : activeWallEditRoomState
                    ? (registryAssetsById.get(
                        activeWallEditRoomState.floorAssetId ??
                          layout?.world.maps[0]?.defaultFloorAssetId ??
                          ''
                      )?.label ??
                      (activeWallEditRoomState.floorAssetId
                        ? activeWallEditRoomState.floorAssetId
                        : 'Map default'))
                    : null
              }
              selectedRoomFloorOptions={roomFloorOptions}
              selectedRoomFloorValue={roomHudFloorAssetId}
              selectedRoomId={
                isBuilderMode
                  ? (selectedCanvasRoomState?.id ??
                    (canvasWallEditEnabled ? (activeWallEditRoomState?.id ?? null) : null))
                  : null
              }
              selectedRoomLabel={
                selectedCanvasRoomState?.name ??
                (canvasWallEditEnabled ? (canvasWallEditRoom?.label ?? null) : null)
              }
              selectedRoomOpeningCount={
                selectedCanvasRoomState
                  ? countRoomWallOpenings(selectedCanvasRoomState)
                  : countRoomWallOpenings(activeWallEditRoomState)
              }
              selectedRoomPositionLabel={
                selectedCanvasRoomState
                  ? `${selectedCanvasRoomState.bounds.x},${selectedCanvasRoomState.bounds.y}`
                  : activeWallEditRoomState
                    ? `${activeWallEditRoomState.bounds.x},${activeWallEditRoomState.bounds.y}`
                    : null
              }
              selectedRoomRows={
                selectedCanvasRoomState?.bounds.height ??
                activeWallEditRoomState?.bounds.height ??
                null
              }
              selectedRoomSizeLabel={
                selectedCanvasRoomState
                  ? `${selectedCanvasRoomState.bounds.width}x${selectedCanvasRoomState.bounds.height}`
                  : activeWallEditRoomState
                    ? `${activeWallEditRoomState.bounds.width}x${activeWallEditRoomState.bounds.height}`
                    : null
              }
              selectedRoomCols={
                selectedCanvasRoomState?.bounds.width ??
                activeWallEditRoomState?.bounds.width ??
                null
              }
              selectedRoomWallLabel={
                selectedCanvasRoomState
                  ? (registryAssetsById.get(selectedCanvasRoomState.wallAssetId ?? '')?.label ??
                    selectedCanvasRoomState.wallAssetId ??
                    'None')
                  : activeWallEditRoomState
                    ? (registryAssetsById.get(activeWallEditRoomState.wallAssetId ?? '')?.label ??
                      activeWallEditRoomState.wallAssetId ??
                      'None')
                    : null
              }
              selectedRoomWallBrushOptions={roomWallOptions}
              selectedRoomWallBrushValue={roomHudWallBrushAssetId}
              selectedRoomX={
                selectedCanvasRoomState?.bounds.x ?? activeWallEditRoomState?.bounds.x ?? null
              }
              selectedRoomY={
                selectedCanvasRoomState?.bounds.y ?? activeWallEditRoomState?.bounds.y ?? null
              }
              showWallEditOverlay={canvasWallEditEnabled}
              showDebugCoordinates={isBuilderMode && !builderCameraLocked}
              viewFilter={canvasViewFilter}
            />
          </div>
        ) : (
          <PublishedLayoutEmptyState issues={viewerLayoutIssues} status={viewerLayoutStatus} />
        )}
        {isBuilderMode && layout ? (
          <div className={styles.sidePanel}>
            {
              <ManualLayoutEditorPanel
                disabled={paused}
                canvasSelection={canvasSelection}
                canvasEditResult={canvasEditResult}
                canvasWallEditEnabled={canvasWallEditEnabled}
                canvasWallEditRoom={canvasWallEditRoom}
                canvasWallEditTool={canvasWallEditTool}
                layout={layout}
                onCanvasWallEditEnabledChange={(enabled) => {
                  setCanvasWallEditEnabled(enabled);
                }}
                onCanvasWallEditRoomChange={setCanvasWallEditRoom}
                onCanvasWallEditToolChange={setCanvasWallEditTool}
                onCanvasSelectionClear={() => {
                  setCanvasSelection(null);
                  setCanvasEditResult(null);
                }}
                onPaletteSelectionChange={setBuilderPaletteSelection}
                onResetBlank={() => {
                  setCanvasSelection(null);
                  setCanvasWallEditRoom(null);
                  setCanvasWallEditEnabled(false);
                  setCanvasWallEditTool('opening');
                  setCanvasEditResult(null);
                }}
                onOpenAssetPack={() => setAssetPackOpen(true)}
                onLayoutChange={updateLayout}
                onPublishedLayout={(publishedLayout) => {
                  setLayout(cloneObservatoryLayout(publishedLayout));
                }}
              />
            }
            <section className={styles.debugGate} aria-label="Observatory debug panels">
              <div>
                <h3 className={styles.debugTitle}>Runtime tools</h3>
                <p className={styles.debugDescription}>
                  Keep the page lean by showing feeds, replay, raw events, and source details only
                  when debugging.
                </p>
              </div>
              <button
                aria-expanded={debugPanelOpen}
                className={`${styles.button} ${debugPanelOpen ? '' : styles.buttonSecondary}`}
                onClick={() => setDebugPanelOpen((open) => !open)}
                type="button"
              >
                {debugPanelOpen ? 'Hide debug' : 'Show debug'}
              </button>
            </section>
            {debugPanelOpen ? (
              <div className={styles.debugStack}>
                <DebugAccordion title="Runtime state" defaultOpen>
                  <RuntimeStateSummary state={state} />
                </DebugAccordion>
                {compact || readOnly ? null : (
                  <DebugAccordion title="Replay timeline">
                    <RuntimeReplayControls
                      cursor={replayCursor}
                      disabled={paused}
                      events={replayEvents}
                      onCursorChange={applyReplayCursor}
                      onReplayLatest={replayLatest}
                    />
                  </DebugAccordion>
                )}
                <DebugAccordion title="Source manager">
                  <RuntimeSourceManager
                    acceptedEventCount={acceptedEventCount}
                    disabled={paused || readOnly}
                    issues={bridgeIssues}
                    onPushSampleEvent={pushNextSampleEvent}
                    sourceStatuses={sourceStatuses}
                  />
                </DebugAccordion>
                {readOnly ? null : (
                  <DebugAccordion title="Raw event injection">
                    <RuntimeRawEventPanel
                      disabled={paused}
                      issues={rawEventIssues}
                      onPushRawEvent={pushRawEvent}
                      sampleEvent={observatorySampleExternalRuntimeEvents[0]}
                    />
                  </DebugAccordion>
                )}
                <DebugAccordion title="Activity feed">
                  <RuntimeActivityFeed
                    levelFilter={levelFilter}
                    onClear={() => {
                      runtimeStore.reset();
                      setAcceptedEventCount(0);
                      clearReplayEvents();
                    }}
                    onLevelFilterChange={setLevelFilter}
                    onPausedChange={setPaused}
                    paused={paused}
                    readOnly={readOnly}
                    state={state}
                  />
                </DebugAccordion>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {isBuilderMode && assetPackOpen ? (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setAssetPackOpen(false)}
          role="presentation"
        >
          <aside
            className={styles.drawer}
            aria-label="Observatory asset pack drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.drawerHeader}>
              <div>
                <h3 className={styles.drawerTitle}>Asset Pack Debug</h3>
                <p className={styles.debugDescription}>
                  Registry coverage, frame inspector, and character action metadata.
                </p>
              </div>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={() => setAssetPackOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className={styles.drawerBody}>
              <AssetPackSummary />
            </div>
          </aside>
        </div>
      ) : null}
      {!isEmbedMode &&
      renderedLayout &&
      canvasSelection &&
      (!isBuilderMode || canvasSelection.kind === 'agent') ? (
        <SelectionDrawer
          canvasEditResult={canvasEditResult}
          logAdapter={inspectionLogAdapter}
          layout={renderedLayout}
          canEditObject={isBuilderMode && !paused && !readOnly && canvasSelection.kind === 'object'}
          canEditRoom={isBuilderMode && !paused && !readOnly && canvasSelection.kind === 'room'}
          isWallEditActive={canvasWallEditEnabled && canvasWallEditRoom?.id === canvasSelection.id}
          onClose={() => setCanvasSelection(null)}
          onDeleteObject={deleteSelectedObjectFromDrawer}
          onDeleteRoom={deleteSelectedRoomFromDrawer}
          onMoveObject={nudgeSelectedObjectFromDrawer}
          onMoveRoom={nudgeSelectedRoomFromDrawer}
          onResizeRoom={resizeSelectedRoomFromDrawer}
          onToggleRoomWallEdit={toggleSelectedRoomWallEditFromDrawer}
          onUpdateObject={updateSelectedObjectFromDrawer}
          onUpdateRoomBounds={updateSelectedRoomBoundsFromDrawer}
          selection={canvasSelection}
        />
      ) : null}
    </section>
  );
}

function PublishedLayoutEmptyState({
  issues,
  status,
}: {
  issues: ObservatoryLayoutIssue[];
  status: 'invalid' | 'loading' | 'missing' | 'ready';
}) {
  const title =
    status === 'loading'
      ? 'Loading published Observatory layout'
      : 'No published Observatory layout';
  const description =
    status === 'invalid'
      ? 'A published layout was found, but it failed schema validation. Open the builder, import or repair the layout JSON, then publish again.'
      : 'Publish a layout from the builder before this runtime view renders in /runs or embed mode.';

  return (
    <section className={styles.emptyState} aria-label="Observatory published layout status">
      <div>
        <p className={styles.eyebrow}>Published runtime view</p>
        <h3 className={styles.emptyTitle}>{title}</h3>
        <p className={styles.emptyDescription}>{description}</p>
        {issues.length > 0 ? (
          <ul className={styles.emptyIssues}>
            {issues.slice(0, 4).map((issue) => (
              <li key={`${issue.path}:${issue.reason}`}>
                {issue.path}: {issue.reason}
              </li>
            ))}
          </ul>
        ) : null}
        <a className={`${styles.button} ${styles.emptyAction}`} href="/observatory/builder">
          Open builder
        </a>
      </div>
    </section>
  );
}

function findObservatoryObjectAtGrid(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  point: ObservatoryCanvasGridClick
) {
  for (let index = map.objects.length - 1; index >= 0; index -= 1) {
    const object = map.objects[index]!;
    const width = object.size?.width ?? 1;
    const height = object.size?.height ?? 1;

    if (
      point.x >= object.position.x &&
      point.y >= object.position.y &&
      point.x < object.position.x + width &&
      point.y < object.position.y + height
    ) {
      return object;
    }
  }

  return null;
}

function findObservatoryRoomAtGrid(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  point: ObservatoryCanvasGridClick
) {
  for (let index = map.rooms.length - 1; index >= 0; index -= 1) {
    const room = map.rooms[index]!;

    if (pointInGridRect(point, room.bounds)) {
      return room;
    }
  }

  return null;
}

function countRoomWallOpenings(
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number] | null | undefined
) {
  return (room?.wallOpenings?.length ?? 0) + (room?.wallEdgeOpenings?.length ?? 0);
}

function ObservatoryViewerControls({
  layerFilter,
  maps,
  onLayerFilterChange,
  onMapChange,
  onRoomFilterChange,
  onSearchChange,
  roomFilter,
  search,
  selectedMapId,
}: {
  layerFilter: 'all' | 'agents' | 'objects';
  maps: Array<{ id: string; name: string }>;
  onLayerFilterChange: (filter: 'all' | 'agents' | 'objects') => void;
  onMapChange: (mapId: string) => void;
  onRoomFilterChange: (filter: 'all' | 'commons' | 'runtime' | 'workspace') => void;
  onSearchChange: (search: string) => void;
  roomFilter: 'all' | 'commons' | 'runtime' | 'workspace';
  search: string;
  selectedMapId: string | null;
}) {
  return (
    <div className={styles.viewerContent}>
      <div className={styles.viewerFilters}>
        <div className={styles.viewerFilterRow}>
          {maps.map((map) => (
            <button
              key={map.id}
              className={`${styles.viewerFilterChip} ${selectedMapId === map.id ? styles.viewerFilterChipActive : ''}`}
              onClick={() => onMapChange(map.id)}
              type="button"
            >
              {map.name}
            </button>
          ))}
          <button
            className={`${styles.viewerFilterChip} ${roomFilter === 'all' ? styles.viewerFilterChipActive : ''}`}
            onClick={() => onRoomFilterChange('all')}
            type="button"
          >
            All Rooms
          </button>
          <button
            className={`${styles.viewerFilterChip} ${roomFilter === 'runtime' ? styles.viewerFilterChipActive : ''}`}
            onClick={() => onRoomFilterChange('runtime')}
            type="button"
          >
            Runtime Floor
          </button>
          <button
            className={`${styles.viewerFilterChip} ${roomFilter === 'workspace' ? styles.viewerFilterChipActive : ''}`}
            onClick={() => onRoomFilterChange('workspace')}
            type="button"
          >
            Workspaces
          </button>
          <button
            className={`${styles.viewerFilterChip} ${roomFilter === 'commons' ? styles.viewerFilterChipActive : ''}`}
            onClick={() => onRoomFilterChange('commons')}
            type="button"
          >
            Commons
          </button>
          <button
            className={`${styles.viewerFilterChip} ${layerFilter === 'all' ? styles.viewerFilterChipActive : ''}`}
            onClick={() => onLayerFilterChange('all')}
            type="button"
          >
            All Presences
          </button>
          <button
            className={`${styles.viewerFilterChip} ${layerFilter === 'agents' ? styles.viewerFilterChipActive : ''}`}
            onClick={() => onLayerFilterChange('agents')}
            type="button"
          >
            Agents
          </button>
          <button
            className={`${styles.viewerFilterChip} ${layerFilter === 'objects' ? styles.viewerFilterChipActive : ''}`}
            onClick={() => onLayerFilterChange('objects')}
            type="button"
          >
            Objects
          </button>
        </div>
        <label className={styles.viewerSearch}>
          <Search aria-hidden className={styles.viewerSearchIcon} />
          <input
            className={styles.viewerSearchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter by room, agent, object, or runtime event"
            value={search}
          />
        </label>
      </div>
      <div className={styles.viewerLegend}>
        <div className={styles.viewerLegendItem}>
          <span className={`${styles.viewerLegendSwatch} ${styles.viewerLegendLive}`} />
          <span>Live event</span>
        </div>
        <div className={styles.viewerLegendItem}>
          <span className={`${styles.viewerLegendSwatch} ${styles.viewerLegendAgent}`} />
          <span>Agent presence</span>
        </div>
        <div className={styles.viewerLegendItem}>
          <span className={`${styles.viewerLegendSwatch} ${styles.viewerLegendObject}`} />
          <span>Runtime object</span>
        </div>
      </div>
    </div>
  );
}

function BuilderRuntimeDemoControls({
  demoId,
  maps,
  onDemoChange,
  onMapChange,
  selectedDemo,
  selectedMapId,
  status,
}: {
  demoId: string;
  maps: { id: string; name: string }[];
  onDemoChange: (demoId: string) => void;
  onMapChange: (mapId: string) => void;
  selectedDemo: (typeof observatoryRuntimeDemoFixtures)[number] | null;
  selectedMapId: string | null;
  status: RuntimeStatusSummary;
}) {
  return (
    <section className={styles.demoControls} aria-label="Observatory active runtime demo controls">
      <div>
        <h3 className={styles.demoControlsTitle}>Active runtime demo</h3>
        <p className={styles.demoControlsDescription}>
          {selectedDemo?.description ??
            'Use a deterministic fixture to test live workflow rooms, agents, laptops, events, logs, and overflow floors.'}
        </p>
      </div>
      <div className={styles.demoControlsFields}>
        <label className={styles.demoSelectLabel}>
          <span>Scenario</span>
          <select
            className={styles.demoSelect}
            onChange={(event) => onDemoChange(event.target.value)}
            value={demoId}
          >
            <option value="none">No active demo</option>
            {observatoryRuntimeDemoFixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.label}
              </option>
            ))}
          </select>
        </label>
        {selectedDemo && maps.length > 1 ? (
          <label className={styles.demoSelectLabel}>
            <span>Floor</span>
            <select
              className={styles.demoSelect}
              onChange={(event) => onMapChange(event.target.value)}
              value={selectedMapId ?? maps[0]?.id ?? ''}
            >
              {maps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className={styles.demoMetricRow}>
        <RuntimeStatusMetric label="Runs" value={status.previewRunCount} />
        <RuntimeStatusMetric label="Workflows" value={status.workflowCount} />
        <RuntimeStatusMetric label="Events" value={status.eventCount} />
        <RuntimeStatusMetric label="Logs" value={status.logCount} />
      </div>
    </section>
  );
}

interface RuntimeStatusSummary {
  activeRunCount: number;
  displayedAgentCount: number;
  eventCount: number;
  logCount: number;
  mode: ObservatoryRuntimePreviewMode;
  previewRunCount: number;
  selectedEventCount: number;
  selectedLogCount: number;
  selectedWorkflowCount: number;
  workflowCount: number;
}

function RuntimeStatusStrip({
  onInspect,
  status,
}: {
  onInspect?: () => void;
  status: RuntimeStatusSummary;
}) {
  const hasLiveRuntime = status.mode === 'live' && status.activeRunCount > 0;
  const hasHistoricalRuntime = status.mode === 'historical' && status.previewRunCount > 0;
  const description = hasLiveRuntime
    ? `${formatCount(status.selectedWorkflowCount, 'workflow')} on this floor, ${formatCount(status.selectedEventCount, 'event')}, ${formatCount(status.selectedLogCount, 'log')}.`
    : hasHistoricalRuntime
      ? `Historical preview from ${formatCount(status.previewRunCount, 'run')}; start or resume a workflow to switch back to live agent movement.`
      : 'No active workflows are visualized right now. The floor remains inspectable; start a run or clear completed-only filters to see live grouped agents and logs.';

  return null;
  // (
  // <section className={`${styles.runtimeStatusStrip} ${hasLiveRuntime ? styles.runtimeStatusLive : styles.runtimeStatusIdle}`}>
  //   <div>
  //     <p className={styles.runtimeStatusEyebrow}>
  //       {hasLiveRuntime ? 'Live runtime canvas' : hasHistoricalRuntime ? 'Historical runtime preview' : 'Ambient canvas'}
  //     </p>
  //     <p className={styles.runtimeStatusDescription}>{description}</p>
  //   </div>
  //   <div className={styles.runtimeStatusMetrics} aria-label="Observatory runtime status">
  //     <RuntimeStatusMetric label={status.mode === 'historical' ? 'Preview runs' : 'Live runs'} value={status.previewRunCount} />
  //     <RuntimeStatusMetric label="Workflows" value={status.workflowCount} />
  //     <RuntimeStatusMetric label="Events" value={status.eventCount} />
  //     <RuntimeStatusMetric label="Logs" value={status.logCount} />
  //     <RuntimeStatusMetric label="Agents" value={status.displayedAgentCount} />
  //   </div>
  //   <button className={`${styles.button} ${styles.buttonSecondary}`} disabled={!onInspect} onClick={onInspect} type="button">
  //     Inspect room
  //   </button>
  // </section>
  // );
}

function RuntimeStatusMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.runtimeStatusMetric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function SelectionDrawer({
  canvasEditResult,
  canEditObject = false,
  canEditRoom = false,
  isWallEditActive = false,
  layout,
  logAdapter,
  onClose,
  onDeleteObject,
  onDeleteRoom,
  onMoveObject,
  onMoveRoom,
  onResizeRoom,
  onToggleRoomWallEdit,
  onUpdateObject,
  onUpdateRoomBounds,
  selection,
}: {
  canvasEditResult?: ObservatoryLayoutEditResult | null;
  canEditObject?: boolean;
  canEditRoom?: boolean;
  isWallEditActive?: boolean;
  layout: ObservatoryLayoutDocument;
  logAdapter: ObservatoryRuntimeLogAdapter;
  onClose: () => void;
  onDeleteObject?: () => void;
  onDeleteRoom?: () => void;
  onMoveObject?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onMoveRoom?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onResizeRoom?: () => void;
  onToggleRoomWallEdit?: () => void;
  onUpdateObject?: (input: {
    position?: { x: number; y: number };
    render?: ObservatoryObjectRenderOptions;
    roomId?: string | null;
  }) => void;
  onUpdateRoomBounds?: (bounds: { x: number; y: number; width: number; height: number }) => void;
  selection: ObservatoryCanvasSelection;
}) {
  const map = layout.world.maps[0];
  const agent =
    selection.kind === 'agent'
      ? map?.agents.find((candidate) => candidate.id === selection.id)
      : undefined;
  const object =
    selection.kind === 'object'
      ? map?.objects.find((candidate) => candidate.id === selection.id)
      : undefined;
  const room =
    selection.kind === 'room'
      ? map?.rooms.find((candidate) => candidate.id === selection.id)
      : undefined;
  const roomAgents = room
    ? (map?.agents.filter((candidate) => candidate.roomId === room.id) ?? [])
    : [];
  const inspectionQuery = useMemo(() => {
    if (agent) {
      return {
        kind: 'agent' as const,
        query: {
          agentId: agent.id,
          limit: 300,
          runId: agent.runtime?.runId,
          workflowId: agent.runtime?.workflowId,
        },
      };
    }

    if (object) {
      return {
        kind: 'object' as const,
        query: {
          limit: 300,
          objectId: object.id,
          runId: object.runtime?.runId,
          workflowId: object.runtime?.workflowId,
        },
      };
    }

    if (room) {
      return {
        kind: 'room' as const,
        query: {
          limit: 300,
          roomId: room.id,
          runId: room.runtime?.runId,
          workflowId: room.runtime?.workflowId,
        },
      };
    }

    return { kind: 'none' as const, query: {} };
  }, [agent, object, room]);
  const [inspectionLogs, setInspectionLogs] = useState<ObservatoryInspectionLogResult>({
    entries: [],
    query: inspectionQuery.query,
    status: 'loading',
  });
  const [objectRoomId, setObjectRoomId] = useState(object?.roomId ?? '');
  const [gridX, setGridX] = useState(() => String(object?.position.x ?? 0));
  const [gridY, setGridY] = useState(() => String(object?.position.y ?? 0));
  const [offsetX, setOffsetX] = useState(() => String(object?.render?.offsetPx?.x ?? 0));
  const [offsetY, setOffsetY] = useState(() => String(object?.render?.offsetPx?.y ?? 0));
  const [sizeWidthPx, setSizeWidthPx] = useState(() =>
    String(Math.round(object?.render?.sizePx?.width ?? 48))
  );
  const [sizeHeightPx, setSizeHeightPx] = useState(() =>
    String(Math.round(object?.render?.sizePx?.height ?? 48))
  );
  const [roomOriginX, setRoomOriginX] = useState(() => String(room?.bounds.x ?? 0));
  const [roomOriginY, setRoomOriginY] = useState(() => String(room?.bounds.y ?? 0));
  const [roomWidth, setRoomWidth] = useState(() => String(room?.bounds.width ?? 1));
  const [roomHeight, setRoomHeight] = useState(() => String(room?.bounds.height ?? 1));

  useEffect(() => {
    let cancelled = false;

    setInspectionLogs({
      entries: [],
      query: inspectionQuery.query,
      status: inspectionQuery.kind === 'none' ? 'empty' : 'loading',
    });

    async function loadLogs() {
      try {
        const result =
          inspectionQuery.kind === 'agent'
            ? await logAdapter.getAgentLogs(inspectionQuery.query)
            : inspectionQuery.kind === 'object'
              ? await logAdapter.getObjectLogs(inspectionQuery.query)
              : inspectionQuery.kind === 'room'
                ? await logAdapter.getRoomLogs(inspectionQuery.query)
                : { entries: [], query: inspectionQuery.query, status: 'empty' as const };

        if (!cancelled) {
          setInspectionLogs(result);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setInspectionLogs({
            entries: [],
            error:
              caughtError instanceof Error
                ? caughtError.message
                : 'Unable to load inspection logs.',
            query: inspectionQuery.query,
            status: 'error',
          });
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [inspectionQuery, logAdapter]);

  useEffect(() => {
    if (!object) {
      return;
    }

    setObjectRoomId(object.roomId ?? '');
    setGridX(String(object.position.x));
    setGridY(String(object.position.y));
    setOffsetX(String(object.render?.offsetPx?.x ?? 0));
    setOffsetY(String(object.render?.offsetPx?.y ?? 0));
    setSizeWidthPx(String(Math.round(object.render?.sizePx?.width ?? 48)));
    setSizeHeightPx(String(Math.round(object.render?.sizePx?.height ?? 48)));
  }, [object]);

  useEffect(() => {
    if (!room) {
      return;
    }

    setRoomOriginX(String(room.bounds.x));
    setRoomOriginY(String(room.bounds.y));
    setRoomWidth(String(room.bounds.width));
    setRoomHeight(String(room.bounds.height));
  }, [room]);
  const title =
    agent?.name ??
    (object ? formatRuntimeEntityTitle(object.id) : null) ??
    room?.name ??
    selection.label;

  const parsedGridX = Number.parseInt(gridX, 10);
  const parsedGridY = Number.parseInt(gridY, 10);
  const parsedOffsetX = Number.parseFloat(offsetX);
  const parsedOffsetY = Number.parseFloat(offsetY);
  const parsedSizeWidthPx = Number.parseFloat(sizeWidthPx);
  const parsedSizeHeightPx = Number.parseFloat(sizeHeightPx);
  const canApplyGrid =
    Number.isInteger(parsedGridX) &&
    parsedGridX >= 0 &&
    Number.isInteger(parsedGridY) &&
    parsedGridY >= 0;
  const canApplyOffset = Number.isFinite(parsedOffsetX) && Number.isFinite(parsedOffsetY);
  const canApplySizePx =
    Number.isFinite(parsedSizeWidthPx) &&
    parsedSizeWidthPx > 0 &&
    Number.isFinite(parsedSizeHeightPx) &&
    parsedSizeHeightPx > 0;
  const parsedRoomOriginX = Number.parseInt(roomOriginX, 10);
  const parsedRoomOriginY = Number.parseInt(roomOriginY, 10);
  const parsedRoomWidth = Number.parseInt(roomWidth, 10);
  const parsedRoomHeight = Number.parseInt(roomHeight, 10);
  const canApplyRoomBounds =
    Number.isInteger(parsedRoomOriginX) &&
    parsedRoomOriginX >= 0 &&
    Number.isInteger(parsedRoomOriginY) &&
    parsedRoomOriginY >= 0 &&
    Number.isInteger(parsedRoomWidth) &&
    parsedRoomWidth > 0 &&
    Number.isInteger(parsedRoomHeight) &&
    parsedRoomHeight > 0;

  return (
    <div className={styles.selectionDrawerBackdrop} onClick={onClose} role="presentation">
      <aside
        className={styles.selectionDrawer}
        aria-label="Observatory selection inspector"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerEyebrow}>{selection.kind} inspector</p>
            <h3 className={styles.drawerTitle}>{title}</h3>
            {/*<p className={styles.debugDescription}>{subtitle}</p>*/}
          </div>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className={styles.selectionDrawerBody}>
          {agent ? (
            <>
              {/*<SelectionField label="Asset" value={agent.assetId} />*/}
              {/*<SelectionField label="Room" value={agent.roomId ?? 'unassigned'} />*/}
              {/*<SelectionField label="Grid" value={`${agent.position.x}, ${agent.position.y}`} />*/}
              <SelectionField label="Role" value={resolveAgentRoleLabel(agent)} />
              <SelectionField label="Status" value={agent.status} />
              {/*<SelectionField label="Run" value={agent.runtime?.runId ?? 'none'} />*/}
              {/*<SelectionField label="Target" value={agent.runtime?.targetObjectId ?? 'roaming'} />*/}
              {/*<SelectionField*/}
              {/*  label="Activity"*/}
              {/*  value={agent.runtime?.description ?? 'Idle ambient presence'}*/}
              {/*/>*/}
              <InspectionLogSection
                result={filterInspectionLogsBySource(inspectionLogs, 'runtime-event')}
                title="Execution events"
              />
              <InspectionLogSection
                result={filterInspectionLogsBySource(inspectionLogs, 'runtime-log')}
                title="Whole agent logs"
              />
            </>
          ) : null}
          {object ? (
            <>
              {/*<SelectionField label="Asset" value={object.assetId} />*/}
              {canEditObject ? (
                <section
                  className={styles.drawerEditorSection}
                  aria-label="Object layout room controls"
                >
                  <label className={styles.drawerField}>
                    <span>Layout room</span>
                    <select
                      className={styles.drawerSelect}
                      onChange={(event) => {
                        const nextRoomId = event.target.value;
                        setObjectRoomId(nextRoomId);
                        onUpdateObject?.({ roomId: nextRoomId || null });
                      }}
                      value={objectRoomId}
                    >
                      <option value="">Unassigned</option>
                      {map?.rooms.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    onClick={() =>
                      onUpdateObject?.({
                        position: { x: object.position.x, y: object.position.y },
                      })
                    }
                    type="button"
                  >
                    Auto room from grid
                  </button>
                </section>
              ) : (
                // <SelectionField label="Layout room" value={object.roomId ?? 'unassigned'} />
                <a />
              )}
              {canEditObject ? (
                <section className={styles.drawerEditorSection} aria-label="Object grid controls">
                  <div className={styles.drawerFieldRow}>
                    <label className={styles.drawerField}>
                      <span>Layout grid X</span>
                      <input
                        className={styles.drawerInput}
                        inputMode="numeric"
                        onChange={(event) => setGridX(event.target.value)}
                        value={gridX}
                      />
                    </label>
                    <label className={styles.drawerField}>
                      <span>Layout grid Y</span>
                      <input
                        className={styles.drawerInput}
                        inputMode="numeric"
                        onChange={(event) => setGridY(event.target.value)}
                        value={gridY}
                      />
                    </label>
                  </div>
                  <button
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    disabled={!canApplyGrid}
                    onClick={() =>
                      onUpdateObject?.({ position: { x: parsedGridX, y: parsedGridY } })
                    }
                    type="button"
                  >
                    Apply grid
                  </button>
                </section>
              ) : (
                // <SelectionField
                //   label="Layout grid"
                //   value={`${object.position.x}, ${object.position.y}`}
                // />
                <a />
              )}
              {canEditObject ? (
                <SelectionField
                  label="Collision size"
                  value={`${object.size?.width ?? 1}x${object.size?.height ?? 1}`}
                />
              ) : null}
              {canEditObject ? (
                <SelectionField
                  label="Blocks movement"
                  value={object.blocksMovement ? 'yes' : 'no'}
                />
              ) : null}
              {canEditObject ? (
                <SelectionField label="Mode" value={object.runtime?.behavior ?? 'ambient'} />
              ) : null}
              {canEditObject ? (
                <SelectionField label="Workflow" value={object.runtime?.workflowId ?? 'none'} />
              ) : null}
              {canEditObject ? (
                <SelectionField
                  label="Purpose"
                  value={object.runtime?.description ?? 'Layout object'}
                />
              ) : null}
              {canEditObject ? (
                <section className={styles.drawerActionSection} aria-label="Builder object actions">
                  <div className={styles.drawerMovePad}>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveUp}`}
                      onClick={() => onMoveObject?.('up')}
                      type="button"
                    >
                      Up
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveLeft}`}
                      onClick={() => onMoveObject?.('left')}
                      type="button"
                    >
                      Left
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveRight}`}
                      onClick={() => onMoveObject?.('right')}
                      type="button"
                    >
                      Right
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveDown}`}
                      onClick={() => onMoveObject?.('down')}
                      type="button"
                    >
                      Down
                    </button>
                  </div>
                  <section
                    className={styles.drawerEditorSection}
                    aria-label="Object fine position controls"
                  >
                    <div className={styles.drawerFieldRow}>
                      <label className={styles.drawerField}>
                        <span>Visual offset X px</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="decimal"
                          onChange={(event) => setOffsetX(event.target.value)}
                          value={offsetX}
                        />
                      </label>
                      <label className={styles.drawerField}>
                        <span>Visual offset Y px</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="decimal"
                          onChange={(event) => setOffsetY(event.target.value)}
                          value={offsetY}
                        />
                      </label>
                    </div>
                    <div className={styles.drawerButtonRow}>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        disabled={!canApplyOffset}
                        onClick={() =>
                          onUpdateObject?.({
                            render: {
                              ...object.render,
                              offsetPx: { x: parsedOffsetX, y: parsedOffsetY },
                            },
                          })
                        }
                        type="button"
                      >
                        Apply fine offset
                      </button>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        onClick={() =>
                          onUpdateObject?.({
                            render: {
                              ...object.render,
                              offsetPx: { x: 0, y: 0 },
                            },
                          })
                        }
                        type="button"
                      >
                        Reset offset
                      </button>
                    </div>
                  </section>
                  <section
                    className={styles.drawerEditorSection}
                    aria-label="Object render size controls"
                  >
                    <div className={styles.drawerFieldRow}>
                      <label className={styles.drawerField}>
                        <span>Visual width px</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="decimal"
                          onChange={(event) => setSizeWidthPx(event.target.value)}
                          value={sizeWidthPx}
                        />
                      </label>
                      <label className={styles.drawerField}>
                        <span>Visual height px</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="decimal"
                          onChange={(event) => setSizeHeightPx(event.target.value)}
                          value={sizeHeightPx}
                        />
                      </label>
                    </div>
                    <div className={styles.drawerButtonRow}>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        disabled={!canApplySizePx}
                        onClick={() =>
                          onUpdateObject?.({
                            render: {
                              ...object.render,
                              sizePx: {
                                width: parsedSizeWidthPx,
                                height: parsedSizeHeightPx,
                              },
                            },
                          })
                        }
                        type="button"
                      >
                        Apply size
                      </button>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        onClick={() =>
                          onUpdateObject?.({
                            render: object.render
                              ? {
                                  ...object.render,
                                  sizePx: undefined,
                                }
                              : undefined,
                          })
                        }
                        type="button"
                      >
                        Reset size
                      </button>
                    </div>
                  </section>
                  <button
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    onClick={() => onUpdateObject?.({ render: {} })}
                    type="button"
                  >
                    Reset all visual overrides
                  </button>
                  <button
                    className={`${styles.button} ${styles.buttonDanger}`}
                    onClick={onDeleteObject}
                    type="button"
                  >
                    Delete object
                  </button>
                </section>
              ) : null}
              <InspectionLogSection
                result={filterInspectionLogsBySource(inspectionLogs, 'runtime-event')}
                title="Object events"
              />
              <InspectionLogSection
                result={filterInspectionLogsBySource(inspectionLogs, 'runtime-log')}
                title="Object logs"
              />
            </>
          ) : null}
          {room ? (
            <>
              <SelectionField label="Kind" value={room.kind} />
              <SelectionField label="Origin" value={`${room.bounds.x}, ${room.bounds.y}`} />
              <SelectionField label="Size" value={`${room.bounds.width}x${room.bounds.height}`} />
              <SelectionField
                label="Floor"
                value={room.floorAssetId ?? map?.defaultFloorAssetId ?? 'default'}
              />
              <SelectionField label="Wall" value={room.wallAssetId ?? 'none'} />
              {canEditRoom ? (
                <section className={styles.drawerActionSection} aria-label="Builder room actions">
                  <section
                    className={styles.drawerEditorSection}
                    aria-label="Room geometry controls"
                  >
                    <div className={styles.drawerFieldRow}>
                      <label className={styles.drawerField}>
                        <span>Origin X</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="numeric"
                          onChange={(event) => setRoomOriginX(event.target.value)}
                          value={roomOriginX}
                        />
                      </label>
                      <label className={styles.drawerField}>
                        <span>Origin Y</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="numeric"
                          onChange={(event) => setRoomOriginY(event.target.value)}
                          value={roomOriginY}
                        />
                      </label>
                    </div>
                    <div className={styles.drawerFieldRow}>
                      <label className={styles.drawerField}>
                        <span>Width</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="numeric"
                          onChange={(event) => setRoomWidth(event.target.value)}
                          value={roomWidth}
                        />
                      </label>
                      <label className={styles.drawerField}>
                        <span>Height</span>
                        <input
                          className={styles.drawerInput}
                          inputMode="numeric"
                          onChange={(event) => setRoomHeight(event.target.value)}
                          value={roomHeight}
                        />
                      </label>
                    </div>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary}`}
                      disabled={!canApplyRoomBounds}
                      onClick={() =>
                        onUpdateRoomBounds?.({
                          x: parsedRoomOriginX,
                          y: parsedRoomOriginY,
                          width: parsedRoomWidth,
                          height: parsedRoomHeight,
                        })
                      }
                      type="button"
                    >
                      Apply room bounds
                    </button>
                  </section>
                  <div className={styles.drawerMovePad}>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveUp}`}
                      onClick={() => onMoveRoom?.('up')}
                      type="button"
                    >
                      Up
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveLeft}`}
                      onClick={() => onMoveRoom?.('left')}
                      type="button"
                    >
                      Left
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveRight}`}
                      onClick={() => onMoveRoom?.('right')}
                      type="button"
                    >
                      Right
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary} ${styles.drawerMoveDown}`}
                      onClick={() => onMoveRoom?.('down')}
                      type="button"
                    >
                      Down
                    </button>
                  </div>
                  <div className={styles.drawerButtonRow}>
                    <button
                      className={`${styles.button} ${styles.buttonSecondary}`}
                      onClick={onResizeRoom}
                      type="button"
                    >
                      Resize room
                    </button>
                    <button
                      className={`${styles.button} ${isWallEditActive ? '' : styles.buttonSecondary}`}
                      onClick={onToggleRoomWallEdit}
                      type="button"
                    >
                      {isWallEditActive ? 'Wall edit on' : 'Edit walls'}
                    </button>
                  </div>
                  <button
                    className={`${styles.button} ${styles.buttonDanger}`}
                    onClick={onDeleteRoom}
                    type="button"
                  >
                    Delete room
                  </button>
                  <p className={styles.drawerHelperText}>
                    {isWallEditActive
                      ? 'Wall edit is active. Click room perimeter cells on the canvas to remove wall segments or place doors for the selected room.'
                      : 'Use Edit walls, then click room perimeter cells on the canvas.'}
                  </p>
                  <SelectionField
                    label="Wall openings"
                    value={String(countRoomWallOpenings(room))}
                  />
                  <SelectionField label="Wall doors" value={String(room.wallDoors?.length ?? 0)} />
                  {canvasEditResult ? (
                    <p className={styles.drawerHelperText}>
                      {canvasEditResult.message}
                      {canvasEditResult.issues
                        .map((issue) => ` ${issue.path}: ${issue.reason}`)
                        .join('')}
                    </p>
                  ) : null}
                </section>
              ) : null}
              <InspectionLogSection
                result={filterInspectionLogsBySource(inspectionLogs, 'runtime-event')}
                title="Workflow events"
              />
              <InspectionLogSection
                result={filterInspectionLogsBySource(inspectionLogs, 'runtime-log')}
                title="Room workflow logs"
              />
              <SelectionField
                label="Agents"
                value={
                  roomAgents.length > 0
                    ? roomAgents
                        .map(
                          (candidate) =>
                            `${candidate.name} (${candidate.runtime?.behavior ?? candidate.status})`
                        )
                        .join(', ')
                    : 'none'
                }
              />
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function resolveAgentRoleLabel(
  agent: ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]
) {
  return agent.runtime?.role || 'unassigned';
}

function formatRuntimeEntityTitle(value: string) {
  const sanitized = value
    .replace(/^(agent|object|room):/i, '')
    .replace(/^level-\d+-/i, '')
    .replace(/[-_:]+/g, ' ')
    .trim();

  return sanitized.replace(/\b\w/g, (char) => char.toUpperCase()) || 'Selection';
}

function InspectionLogSection({
  result,
  title,
}: {
  result: ObservatoryInspectionLogResult;
  title: string;
}) {
  const entries = sortInspectionLogsNewestFirst(result.entries);

  return (
    <details className={styles.runtimePreview} open={entries.length > 0}>
      <summary className={styles.runtimePreviewSummary}>
        <span className={styles.runtimePreviewSummaryText}>
          <span>{title}</span>
          <small>{entries.length > 0 ? 'Recent run story' : 'No activity captured'}</small>
        </span>
        <strong>{entries.length}</strong>
      </summary>
      {entries.length > 0 ? (
        <div className={styles.runtimePreviewList} role="list">
          <div className={styles.inspectionLogHeader} aria-hidden="true">
            <span>Time</span>
            <span>Message</span>
            <span>Who</span>
          </div>
          {entries.map((entry) => (
            <InspectionLogRow entry={entry} key={entry.id} />
          ))}
        </div>
      ) : (
        <p className={styles.runtimePreviewEmpty}>
          {result.status === 'loading'
            ? `Loading ${title.toLowerCase()}...`
            : result.status === 'error'
              ? (result.error ?? `Unable to load ${title.toLowerCase()}.`)
              : `No real ${title.toLowerCase()} available for this selection yet.`}
        </p>
      )}
    </details>
  );
}

function InspectionLogRow({ entry }: { entry: ObservatoryInspectionLogEntry }) {
  const display = formatInspectionLogDisplay(entry);

  return (
    <div
      className={`${styles.inspectionLogEntry} ${styles[`inspectionLogEntry${capitalizeLogLevel(entry.level)}`]}`}
      role="listitem"
    >
      <time className={styles.inspectionLogTimeCell} dateTime={entry.timestamp}>
        {display.time}
      </time>
      <p className={styles.inspectionLogMessage}>{display.message}</p>
      <span className={styles.inspectionLogWho}>{display.who}</span>
    </div>
  );
}

function filterInspectionLogsBySource(
  result: ObservatoryInspectionLogResult,
  source: ObservatoryInspectionLogSource
): ObservatoryInspectionLogResult {
  const entries = result.entries.filter((entry) => entry.source === source);

  return {
    ...result,
    entries,
    status:
      entries.length > 0
        ? 'ready'
        : result.status === 'error' || result.status === 'loading'
          ? result.status
          : 'empty',
  };
}

function sortInspectionLogsNewestFirst(entries: ObservatoryInspectionLogEntry[]) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftTime = left.entry.timestamp ? Date.parse(left.entry.timestamp) : Number.NaN;
      const rightTime = right.entry.timestamp ? Date.parse(right.entry.timestamp) : Number.NaN;
      const hasLeftTime = Number.isFinite(leftTime);
      const hasRightTime = Number.isFinite(rightTime);

      if (hasLeftTime && hasRightTime && leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      if (hasLeftTime !== hasRightTime) {
        return hasLeftTime ? -1 : 1;
      }

      return right.index - left.index;
    })
    .map(({ entry }) => entry);
}

function formatInspectionLogDisplay(entry: ObservatoryInspectionLogEntry) {
  const parsed = parseInspectionLogMessage(entry.message);
  const eventLabel = entry.eventType ? formatRuntimeEntityTitle(entry.eventType) : null;

  return {
    message: parsed.message || eventLabel || 'Activity recorded',
    time: entry.timestamp ? formatInspectionLogTime(entry.timestamp) : (parsed.time ?? '—'),
    who:
      parsed.who ??
      (entry.agentId ? formatInspectionLogWho(entry.agentId) : null) ??
      (entry.taskId ? formatInspectionLogWho(entry.taskId) : null) ??
      'Runtime',
  };
}

function parseInspectionLogMessage(value: string) {
  const message = value.trim();

  if (!message) {
    return { message: '' };
  }

  const numberedActorMatch = message.match(/^\[\d+\]\s*\[([^\]]+)\]\s*(.*)$/);
  if (numberedActorMatch) {
    return {
      message: numberedActorMatch[2]?.trim() || 'Activity recorded',
      who: formatInspectionLogWho(numberedActorMatch[1] ?? ''),
    };
  }

  const parts = message
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return { message };
  }

  const time = looksLikeTime(parts[0] ?? '') ? parts.shift() : undefined;
  const eventType = looksLikeEventType(parts[0] ?? '') ? parts.shift() : undefined;
  const who =
    parts.length >= 2 && looksLikeHumanLabel(parts[parts.length - 1] ?? '')
      ? parts.pop()
      : undefined;
  const body = parts.join(' · ').trim();
  const eventLabel = eventType ? formatRuntimeEntityTitle(eventType) : null;

  return {
    message: body && eventLabel ? `${eventLabel}: ${body}` : body || eventLabel || message,
    time,
    who: who ? formatInspectionLogWho(who) : undefined,
  };
}

function looksLikeTime(value: string) {
  return /^\d{1,2}:\d{2}\s?(AM|PM)?$/i.test(value);
}

function looksLikeEventType(value: string) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(value);
}

function looksLikeHumanLabel(value: string) {
  return value.length <= 80 && /\s/.test(value) && !/[.!?]$/.test(value);
}

function formatInspectionLogWho(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return 'Runtime';
  }

  if (normalized.toLowerCase() === 'workflow') {
    return 'Workflow';
  }

  return formatRuntimeEntityTitle(normalized.replace(/^workflow-[a-z0-9-]+-agent-/i, ''));
}

function formatInspectionLogTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function capitalizeLogLevel(level: ObservatoryInspectionLogEntry['level']) {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}

function SelectionField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.selectionField}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DebugAccordion({
  children,
  defaultOpen = false,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  return (
    <details className={styles.debugAccordion} open={defaultOpen}>
      <summary className={styles.debugSummary}>{title}</summary>
      <div className={styles.debugContent}>{children}</div>
    </details>
  );
}

const runtimeAgentAssetIds = [
  'human:atlas',
  'human:byte',
  'human:clio',
  'human:delta',
  'human:echo',
];
const reviewedFurnitureAssetIds = {
  agentLaptop: 'furniture:1-modern-office-singles-48x48:compact-gray-laptop',
  executionChair: 'furniture:1-modern-office-singles-48x48:modern-office-gray-office-chair-front',
  executionComputer:
    'furniture:1-modern-office-singles-48x48:modern-office-compact-computer-terminal',
  planningWhiteboard: 'furniture:1-modern-office-singles-48x48:planning-whiteboard-chart',
  workstation: 'furniture:1-modern-office-singles-48x48:server-workbench-with-tools',
} as const;
const runtimeWorkflowRoomCapacityPerGeneratedMap = 4;
type ObservatoryFurnitureBehaviorRole =
  | 'computer'
  | 'pantry'
  | 'planning'
  | 'runtime'
  | 'seating'
  | 'storage'
  | 'surface'
  | 'unknown';
type ObservatoryAmbientInteractionKind =
  | 'books'
  | 'chair'
  | 'coffee'
  | 'computer'
  | 'cup'
  | 'fridge'
  | 'plant'
  | 'server'
  | 'surface'
  | 'tv'
  | 'water'
  | 'whiteboard';
type ObservatoryAmbientRoomContext =
  | 'commonWork'
  | 'connector'
  | 'corridor'
  | 'executive'
  | 'generic'
  | 'meeting'
  | 'pantry'
  | 'planning'
  | 'reception'
  | 'runtimeLab'
  | 'smallMeeting'
  | 'warRoom';
type ObservatoryAmbientBehaviorKind = 'look' | 'object' | 'pause' | 'read' | 'roam';

function getRunWorkflowId(run: RunSessionSummary) {
  return run.workflowId ?? `workflow:${run.id}`;
}

function getVisualizableRuns(
  runs: RunSessionSummary[],
  previewMode: ObservatoryRuntimePreviewMode
) {
  const visualizableRuns =
    previewMode === 'historical' ? runs : runs.filter((run) => !isTerminalRunStatus(run.status));
  return [...visualizableRuns].sort(compareRuntimeRunPriority);
}

function getVisualizableRuntimeContexts(
  runtimeContext: ObservatoryRuntimeRunContext[],
  previewMode: ObservatoryRuntimePreviewMode
) {
  const visualizableContexts =
    previewMode === 'historical'
      ? runtimeContext
      : runtimeContext.filter((context) => !isTerminalRunStatus(context.run.status));

  return [...visualizableContexts].sort((left, right) =>
    compareRuntimeRunPriority(left.run, right.run)
  );
}

function getRuntimeWorkflowIds(runs: RunSessionSummary[]) {
  return Array.from(new Set(runs.map(getRunWorkflowId)));
}

function getWorkflowRoomCapacity(map: ObservatoryLayoutDocument['world']['maps'][number]) {
  return Math.max(
    1,
    map.rooms.filter((room) => room.kind === 'workspace' || room.kind === 'runtime').length
  );
}

function summarizeRuntimeContext(
  runtimeContext: ObservatoryRuntimeRunContext[],
  selectedRuntimeContext: ObservatoryRuntimeRunContext[],
  renderedLayout: ObservatoryLayoutDocument | null | undefined,
  previewMode: ObservatoryRuntimePreviewMode
): RuntimeStatusSummary {
  const activeContexts = runtimeContext.filter(
    (context) => !isTerminalRunStatus(context.run.status)
  );
  const previewContexts = getVisualizableRuntimeContexts(runtimeContext, previewMode);
  const selectedPreviewContexts = getVisualizableRuntimeContexts(
    selectedRuntimeContext,
    previewMode
  );

  return {
    activeRunCount: activeContexts.length,
    displayedAgentCount: renderedLayout?.world.maps[0]?.agents.length ?? 0,
    eventCount: previewContexts.reduce((total, context) => total + context.events.length, 0),
    logCount: previewContexts.reduce((total, context) => total + context.logs.length, 0),
    mode: previewMode,
    previewRunCount: previewContexts.length,
    selectedEventCount: selectedPreviewContexts.reduce(
      (total, context) => total + context.events.length,
      0
    ),
    selectedLogCount: selectedPreviewContexts.reduce(
      (total, context) => total + context.logs.length,
      0
    ),
    selectedWorkflowCount: new Set(
      selectedPreviewContexts.map((context) => getRunWorkflowId(context.run))
    ).size,
    workflowCount: new Set(previewContexts.map((context) => getRunWorkflowId(context.run))).size,
  };
}

function createPrimaryInspectableSelection(
  renderedLayout: ObservatoryLayoutDocument | null | undefined
): ObservatoryCanvasSelection | null {
  const map = renderedLayout?.world.maps[0];

  if (!map) {
    return null;
  }

  const runtimeAgent = map.agents.find((agent) => agent.runtime?.workflowId);
  if (runtimeAgent) {
    return { id: runtimeAgent.id, kind: 'agent', label: runtimeAgent.name };
  }

  const runtimeRoom = map.rooms.find((room) => room.runtime?.workflowId);
  if (runtimeRoom) {
    return { id: runtimeRoom.id, kind: 'room', label: runtimeRoom.name };
  }

  const firstRoom = map.rooms[0];
  if (firstRoom) {
    return { id: firstRoom.id, kind: 'room', label: firstRoom.name };
  }

  return null;
}

function formatCount(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? '' : 's'}`;
}

function ensureRuntimeOverflowMaps(layout: ObservatoryLayoutDocument, runs: RunSessionSummary[]) {
  const workflowIds = getRuntimeWorkflowIds(runs);
  const baseLayout = cloneObservatoryLayout(layout);
  const existingCapacity = baseLayout.world.maps.reduce(
    (total, map) => total + getWorkflowRoomCapacity(map),
    0
  );
  const overflowWorkflowCount = Math.max(0, workflowIds.length - existingCapacity);
  const overflowMapCount = Math.ceil(
    overflowWorkflowCount / runtimeWorkflowRoomCapacityPerGeneratedMap
  );

  for (let index = 0; index < overflowMapCount; index += 1) {
    baseLayout.world.maps.push(createRuntimeOverflowMap(index + 1));
  }

  return baseLayout;
}

function assignRuntimeWorkflowMapIds(
  layout: ObservatoryLayoutDocument | null,
  runs: RunSessionSummary[]
) {
  const assignments = new Map<string, string>();

  if (!layout) {
    return assignments;
  }

  const workflowIds = getRuntimeWorkflowIds(runs);
  const mapSlots = layout.world.maps.flatMap((map) =>
    Array.from({ length: getWorkflowRoomCapacity(map) }, () => map.id)
  );

  workflowIds.forEach((workflowId, index) => {
    const mapId = mapSlots[index] ?? layout.world.maps.at(-1)?.id ?? layout.world.maps[0]?.id;
    if (mapId) {
      assignments.set(workflowId, mapId);
    }
  });

  return assignments;
}

function createRuntimeOverflowMap(
  index: number
): ObservatoryLayoutDocument['world']['maps'][number] {
  const suffix = `overflow-${index}`;

  return {
    defaultFloorAssetId: 'floor:office-blue',
    id: `map:runtime-${suffix}`,
    name: `Runtime Overflow ${index}`,
    size: { width: 42, height: 22 },
    rooms: [
      createRuntimeOverflowRoom(`room:${suffix}-pod-a`, 'Project Pod A', 'workspace', 1, 1, 13, 9),
      createRuntimeOverflowRoom(`room:${suffix}-pod-b`, 'Project Pod B', 'workspace', 15, 1, 12, 9),
      createRuntimeOverflowRoom(
        `room:${suffix}-war-room`,
        'Runtime War Room',
        'runtime',
        1,
        12,
        26,
        9
      ),
      createRuntimeOverflowRoom(
        `room:${suffix}-focus-room`,
        'Focus Room',
        'workspace',
        29,
        1,
        12,
        9
      ),
      createRuntimeOverflowRoom(
        `room:${suffix}-pantry`,
        'Overflow Pantry',
        'commons',
        29,
        12,
        12,
        9
      ),
    ],
    objects: [
      createRuntimeOverflowObject(
        `object:${suffix}-pod-a-whiteboard`,
        reviewedFurnitureAssetIds.planningWhiteboard,
        `room:${suffix}-pod-a`,
        3,
        3,
        2,
        3,
        true
      ),
      createRuntimeOverflowObject(
        `object:${suffix}-pod-b-whiteboard`,
        reviewedFurnitureAssetIds.planningWhiteboard,
        `room:${suffix}-pod-b`,
        17,
        3,
        2,
        3,
        true
      ),
      createRuntimeOverflowObject(
        `object:${suffix}-war-room-screens`,
        'furniture:1-modern-office-singles-48x48:modern-office-multi-monitor-control-station',
        `room:${suffix}-war-room`,
        11,
        14,
        4,
        3,
        true
      ),
      createRuntimeOverflowObject(
        `object:${suffix}-focus-desk`,
        reviewedFurnitureAssetIds.workstation,
        `room:${suffix}-focus-room`,
        33,
        5,
        2,
        3,
        true
      ),
      createRuntimeOverflowObject(
        `object:${suffix}-pantry-coffee`,
        'furniture:1-modern-office-singles-48x48:office-water-cooler',
        `room:${suffix}-pantry`,
        34,
        16,
        1,
        2,
        false
      ),
    ],
    agents: [],
  };
}

function createRuntimeOverflowRoom(
  id: string,
  name: string,
  kind: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number]['kind'],
  x: number,
  y: number,
  width: number,
  height: number
) {
  return {
    bounds: { height, width, x, y },
    floorAssetId: 'floor:office-blue',
    id,
    kind,
    name,
    wallAssetId: 'wall:office-partition',
  };
}

function createRuntimeOverflowObject(
  id: string,
  assetId: string,
  roomId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  blocksMovement: boolean
) {
  return {
    assetId,
    blocksMovement,
    id,
    position: { x, y },
    roomId,
    size: { height, width },
  };
}

function selectObservatoryLayoutMap(
  layout: ObservatoryLayoutDocument,
  mapId: string | null | undefined
) {
  const selectedMap = layout.world.maps.find((map) => map.id === mapId) ?? layout.world.maps[0];

  if (!selectedMap) {
    return layout;
  }

  const nextLayout = cloneObservatoryLayout(layout);
  const nextMap = cloneObservatoryLayout({
    ...layout,
    world: { ...layout.world, maps: [selectedMap] },
  }).world.maps[0];

  if (!nextMap) {
    return nextLayout;
  }

  return {
    ...nextLayout,
    world: {
      ...nextLayout.world,
      grid: {
        ...nextLayout.world.grid,
        size: { ...selectedMap.size },
      },
      maps: [nextMap],
    },
  };
}

function createLayoutAgentSources(
  layout: ObservatoryLayoutDocument
): ObservatoryRuntimeAgentSource[] {
  return (layout.world.maps[0]?.agents ?? []).map((agent) => ({
    description: agent.runtime?.description ?? null,
    id: agent.id,
    name: agent.name,
    role: agent.runtime?.behavior ?? null,
  }));
}

function applyIdleAgentsToLayout(
  layout: ObservatoryLayoutDocument,
  agents: ObservatoryRuntimeAgentSource[],
  useLayoutAgentsWhenEmpty: boolean
): ObservatoryLayoutDocument {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = nextLayout.world.maps[0];

  if (!map) {
    return nextLayout;
  }

  const seedAgents = map.agents;
  const idleAgentSources =
    agents.length > 0
      ? agents
      : useLayoutAgentsWhenEmpty
        ? createLayoutAgentSources(nextLayout)
        : [];

  map.agents = idleAgentSources.map((agent, index) => {
    const seedAgent = seedAgents[index % Math.max(seedAgents.length, 1)];
    const room = seedAgent?.roomId
      ? map.rooms.find((candidate) => candidate.id === seedAgent.roomId)
      : map.rooms[index % Math.max(map.rooms.length, 1)];
    const seedPosition = seedAgent?.position ?? deriveRuntimeAgentPosition(room, index);
    const position = isLayoutGridWalkable(map, seedPosition)
      ? seedPosition
      : room
        ? pickRoomRoamPoint(map, room, agent.id, index)
        : seedPosition;

    return {
      assetId: seedAgent?.assetId ?? runtimeAgentAssetIds[index % runtimeAgentAssetIds.length],
      id: agent.id,
      name: agent.name?.trim() || seedAgent?.name || agent.id,
      position,
      roomId: room?.id,
      runtime: {
        assignedWorkflows: agent.assignedWorkflows,
        behavior: 'ambient',
        description: describeIdleAgentPresence(agent),
        role: agent.role ?? null,
      },
      status: 'idle',
    };
  });

  return nextLayout;
}

function describeIdleAgentPresence(agent: ObservatoryRuntimeAgentSource) {
  const workflowNames =
    agent.assignedWorkflows
      ?.map((workflow) => workflow.name || workflow.id)
      .filter(Boolean)
      .slice(0, 4) ?? [];
  const assignmentSummary =
    workflowNames.length > 0
      ? ` Assigned workflows: ${workflowNames.join(', ')}${
          (agent.assignedWorkflows?.length ?? 0) > workflowNames.length ? ', ...' : ''
        }.`
      : '';
  const roleSummary = agent.role ? ` Role: ${agent.role}.` : '';
  const descriptionSummary = agent.description ? ` ${agent.description}` : '';

  return `Idle ambient presence. The agent can roam, pause, sit, or visit common areas until a workflow starts.${roleSummary}${assignmentSummary}${descriptionSummary}`;
}

function applyRuntimeAgentsToLayout(
  layout: ObservatoryLayoutDocument,
  agents: ObservatoryRuntimeAgentSource[],
  runs: RunSessionSummary[],
  runtimeContext: ObservatoryRuntimeRunContext[],
  previewMode: ObservatoryRuntimePreviewMode,
  runtimeObjectOverlays: boolean
): ObservatoryLayoutDocument {
  const nextLayout = cloneObservatoryLayout(layout);
  const map = nextLayout.world.maps[0];

  if (!map) {
    return nextLayout;
  }

  const seedAgents = map.agents;
  const runtimeContexts =
    runtimeContext.length > 0
      ? getVisualizableRuntimeContexts(runtimeContext, previewMode)
      : getVisualizableRuns(runs, previewMode).map((run) => ({
          events: [],
          logs: [],
          run,
          workflow: null,
        }));
  const runtimeRuns = runtimeContexts.map((context) => context.run);
  const agentsForLayout = createRuntimeDisplayAgents(agents, runtimeContexts);
  const workflowRooms = assignWorkflowRooms(map, runtimeRuns);
  const agentCountsByWorkflowId = countAgentsByWorkflowId(agentsForLayout, runtimeRuns);
  const assignedAgentCounts = new Map<string, number>();
  const assetsById = new Map(
    getObservatoryModuleAssetRegistry().assets.map((asset) => [asset.id, asset])
  );

  for (const [workflowId, room] of workflowRooms) {
    const context = runtimeContexts.find(
      (candidate) => (candidate.run.workflowId ?? `workflow:${candidate.run.id}`) === workflowId
    );
    attachWorkflowRoomRuntime(room, workflowId, context);
    if (runtimeObjectOverlays) {
      const requiredWorkstations = Math.max(1, agentCountsByWorkflowId.get(workflowId) ?? 1);
      ensureWorkflowRoomObjects(map, room, workflowId, requiredWorkstations, context);
    }
  }

  map.agents = agentsForLayout.map((agent, index) => {
    const runtimeContextForAgent = runtimeContexts[index % Math.max(runtimeContexts.length, 1)];
    const runtimeRun = runtimeContextForAgent?.run;

    if (runtimeRun) {
      const workflowId = runtimeRun.workflowId ?? `workflow:${runtimeRun.id}`;
      const workflowRoom =
        workflowRooms.get(workflowId) ?? map.rooms[index % Math.max(map.rooms.length, 1)];
      const workflowAgentIndex = assignedAgentCounts.get(workflowId) ?? 0;
      assignedAgentCounts.set(workflowId, workflowAgentIndex + 1);
      const behavior = mapRunToAgentBehavior(runtimeRun);
      const targetObject = findWorkflowTargetObject(map, workflowId, behavior, workflowAgentIndex);
      const fallbackPoint = deriveRuntimeAgentPosition(workflowRoom, workflowAgentIndex);
      const targetPoint = targetObject
        ? (pickObjectAdjacentWalkablePoint(
            map,
            targetObject,
            agent.id,
            fallbackPoint,
            assetsById,
            workflowAgentIndex
          ) ?? fallbackPoint)
        : fallbackPoint;
      const stagingPoint = workflowRoom
        ? pickWorkflowStagingPoint(map, workflowRoom, agent.id, workflowAgentIndex)
        : targetPoint;
      const dynamicLaptopObject =
        runtimeObjectOverlays && isWorkingBehavior(behavior) && !isTerminalRunStatus(runtimeRun.status)
          ? ensureAgentLaptopObject(
              map,
              agent.id,
              workflowId,
              runtimeRun,
              targetObject,
              targetPoint
            )
          : null;

      return {
        assetId: runtimeAgentAssetIds[index % runtimeAgentAssetIds.length],
        id: agent.id,
        name: agent.name?.trim() || agent.id,
        position: stagingPoint,
        roomId: workflowRoom?.id,
        runtime: {
          assignedWorkflows: agent.assignedWorkflows,
          behavior,
          description: describeRunAssignment(runtimeRun, behavior),
          logs: createAgentLogPreview(agent.id, runtimeContextForAgent),
          recentEvents: createAgentEventPreview(agent.id, runtimeContextForAgent),
          role: agent.role ?? null,
          runId: runtimeRun.id,
          targetObjectId: targetObject?.id ?? dynamicLaptopObject?.id,
          workflowId,
        },
        status: mapRunToAgentStatus(runtimeRun),
      };
    }

    const seedAgent = seedAgents[index % Math.max(seedAgents.length, 1)];
    const room = seedAgent?.roomId
      ? map.rooms.find((candidate) => candidate.id === seedAgent.roomId)
      : map.rooms[index % Math.max(map.rooms.length, 1)];
    const preferredPosition = seedAgent?.position ?? deriveRuntimeAgentPosition(room, index);
    const position = normalizeAgentPositionToRoomNetwork(
      map,
      preferredPosition,
      room,
      agent.id,
      index
    );

    return {
      assetId: runtimeAgentAssetIds[index % runtimeAgentAssetIds.length],
      id: agent.id,
      name: agent.name?.trim() || agent.id,
      position,
      roomId: room?.id,
      runtime: {
        assignedWorkflows: agent.assignedWorkflows,
        behavior: 'ambient',
        description: describeIdleAgentPresence(agent),
        role: agent.role ?? null,
      },
      status: 'idle',
    };
  });

  return nextLayout;
}

function normalizeAgentPositionToRoomNetwork(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  preferredPoint: { x: number; y: number },
  preferredRoom: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number] | undefined,
  agentId: string,
  seed: number
) {
  if (isLayoutGridWalkable(map, preferredPoint)) {
    return preferredPoint;
  }

  if (preferredRoom) {
    const roomPoint = pickRoomRoamPoint(map, preferredRoom, agentId, seed);
    if (isLayoutGridWalkable(map, roomPoint)) {
      return roomPoint;
    }
  }

  for (const room of map.rooms) {
    const roomPoint = pickRoomRoamPoint(map, room, agentId, seed);
    if (isLayoutGridWalkable(map, roomPoint)) {
      return roomPoint;
    }
  }

  return preferredPoint;
}

function createRuntimeDisplayAgents(
  agents: ObservatoryRuntimeAgentSource[],
  runtimeContexts: ObservatoryRuntimeRunContext[]
) {
  const workflowAgents = new Map<string, ObservatoryRuntimeAgentSource>();

  runtimeContexts.forEach((context) => {
    context.workflow?.agent_definitions?.forEach((agent) => {
      workflowAgents.set(agent.id, {
        assignedWorkflows: context.workflow
          ? [{ id: context.workflow.id, name: context.workflow.name }]
          : undefined,
        description: agent.description ?? null,
        id: agent.id,
        name: agent.name || agent.id,
        role: agent.role ?? null,
      });
    });
  });

  if (workflowAgents.size > 0) {
    return Array.from(workflowAgents.values());
  }

  return agents;
}

function ensureAgentLaptopObject(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  agentId: string,
  workflowId: string,
  run: RunSessionSummary,
  targetObject: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number] | undefined,
  targetPoint: { x: number; y: number }
) {
  const laptopId = `object:agent-laptop-${sanitizeRuntimeId(run.id)}-${sanitizeRuntimeId(agentId)}`;
  const existing = map.objects.find((object) => object.id === laptopId);

  if (existing) {
    return existing;
  }

  const position = targetObject
    ? { ...targetObject.position }
    : { x: targetPoint.x, y: Math.max(0, targetPoint.y - 1) };

  const laptopObject: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number] = {
    assetId: reviewedFurnitureAssetIds.agentLaptop,
    blocksMovement: false,
    id: laptopId,
    position,
    roomId: targetObject?.roomId,
    runtime: {
      behavior: 'executing',
      description: `Dynamic laptop for ${agentId} while executing run ${run.id}.`,
      runId: run.id,
      workflowId,
    },
    size: { width: 2, height: 3 },
  };

  map.objects.push(laptopObject);
  return laptopObject;
}

function isTerminalRunStatus(status: RunSessionSummary['status']) {
  return status === 'cancelled' || status === 'completed' || status === 'failed';
}

function countAgentsByWorkflowId(
  agents: ObservatoryRuntimeAgentSource[],
  runs: RunSessionSummary[]
) {
  const counts = new Map<string, number>();

  if (runs.length === 0) {
    return counts;
  }

  agents.forEach((_, index) => {
    const run = runs[index % runs.length];
    const workflowId = run?.workflowId ?? (run ? `workflow:${run.id}` : 'workflow:ambient');
    counts.set(workflowId, (counts.get(workflowId) ?? 0) + 1);
  });

  return counts;
}

function assignWorkflowRooms(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  runs: RunSessionSummary[]
) {
  const assignments = new Map<
    string,
    ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number]
  >();
  const availableRooms = [...map.rooms].sort(compareWorkflowRoomPriority);
  const sortedRuns = [...runs].sort(compareRuntimeRunPriority);

  sortedRuns.forEach((run, index) => {
    const workflowId = run.workflowId ?? `workflow:${run.id}`;
    if (assignments.has(workflowId)) {
      return;
    }

    const room = pickWorkflowRoomForRun(run, availableRooms, new Set(assignments.values()), index);
    if (room) {
      room.runtime = {
        behavior: mapRunToAgentBehavior(run),
        description: `Workflow ${workflowId} team room. Select the room to inspect assigned agents.`,
        runId: run.id,
        workflowId,
      };
      assignments.set(workflowId, room);
    }
  });

  return assignments;
}

function compareRuntimeRunPriority(left: RunSessionSummary, right: RunSessionSummary) {
  const priorityDelta =
    runtimeRunStatusPriority(left.status) - runtimeRunStatusPriority(right.status);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return (right.updatedAt ?? right.createdAt ?? '').localeCompare(
    left.updatedAt ?? left.createdAt ?? ''
  );
}

function runtimeRunStatusPriority(status: RunSessionSummary['status']) {
  switch (status) {
    case 'running':
      return 0;
    case 'waiting_for_approval':
      return 1;
    case 'queued':
    case 'created':
      return 2;
    case 'paused':
    case 'cancelling':
      return 3;
    case 'failed':
    case 'cancelled':
      return 4;
    case 'completed':
      return 5;
    default:
      return 6;
  }
}

function compareWorkflowRoomPriority(
  left: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number],
  right: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number]
) {
  return (
    workflowRoomKindPriority(left.kind) - workflowRoomKindPriority(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

function workflowRoomKindPriority(
  kind: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number]['kind']
) {
  if (kind === 'runtime') {
    return 0;
  }

  if (kind === 'workspace') {
    return 1;
  }

  return 2;
}

function pickWorkflowRoomForRun(
  run: RunSessionSummary,
  rooms: ObservatoryLayoutDocument['world']['maps'][number]['rooms'],
  assignedRooms: Set<ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number]>,
  index: number
) {
  const behavior = mapRunToAgentBehavior(run);
  const preferredKinds = isWorkingBehavior(behavior)
    ? ['runtime', 'workspace']
    : behavior === 'planning' || behavior === 'approval'
      ? ['workspace', 'runtime']
      : ['commons', 'workspace', 'runtime'];
  const preferredRoom = preferredKinds.flatMap((kind) =>
    rooms.filter((room) => room.kind === kind && !assignedRooms.has(room))
  )[0];

  if (preferredRoom) {
    return preferredRoom;
  }

  return rooms[index % Math.max(rooms.length, 1)];
}

function attachWorkflowRoomRuntime(
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number],
  workflowId: string,
  runtimeContext: ObservatoryRuntimeRunContext | undefined
) {
  room.runtime = {
    behavior: 'executing',
    description: `Workflow ${workflowId} team room. Select the room to inspect assigned agents and workflow logs.`,
    logs: createWorkflowLogPreview(runtimeContext),
    recentEvents: createWorkflowEventPreview(runtimeContext),
    runId: runtimeContext?.run.id,
    workflowId,
  };
}

function ensureWorkflowRoomObjects(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number],
  workflowId: string,
  workstationCount: number,
  runtimeContext: ObservatoryRuntimeRunContext | undefined
) {
  const objectPrefix = sanitizeRuntimeId(workflowId);
  const whiteboardId = `object:workflow-whiteboard-${objectPrefix}`;
  const whiteboardPosition = clampPointToRoom(
    room,
    { x: room.bounds.x + 2, y: room.bounds.y + 2 },
    { width: 2, height: 3 }
  );

  if (!map.objects.some((object) => object.id === whiteboardId)) {
    map.objects.push({
      assetId: reviewedFurnitureAssetIds.planningWhiteboard,
      blocksMovement: true,
      id: whiteboardId,
      position: whiteboardPosition,
      roomId: room.id,
      runtime: {
        behavior: 'planning',
        description: `Planning board for workflow ${workflowId}.`,
        logs: createWorkflowLogPreview(runtimeContext),
        recentEvents: createWorkflowEventPreview(runtimeContext),
        runId: runtimeContext?.run.id,
        workflowId,
      },
      size: { width: 2, height: 3 },
    });
  }

  for (let index = 0; index < workstationCount; index += 1) {
    const workstationId = `object:workflow-workstation-${objectPrefix}-${index + 1}`;
    const workstationPosition = clampPointToRoom(
      room,
      {
        x: room.bounds.x + 3 + (index % 3) * 3,
        y: room.bounds.y + 5 + Math.floor(index / 3) * 3,
      },
      { width: 2, height: 3 }
    );

    if (map.objects.some((object) => object.id === workstationId)) {
      continue;
    }

    map.objects.push({
      assetId: reviewedFurnitureAssetIds.executionComputer,
      blocksMovement: true,
      id: workstationId,
      position: workstationPosition,
      roomId: room.id,
      runtime: {
        behavior: 'executing',
        description: `Execution workstation ${index + 1} for workflow ${workflowId}.`,
        logs: createWorkflowLogPreview(runtimeContext),
        recentEvents: createWorkflowEventPreview(runtimeContext),
        runId: runtimeContext?.run.id,
        workflowId,
      },
      size: { width: 2, height: 3 },
    });

    const chairId = `object:workflow-chair-${objectPrefix}-${index + 1}`;
    const chairPosition = clampPointToRoom(
      room,
      {
        x: workstationPosition.x,
        y: workstationPosition.y + 3,
      },
      { width: 1, height: 1 }
    );

    if (!map.objects.some((object) => object.id === chairId)) {
      map.objects.push({
        assetId: reviewedFurnitureAssetIds.executionChair,
        blocksMovement: false,
        id: chairId,
        position: chairPosition,
        render: {
          depth: 24,
        },
        roomId: room.id,
        runtime: {
          behavior: 'ambient',
          description: `Seat for workstation ${index + 1} on workflow ${workflowId}.`,
          logs: createWorkflowLogPreview(runtimeContext),
          recentEvents: createWorkflowEventPreview(runtimeContext),
          runId: runtimeContext?.run.id,
          targetObjectId: workstationId,
          workflowId,
        },
        size: { width: 1, height: 1 },
      });
    }
  }
}

function clampPointToRoom(
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number],
  point: { x: number; y: number },
  size: { width: number; height: number }
) {
  return {
    x: Math.min(
      Math.max(point.x, room.bounds.x + 1),
      room.bounds.x + room.bounds.width - size.width - 1
    ),
    y: Math.min(
      Math.max(point.y, room.bounds.y + 2),
      room.bounds.y + room.bounds.height - size.height - 1
    ),
  };
}

function findWorkflowTargetObject(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  workflowId: string,
  behavior: NonNullable<
    ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
  >['behavior'],
  agentIndex: number
) {
  const desiredRoles =
    behavior === 'approval' || behavior === 'planning'
      ? new Set<ObservatoryFurnitureBehaviorRole>(['planning'])
      : new Set<ObservatoryFurnitureBehaviorRole>(['computer', 'runtime']);
  const targetBehavior =
    behavior === 'approval' || behavior === 'planning' ? 'planning' : 'executing';
  const objects = map.objects
    .filter((object) => {
      if (object.runtime?.workflowId === workflowId && object.runtime.behavior === targetBehavior) {
        return true;
      }

      return desiredRoles.has(classifyObjectBehaviorRole(object.assetId));
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return objects[agentIndex % Math.max(objects.length, 1)];
}

function pickWorkflowStagingPoint(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number],
  agentId: string,
  seed: number
) {
  const preferred = [
    {
      x: room.bounds.x + 1 + (seed % Math.max(1, room.bounds.width - 2)),
      y: room.bounds.y + room.bounds.height - 2,
    },
    { x: room.bounds.x + 1, y: room.bounds.y + 2 + (seed % Math.max(1, room.bounds.height - 3)) },
    {
      x: room.bounds.x + room.bounds.width - 2,
      y: room.bounds.y + 2 + (seed % Math.max(1, room.bounds.height - 3)),
    },
  ];

  for (const point of preferred) {
    if (isLayoutGridWalkable(map, point)) {
      return point;
    }
  }

  return pickRoomRoamPoint(map, room, agentId, seed);
}

function mapRunToAgentBehavior(
  run: RunSessionSummary
): NonNullable<
  ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
>['behavior'] {
  if (isTerminalRunStatus(run.status)) {
    return 'ambient';
  }

  if (run.status === 'waiting_for_approval') {
    return 'approval';
  }

  if (
    run.status === 'created' ||
    run.status === 'queued' ||
    run.status === 'paused' ||
    run.status === 'cancelling'
  ) {
    return 'planning';
  }

  return run.status === 'running' ? 'working' : 'ambient';
}

function mapRunToAgentStatus(
  run: RunSessionSummary
): ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['status'] {
  if (run.status === 'failed' || run.status === 'cancelled') {
    return 'error';
  }

  if (run.status === 'completed') {
    return 'complete';
  }

  if (run.status === 'waiting_for_approval' || run.status === 'paused') {
    return 'blocked';
  }

  if (run.status === 'running') {
    return 'working';
  }

  return 'idle';
}

function isWorkingBehavior(
  behavior:
    | NonNullable<
        ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
      >['behavior']
    | undefined
) {
  return behavior === 'working' || behavior === 'executing';
}

function describeRunAssignment(
  run: RunSessionSummary,
  behavior: NonNullable<
    ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
  >['behavior']
) {
  if (run.status === 'completed') {
    return `Historical completed run ${run.id}; select the room or agent to inspect captured logs.`;
  }

  if (run.status === 'failed' || run.status === 'cancelled') {
    return `Historical ${run.status} run ${run.id}; select the room or agent to inspect failure context.`;
  }

  if (isWorkingBehavior(behavior)) {
    return `Executing run ${run.id} at a workflow workstation.`;
  }

  if (behavior === 'approval') {
    return `Waiting for approval on run ${run.id}; placed at the planning board.`;
  }

  return `Planning or queued for run ${run.id}; placed at the workflow whiteboard.`;
}

function createAgentEventPreview(
  agentId: string,
  runtimeContext: ObservatoryRuntimeRunContext | undefined
) {
  return (runtimeContext?.events ?? [])
    .filter((event) => !event.agentId || event.agentId === agentId)
    .slice(-8)
    .map((event) => formatRuntimeEventPreview(event));
}

function createWorkflowEventPreview(runtimeContext: ObservatoryRuntimeRunContext | undefined) {
  return (runtimeContext?.events ?? []).slice(-12).map((event) => formatRuntimeEventPreview(event));
}

function createAgentLogPreview(
  agentId: string,
  runtimeContext: ObservatoryRuntimeRunContext | undefined
) {
  const normalizedAgentId = agentId.toLowerCase();
  const matchingLogs = (runtimeContext?.logs ?? [])
    .filter((line) => line.toLowerCase().includes(normalizedAgentId))
    .slice(-8);

  if (matchingLogs.length > 0) {
    return matchingLogs;
  }

  return (runtimeContext?.logs ?? []).slice(-5);
}

function createWorkflowLogPreview(runtimeContext: ObservatoryRuntimeRunContext | undefined) {
  return (runtimeContext?.logs ?? []).slice(-12);
}

function formatRuntimeEventPreview(event: ObservatoryRuntimeEventContext) {
  const time = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  return [time, event.message || event.eventType].filter(Boolean).join(' · ');
}

function sanitizeRuntimeId(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

function deriveRuntimeAgentPosition(
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number] | undefined,
  index: number
) {
  if (!room) {
    return { x: 2 + index * 2, y: 2 };
  }

  const usableWidth = Math.max(1, room.bounds.width - 4);
  const usableHeight = Math.max(1, room.bounds.height - 4);

  return {
    x: room.bounds.x + 2 + ((index * 2) % usableWidth),
    y: room.bounds.y + 2 + (Math.floor((index * 2) / usableWidth) % usableHeight),
  };
}

function createAmbientAgentVisualStates(
  layout: ObservatoryLayoutDocument | null,
  assetsById: Map<string, ObservatoryAssetDefinition>,
  tick: number,
  enabled: boolean,
  socialState: AmbientSocialState
): ObservatoryAgentVisualState[] {
  if (!enabled) {
    return [];
  }

  const map = layout?.world.maps[0];

  if (!map || map.agents.length === 0 || map.rooms.length === 0) {
    return [];
  }

  const movingAgentIndex = tick % map.agents.length;
  const socialPlan = updateAmbientSocialState(map, tick, socialState);

  return map.agents.map((agent, index) => {
    const runtimeState = createRuntimeAgentVisualState(map, agent, index, assetsById, tick);

    if (runtimeState) {
      return runtimeState;
    }

    const socialParticipant = socialPlan?.participantIds.has(agent.id) ?? false;
    const targetRoom = socialParticipant
      ? map.rooms.find((room) => room.id === socialPlan?.roomId)
      : pickAgentAmbientRoom(map, agent, tick + index);
    const behavior = socialParticipant
      ? 'pause'
      : pickAmbientBehaviorKind(agent.id, tick + index, Boolean(targetRoom));
    const shouldMove =
      (socialParticipant || (index === movingAgentIndex && shouldAmbientBehaviorMove(behavior))) &&
      Boolean(targetRoom);
    const interactionObject =
      targetRoom && behavior === 'object'
        ? pickAmbientInteractionObject(
            map.objects.filter((object) => object.roomId === targetRoom.id),
            agent.id,
            tick + index
          )
        : undefined;
    const ambientInteractionTargetPoint =
      !socialParticipant && shouldMove && interactionObject
        ? pickObjectAdjacentWalkablePoint(
            map,
            interactionObject,
            agent.id,
            agent.position,
            assetsById,
            tick + index
          )
        : undefined;
    const ambientRoamTargetPoint =
      !socialParticipant && shouldMove && !ambientInteractionTargetPoint && targetRoom
        ? pickRoomRoamPoint(map, targetRoom, agent.id, tick + index)
        : undefined;
    const socialChatActive =
      socialParticipant && socialPlan ? tick >= socialPlan.chatStartsAtTick : false;
    const socialParticipantIndex =
      socialParticipant && socialPlan
        ? (socialPlan.participantIndexByAgentId.get(agent.id) ?? index)
        : index;
    const socialSpeakerIndex =
      socialPlan && socialPlan.participantIds.size > 0 ? tick % socialPlan.participantIds.size : -1;
    const socialSpeechMessage =
      socialChatActive && socialPlan && socialParticipantIndex === socialSpeakerIndex
        ? pickAmbientSocialMessage(
            socialPlan.kind,
            socialParticipantIndex,
            socialPlan.participantIds.size,
            tick,
            targetRoom
          )
        : undefined;
    const ambientInteractionSpeechMessage =
      !socialParticipant &&
      interactionObject &&
      shouldMove &&
      shouldAmbientInteractionSpeak(interactionObject, targetRoom, tick + index)
        ? pickAmbientInteractionMessage(interactionObject, targetRoom, tick + index)
        : undefined;
    const speechMessage = socialSpeechMessage ?? ambientInteractionSpeechMessage;
    const speechTone =
      socialSpeechMessage && targetRoom
        ? pickAmbientChatSpeechTone(targetRoom)
        : ambientInteractionSpeechMessage && interactionObject
          ? pickAmbientInteractionSpeechTone(interactionObject)
          : undefined;
    const action = socialParticipant
      ? 'idle'
      : pickAmbientActionForBehavior(behavior, interactionObject, tick + index);
    const targetPoint =
      socialPlan?.targetPointByAgentId.get(agent.id) ??
      ambientInteractionTargetPoint ??
      ambientRoamTargetPoint;

    return {
      action,
      agentId: agent.id,
      direction:
        socialPlan?.directionByAgentId.get(agent.id) ??
        (ambientInteractionTargetPoint && interactionObject
          ? pickDirectionBetweenPoints(ambientInteractionTargetPoint, interactionObject.position)
          : targetPoint
            ? pickDirectionBetweenPoints(
                targetPoint,
                socialPlan?.centerPoint ?? ambientInteractionTargetPoint ?? targetPoint
              )
            : pickAmbientDirection(tick + index)),
      movementKey: shouldMove
        ? socialPlan?.participantIds.has(agent.id)
          ? `ambient-chat:${socialPlan.id}:${agent.id}`
          : ambientInteractionTargetPoint && interactionObject
            ? `ambient-object:${agent.id}:${interactionObject.id}:${ambientInteractionTargetPoint.x}:${ambientInteractionTargetPoint.y}:${tick}`
            : ambientRoamTargetPoint
              ? `ambient-roam:${agent.id}:${targetRoom?.id}:${ambientRoamTargetPoint.x}:${ambientRoamTargetPoint.y}:${tick}`
              : `ambient:${agent.id}:${targetRoom?.id}:${tick}`
        : undefined,
      speechDurationMs: socialSpeechMessage
        ? 8_000
        : ambientInteractionSpeechMessage
          ? 5_500
          : undefined,
      speechGroupKey: socialChatActive && socialPlan ? socialPlan.id : undefined,
      speechKey:
        socialChatActive && socialPlan
          ? `${socialPlan.id}:${agent.id}:${tick}`
          : ambientInteractionSpeechMessage && interactionObject
            ? `ambient-object:${interactionObject.id}:${agent.id}:${tick}`
            : undefined,
      speechMessage,
      speechTone,
      status: 'idle',
      targetPoint,
      targetRoomId: shouldMove && !targetPoint ? targetRoom?.id : undefined,
    };
  });
}

interface AmbientSocialState {
  activePlan: AmbientSocialPlan | null;
  lastEnqueueTick: number;
  lastPollTick: number;
  queuedAgentIds: string[];
}

interface AmbientSocialPlan {
  chatStartsAtTick: number;
  centerPoint: { x: number; y: number };
  directionByAgentId: Map<string, ObservatoryAgentVisualState['direction']>;
  expiresAtTick: number;
  id: string;
  kind: 'group' | 'pair';
  participantIndexByAgentId: Map<string, number>;
  participantIds: Set<string>;
  roomId: string;
  targetPointByAgentId: Map<string, { x: number; y: number }>;
}

function createAmbientSocialState(): AmbientSocialState {
  return {
    activePlan: null,
    lastEnqueueTick: -1,
    lastPollTick: -1,
    queuedAgentIds: [],
  };
}

function createRuntimeAgentVisualState(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  agent: ObservatoryLayoutDocument['world']['maps'][number]['agents'][number],
  index: number,
  assetsById: Map<string, ObservatoryAssetDefinition>,
  tick: number
): ObservatoryAgentVisualState | null {
  const runtime = agent.runtime;
  const behavior = runtime?.behavior;

  if (!runtime || !behavior || behavior === 'ambient') {
    return null;
  }

  const targetObject = runtime.targetObjectId
    ? map.objects.find((object) => object.id === runtime.targetObjectId)
    : undefined;
  const workingSeat = isWorkingBehavior(behavior)
    ? findWorkflowSeatForTargetObject(map, targetObject, runtime.workflowId)
    : undefined;
  const targetPoint = workingSeat
    ? { ...workingSeat.position }
    : targetObject
      ? (pickObjectAdjacentWalkablePoint(
          map,
          targetObject,
          agent.id,
          agent.position,
          assetsById,
          index + tick
        ) ?? agent.position)
      : agent.position;
  const action = pickInteractionAction(targetObject, behavior, tick + index);
  const speechMessage = pickRuntimeAgentSpeechMessage(map, agent, behavior, tick + index);
  const speechTone = pickRuntimeAgentSpeechTone(behavior, targetObject);

  return {
    action: isWorkingBehavior(behavior) ? 'sit' : action,
    agentId: agent.id,
    attention: behavior === 'approval' ? 'approval' : 'thinking',
    direction: isWorkingBehavior(behavior)
      ? 'right'
      : pickDirectionBetweenPoints(agent.position, targetPoint),
    movementKey: isWorkingBehavior(behavior)
      ? `runtime-working:${agent.id}:${runtime.runId ?? 'run'}:${targetPoint.x}:${targetPoint.y}`
      : `runtime:${agent.id}:${runtime.runId ?? 'run'}:${targetPoint.x}:${targetPoint.y}:${tick}`,
    speechDurationMs: speechMessage ? 5_600 : undefined,
    speechKey: speechMessage
      ? `runtime-chat:${agent.id}:${runtime.runId ?? runtime.workflowId ?? 'run'}:${tick}`
      : undefined,
    speechMessage,
    speechTone,
    status: agent.status,
    targetPoint,
    targetRoomId: agent.roomId,
    taskTitle: isWorkingBehavior(behavior) ? 'Working at computer' : 'Planning workflow',
  };
}

function enrichRuntimeAgentVisualStateWithChatter(
  map: ObservatoryLayoutDocument['world']['maps'][number] | undefined,
  agentState: ObservatoryAgentVisualState,
  seed: number
): ObservatoryAgentVisualState {
  if (agentState.speechMessage || !map) {
    return agentState;
  }

  const layoutAgent = map.agents.find((agent) => agent.id === agentState.agentId);
  const behavior = layoutAgent?.runtime?.behavior;

  if (!layoutAgent || !behavior || behavior === 'ambient') {
    return agentState;
  }

  const targetObject = layoutAgent.runtime?.targetObjectId
    ? map.objects.find((object) => object.id === layoutAgent.runtime?.targetObjectId)
    : undefined;
  const speechMessage = pickRuntimeAgentSpeechMessage(map, layoutAgent, behavior, seed);

  if (!speechMessage) {
    return agentState;
  }

  return {
    ...agentState,
    speechDurationMs: 5_600,
    speechKey: `runtime-chat:${layoutAgent.id}:${layoutAgent.runtime?.runId ?? layoutAgent.runtime?.workflowId ?? 'run'}:${seed}`,
    speechMessage,
    speechTone: pickRuntimeAgentSpeechTone(behavior, targetObject),
  };
}

function pickRuntimeAgentSpeechMessage(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  agent: ObservatoryLayoutDocument['world']['maps'][number]['agents'][number],
  behavior: NonNullable<
    ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
  >['behavior'],
  seed: number
) {
  const runtime = agent.runtime;

  if (!runtime || behavior === 'ambient') {
    return undefined;
  }

  if (seed % 3 !== 0) {
    return undefined;
  }

  const runtimeLine = pickRuntimeMetadataSpeechLine(runtime, seed);
  if (runtimeLine) {
    return runtimeLine;
  }

  const workflowPeerCount =
    runtime.workflowId && map.agents.length > 1
      ? map.agents.filter((candidate) => candidate.runtime?.workflowId === runtime.workflowId)
          .length
      : 0;
  const messages =
    behavior === 'approval'
      ? [
          'Waiting on approval.',
          'Need a decision here.',
          'Approval gate is next.',
          'Can someone review this?',
        ]
      : behavior === 'planning'
        ? [
            'Scope check.',
            'Planning the next node.',
            'Let us keep it small.',
            'I am lining up the steps.',
          ]
        : workflowPeerCount > 1
          ? [
              'Quick sync on this run.',
              'I can take the next step.',
              'Any blockers?',
              'Checking the handoff.',
              'Run state looks steady.',
              'I am watching the logs.',
            ]
          : [
              'Working through the run.',
              'Checking the logs.',
              'Next task is queued.',
              'Keeping the run moving.',
            ];

  return messages[(hashString(`${agent.id}:${behavior}:${seed}`) + seed) % messages.length];
}

function pickRuntimeMetadataSpeechLine(
  runtime: NonNullable<
    ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
  >,
  seed: number
) {
  const sourceLines = [...(runtime.logs ?? []), ...(runtime.recentEvents ?? [])]
    .map(cleanRuntimeSpeechLine)
    .filter((line): line is string => Boolean(line));

  if (sourceLines.length === 0) {
    return undefined;
  }

  return sourceLines[
    (hashString(`${runtime.runId ?? runtime.workflowId ?? 'runtime'}:${seed}`) + seed) %
      sourceLines.length
  ];
}

function cleanRuntimeSpeechLine(line: string) {
  const withoutTimestamp = line
    .replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[·-]\s*/i, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();
  const normalized = withoutTimestamp || line.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > 72 ? `${normalized.slice(0, 71)}...` : normalized;
}

function pickRuntimeAgentSpeechTone(
  behavior: NonNullable<
    ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
  >['behavior'],
  targetObject: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number] | undefined
): ObservatoryAgentVisualState['speechTone'] {
  if (behavior === 'planning' || behavior === 'approval') {
    return 'planning';
  }

  if (targetObject && classifyObjectBehaviorRole(targetObject.assetId) === 'runtime') {
    return 'runtime';
  }

  return isWorkingBehavior(behavior) ? 'computer' : 'chat';
}

function findWorkflowSeatForTargetObject(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  targetObject: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number] | undefined,
  workflowId: string | undefined
) {
  if (!targetObject || !workflowId) {
    return undefined;
  }

  return map.objects.find(
    (object) =>
      object.runtime?.workflowId === workflowId &&
      object.runtime?.targetObjectId === targetObject.id &&
      classifyObjectBehaviorRole(object.assetId) === 'seating'
  );
}

function pickAgentAmbientRoom(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  agent: ObservatoryLayoutDocument['world']['maps'][number]['agents'][number],
  seed: number
) {
  const currentRoom = agent.roomId
    ? map.rooms.find((candidate) => candidate.id === agent.roomId)
    : undefined;
  const ambientRooms = map.rooms.filter((room) => !room.runtime?.workflowId);

  if (currentRoom && !currentRoom.runtime?.workflowId && seed % 4 !== 0) {
    return currentRoom;
  }

  return (
    ambientRooms[(hashString(`${agent.id}:${seed}`) + seed) % ambientRooms.length] ?? currentRoom
  );
}

function pickAmbientBehaviorKind(
  agentId: string,
  seed: number,
  hasTargetRoom: boolean
): ObservatoryAmbientBehaviorKind {
  if (!hasTargetRoom) {
    return 'pause';
  }

  const roll = hashString(`ambient-behavior:${agentId}:${seed}`) % 100;

  if (roll < 24) {
    return 'pause';
  }

  if (roll < 40) {
    return 'look';
  }

  if (roll < 52) {
    return 'read';
  }

  if (roll < 76) {
    return 'roam';
  }

  return 'object';
}

function shouldAmbientBehaviorMove(behavior: ObservatoryAmbientBehaviorKind) {
  return behavior === 'object' || behavior === 'roam';
}

function shouldAmbientInteractionSpeak(
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number],
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number] | undefined,
  seed: number
) {
  const context = classifyAmbientRoomContext(room);
  const kind = classifyAmbientInteractionKind(object);
  const baseChance =
    context === 'pantry' || context === 'planning'
      ? 38
      : context === 'runtimeLab' || context === 'warRoom'
        ? 32
        : 26;
  const objectBonus = kind === 'plant' || kind === 'surface' ? -10 : kind === 'whiteboard' ? 8 : 0;
  const chance = Math.max(12, Math.min(48, baseChance + objectBonus));
  return hashString(`ambient-speech:${object.id}:${seed}`) % 100 < chance;
}

function pickAmbientActionForBehavior(
  behavior: ObservatoryAmbientBehaviorKind,
  interactionObject:
    | ObservatoryLayoutDocument['world']['maps'][number]['objects'][number]
    | undefined,
  seed: number
): ObservatoryAgentVisualState['action'] {
  if (behavior === 'object') {
    return pickInteractionAction(interactionObject, 'ambient', seed);
  }

  if (behavior === 'read') {
    return 'reading';
  }

  if (behavior === 'look') {
    return seed % 4 === 0 ? 'phone' : 'idle';
  }

  return 'idle';
}

function updateAmbientSocialState(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  tick: number,
  state: AmbientSocialState
): AmbientSocialPlan | null {
  const socialAgents = map.agents.filter(
    (agent) => agent.status === 'idle' && (!agent.runtime || agent.runtime.behavior === 'ambient')
  );
  const socialAgentIds = new Set(socialAgents.map((agent) => agent.id));

  if (socialAgents.length < 2) {
    state.activePlan = null;
    state.queuedAgentIds = [];
    return null;
  }

  state.queuedAgentIds = state.queuedAgentIds.filter((agentId) => socialAgentIds.has(agentId));

  if (state.activePlan && tick <= state.activePlan.expiresAtTick) {
    return state.activePlan;
  }

  state.activePlan = null;

  if (tick > 0 && tick - state.lastEnqueueTick >= 2) {
    const nextQueuedAgent = pickAmbientChatQueueCandidate(socialAgents, state.queuedAgentIds, tick);

    if (nextQueuedAgent) {
      state.queuedAgentIds.push(nextQueuedAgent.id);
      state.lastEnqueueTick = tick;
    }
  }

  if (tick <= 0 || tick - state.lastPollTick < 2 || state.queuedAgentIds.length < 2) {
    return null;
  }

  state.lastPollTick = tick;
  const participantCount = pickAmbientChatParticipantCount(state.queuedAgentIds.length, tick);
  const participantIds = state.queuedAgentIds.slice(0, participantCount);
  state.queuedAgentIds = state.queuedAgentIds.slice(participantCount);
  const participants = participantIds
    .map((agentId) => socialAgents.find((agent) => agent.id === agentId))
    .filter(
      (agent): agent is ObservatoryLayoutDocument['world']['maps'][number]['agents'][number] =>
        Boolean(agent)
    );

  if (participants.length < 2) {
    return null;
  }

  state.activePlan = createAmbientSocialPlanForParticipants(
    map,
    participants,
    tick,
    participants.length > 2 ? 'group' : 'pair'
  );
  return state.activePlan;
}

function pickAmbientChatQueueCandidate(
  agents: ObservatoryLayoutDocument['world']['maps'][number]['agents'],
  queuedAgentIds: string[],
  tick: number
) {
  const queued = new Set(queuedAgentIds);
  const candidates = agents.filter((agent) => !queued.has(agent.id));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (left, right) =>
      hashString(`chat-queue:${tick}:${left.id}`) - hashString(`chat-queue:${tick}:${right.id}`) ||
      left.id.localeCompare(right.id)
  )[0];
}

function pickAmbientChatParticipantCount(queuedCount: number, tick: number) {
  if (queuedCount >= 4 && tick % 3 === 0) {
    return 4;
  }

  if (queuedCount >= 3 && tick % 2 === 0) {
    return 3;
  }

  return 2;
}

function createAmbientSocialPlanForParticipants(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  participants: ObservatoryLayoutDocument['world']['maps'][number]['agents'],
  tick: number,
  kind: AmbientSocialPlan['kind']
): AmbientSocialPlan | null {
  const room = pickAmbientSocialRoom(map, participants, tick, kind);

  if (!room) {
    return null;
  }

  const formation = pickAmbientSocialFormation(map, room, participants.length, tick);

  if (!formation) {
    return null;
  }

  const { centerPoint } = formation;
  const targetPointByAgentId = new Map(
    participants.map((agent, index) => [agent.id, formation.targetPoints[index] ?? centerPoint])
  );
  const chatStartsAtTick = tick + 3;

  return {
    chatStartsAtTick,
    centerPoint,
    directionByAgentId: new Map(
      participants.map((agent) => [
        agent.id,
        pickDirectionBetweenPoints(targetPointByAgentId.get(agent.id) ?? centerPoint, centerPoint),
      ])
    ),
    expiresAtTick: chatStartsAtTick + 5,
    id: `${kind}:${tick}:${participants.map((agent) => agent.id).join(':')}`,
    kind,
    participantIndexByAgentId: new Map(participants.map((agent, index) => [agent.id, index])),
    participantIds: new Set(participants.map((agent) => agent.id)),
    roomId: room.id,
    targetPointByAgentId,
  };
}

function pickAmbientSocialRoom(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  participants: ObservatoryLayoutDocument['world']['maps'][number]['agents'],
  tick: number,
  kind: AmbientSocialPlan['kind']
) {
  const participantRoomIds = new Set(participants.map((agent) => agent.roomId).filter(Boolean));
  const candidateRooms = map.rooms
    .filter((room) => !room.runtime?.workflowId)
    .filter((room) => kind === 'pair' || room.bounds.width * room.bounds.height >= 35)
    .sort((left, right) => {
      const leftCurrent = participantRoomIds.has(left.id) ? 0 : 1;
      const rightCurrent = participantRoomIds.has(right.id) ? 0 : 1;
      const leftKindPriority = left.kind === 'commons' ? 0 : left.kind === 'workspace' ? 1 : 2;
      const rightKindPriority = right.kind === 'commons' ? 0 : right.kind === 'workspace' ? 1 : 2;

      return (
        leftCurrent - rightCurrent ||
        leftKindPriority - rightKindPriority ||
        hashString(`${tick}:${left.id}`) - hashString(`${tick}:${right.id}`) ||
        left.id.localeCompare(right.id)
      );
    });

  return candidateRooms[0] ?? map.rooms[0];
}

function pickAmbientSocialFormation(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number],
  participantCount: number,
  seed: number
) {
  const interior = observatoryRoomInteriorBounds(room);
  const preferred = {
    x: Math.round((interior.minX + interior.maxX) / 2),
    y: Math.round((interior.minY + interior.maxY) / 2),
  };

  const centerCandidates = createAmbientSocialCenterCandidates(interior, preferred, seed);
  const offsetSets = createAmbientSocialFormationOffsetSets(participantCount, seed);

  for (const centerPoint of centerCandidates) {
    if (!isLayoutGridWalkable(map, centerPoint)) {
      continue;
    }

    for (const offsets of offsetSets) {
      const targetPoints = offsets.map((offset) => ({
        x: centerPoint.x + offset.x,
        y: centerPoint.y + offset.y,
      }));

      if (
        targetPoints.every(
          (point) =>
            point.x >= interior.minX &&
            point.x <= interior.maxX &&
            point.y >= interior.minY &&
            point.y <= interior.maxY &&
            isLayoutGridWalkable(map, point)
        )
      ) {
        return { centerPoint, targetPoints };
      }
    }
  }

  return null;
}

function createAmbientSocialCenterCandidates(
  interior: ReturnType<typeof observatoryRoomInteriorBounds>,
  preferred: { x: number; y: number },
  seed: number
) {
  const candidates: Array<{ x: number; y: number }> = [];

  for (let y = interior.minY; y <= interior.maxY; y += 1) {
    for (let x = interior.minX; x <= interior.maxX; x += 1) {
      candidates.push({ x, y });
    }
  }

  return candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.x - preferred.x) + Math.abs(left.y - preferred.y);
    const rightDistance = Math.abs(right.x - preferred.x) + Math.abs(right.y - preferred.y);

    return (
      leftDistance - rightDistance ||
      hashString(`${seed}:${left.x}:${left.y}`) - hashString(`${seed}:${right.x}:${right.y}`)
    );
  });
}

function createAmbientSocialFormationOffsetSets(participantCount: number, seed: number) {
  const pairHorizontal = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  const pairVertical = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];
  const cardinal = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];
  const groupTriangle = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
  ];

  if (participantCount <= 2) {
    return seed % 2 === 0 ? [pairHorizontal, pairVertical] : [pairVertical, pairHorizontal];
  }

  if (participantCount === 3) {
    return [
      groupTriangle,
      [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    ];
  }

  return [cardinal];
}

function pickAmbientSocialMessage(
  kind: AmbientSocialPlan['kind'],
  index: number,
  total: number,
  seed: number,
  room?: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number]
) {
  const roomMessages = pickAmbientChatRoomMessages(room);
  const pairMessages = [
    'Quick sync?',
    'I have an idea.',
    'That looks right.',
    'Let me check.',
    'Could use your take.',
    'What do you think?',
    'Good point.',
    'I can follow up.',
    'Tiny update.',
    'One concern.',
    'That unblocks me.',
    'Let us keep it small.',
  ];
  const groupMessages = [
    `Standup ${index + 1}/${total}`,
    'What changed?',
    'Next step?',
    'Looks good.',
    'I can take that.',
    'Any blockers?',
    'Let us split it.',
    'Who owns this?',
    'Ship the small part.',
    'Park the risky bit.',
    'Align on scope.',
    'Call the dependency.',
    'Watch the handoff.',
  ];
  const messages = [...roomMessages, ...(kind === 'group' ? groupMessages : pairMessages)];
  return messages[(seed + index) % messages.length];
}

function pickAmbientChatRoomMessages(
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number] | undefined
) {
  const messagesByContext: Record<ObservatoryAmbientRoomContext, string[]> = {
    commonWork: ['Desk sync.', 'Compare the run.', 'Work area check.', 'One queue item.'],
    connector: ['Passing note.', 'Quick hallway sync.', 'On my way.', 'Route is clear.'],
    corridor: ['Corridor sync.', 'Keep it brief.', 'Passing update.', 'Next room?'],
    executive: ['Decision point.', 'Executive check.', 'Escalate this?', 'One crisp option.'],
    generic: ['Small sync.', 'Need a second look.', 'I saw the same.', 'Let us decide.'],
    meeting: ['Meeting note.', 'Agenda item?', 'Decision needed.', 'Action owner?'],
    pantry: ['Coffee sync?', 'Refill first.', 'Pantry vote?', 'Short break sync.'],
    planning: ['Board says no.', 'Move the sticky.', 'Scope it here.', 'Mark the risk.'],
    reception: ['Front desk note.', 'Visitor status?', 'Welcome flow OK.', 'Check the queue.'],
    runtimeLab: ['Logs are quiet.', 'Check the run.', 'Queue looks clear.', 'Trace it once.'],
    smallMeeting: ['Tight agenda.', 'Small room sync.', 'Two points max.', 'Decision first.'],
    warRoom: ['Incident view.', 'Watch the graph.', 'Triage this.', 'Keep the channel clear.'],
  };

  return messagesByContext[classifyAmbientRoomContext(room)];
}

function pickAmbientChatSpeechTone(
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number]
): ObservatoryAgentVisualState['speechTone'] {
  const context = classifyAmbientRoomContext(room);

  if (context === 'pantry') {
    return 'pantry';
  }

  if (context === 'planning' || context === 'meeting' || context === 'smallMeeting') {
    return 'planning';
  }

  if (context === 'runtimeLab' || context === 'warRoom') {
    return 'runtime';
  }

  return 'chat';
}

function pickAmbientInteractionMessage(
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number],
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number] | undefined,
  seed: number
) {
  const kind = classifyAmbientInteractionKind(object);
  const context = classifyAmbientRoomContext(room);
  const messages = pickAmbientInteractionMessageSet(kind, context, object);
  const suffix = seed % 6 === 0 ? pickAmbientInteractionRoomSuffix(context) : '';
  return `${messages[(hashString(`${object.id}:${seed}`) + seed) % messages.length]}${suffix}`;
}

function pickAmbientInteractionMessageSet(
  kind: ObservatoryAmbientInteractionKind,
  context: ObservatoryAmbientRoomContext,
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number]
) {
  const objectText = object.id.toLowerCase();
  const specificMessages = pickSpecificAmbientObjectMessages(objectText);

  if (specificMessages.length > 0) {
    return specificMessages;
  }

  const messagesByContextAndKind: Partial<
    Record<
      ObservatoryAmbientRoomContext,
      Partial<Record<ObservatoryAmbientInteractionKind, string[]>>
    >
  > = {
    commonWork: {
      books: ['Reference for desk 3.', 'Old note, useful.', 'Bookmark the handoff.'],
      chair: ['Phone break.', 'Seat check.', 'Scrolling a note.'],
      computer: ['Desk queue clear.', 'Local run looks good.', 'Terminal is quiet.'],
      plant: ['Work area plant OK.', 'Tiny desk reset.', 'Plant break.'],
      surface: ['Clearing the workstation.', 'Desk is staged.', 'Leaving the handoff note.'],
      tv: ['Shared metric steady.', 'Team board looks normal.', 'Wall monitor is calm.'],
      whiteboard: ['Common plan updated.', 'Team board says wait.', 'Move the shared sticky.'],
    },
    connector: {
      plant: ['Connector plant check.', 'This corner is calm.', 'Green marker here.'],
      books: ['Cabinet check.', 'Connector storage OK.', 'Found the spare note.'],
      surface: ['Passing table clear.', 'No blocker here.', 'Drop point is empty.'],
    },
    corridor: {
      surface: ['Corridor drop clear.', 'No handoff note.', 'Passing update.'],
      tv: ['Hall display steady.', 'Route board OK.', 'No alert here.'],
    },
    executive: {
      computer: ['Executive console ready.', 'Decision view is open.', 'High-level run clean.'],
      plant: ['Executive plant OK.', 'Room reset complete.', 'Quiet corner.'],
      server: ['Private rack stable.', 'No tower alert.', 'Server status green.'],
      whiteboard: ['Decision map updated.', 'Exec risk noted.', 'Option B needs proof.'],
    },
    meeting: {
      chair: ['Waiting for the room.', 'Phone on silent.', 'Seat taken.'],
      computer: ['Meeting screen ready.', 'Shared deck is open.', 'Table console awake.'],
      plant: ['Room reset done.', 'Plant is fine.', 'Meeting room looks ready.'],
      whiteboard: ['Agenda on board.', 'Action owner marked.', 'Decision box drawn.'],
    },
    pantry: {
      chair: ['Break seat.', 'Scrolling while waiting.', 'Short rest.'],
      coffee: ['Coffee loop steady.', 'Fresh pot soon.', 'Caffeine check.'],
      cup: ['Cup stock OK.', 'Clean cup found.', 'Condiments topped.'],
      fridge: ['Fridge check.', 'Snack audit done.', 'Cold storage OK.'],
      surface: ['Counter is clear.', 'Pantry counter reset.', 'Crumbs handled.'],
      water: ['Cooler looks full.', 'Water break.', 'Refill complete.'],
    },
    planning: {
      books: ['Looking up the plan.', 'Old note helps.', 'Reference found.'],
      chair: ['Reviewing notes.', 'Planning pause.', 'Phone note saved.'],
      surface: ['Planning table ready.', 'Sticky notes staged.', 'Agenda pad clear.'],
      tv: ['Studio display ready.', 'Preview screen steady.', 'Screen framing OK.'],
      whiteboard: ['Sketching the plan.', 'Risk goes here.', 'Plan looks cleaner.'],
    },
    reception: {
      books: ['Visitor note found.', 'Front desk log checked.', 'Reception reference ready.'],
      chair: ['Lobby seat ready.', 'Waiting room check.', 'Phone on quiet.'],
      plant: ['Reception plant OK.', 'Lobby reset done.', 'Front corner tidy.'],
      surface: ['Front desk clear.', 'Visitor card ready.', 'Reception queue checked.'],
    },
    runtimeLab: {
      computer: ['Trace window open.', 'Runtime screen clean.', 'One more trace.'],
      server: ['Runtime node OK.', 'Rack temperature normal.', 'Server hums clean.'],
      books: ['Spare cable found.', 'Lab cabinet OK.', 'Tool shelf reset.'],
      surface: ['Bench tools ready.', 'Lab bench clear.', 'Probe staged.'],
      tv: ['Run dashboard calm.', 'Control screens steady.', 'No red tiles.'],
    },
    smallMeeting: {
      chair: ['Seat for one.', 'Waiting on one person.', 'Phone note open.'],
      computer: ['Small-room screen ready.', 'Laptop shared.', 'Local notes open.'],
      whiteboard: ['Two bullets max.', 'Decision first.', 'Small board updated.'],
    },
    warRoom: {
      computer: ['War desk online.', 'Printer queue clear.', 'Incident pane open.'],
      server: ['War server stable.', 'Runtime node green.', 'No rack alert.'],
      surface: ['Podium ready.', 'Briefing point set.', 'War table staged.'],
      tv: ['Incident board steady.', 'Watch the spike.', 'Dashboard has no red.'],
    },
  };
  const messagesByKind: Record<ObservatoryAmbientInteractionKind, string[]> = {
    books: ['Looking up a note.', 'Found the reference.', 'Bookmark this.', 'Old docs still help.'],
    chair: ['Taking a seat.', 'Checking phone.', 'Short pause.', 'Scrolling notes.'],
    coffee: ['Coffee loop steady.', 'One more coffee.', 'Caffeine check.', 'Fresh pot soon.'],
    computer: ['Checking the queue.', 'Logs look quiet.', 'One more trace.', 'The run is clean.'],
    cup: ['Cup inventory fine.', 'Need a clean cup.', 'Tiny refill.', 'Pantry stock OK.'],
    fridge: ['Fridge check.', 'Cold storage OK.', 'Who labeled this?', 'Snack audit done.'],
    plant: [
      'Plant looks fine.',
      'Needs a little water.',
      'Green status good.',
      'Desk plant check.',
    ],
    server: ['Server hums clean.', 'Runtime node OK.', 'No heat spike.', 'Rack looks stable.'],
    surface: ['Clearing the desk.', 'Table is ready.', 'Leaving a note.', 'Staging the next task.'],
    tv: ['Dashboard is calm.', 'Screen looks normal.', 'Metric is steady.', 'Watching the board.'],
    water: ['Hydration check.', 'Water break.', 'Refill complete.', 'Cooler looks full.'],
    whiteboard: [
      'Sketching the plan.',
      'Moving the sticky.',
      'Risk goes here.',
      'Plan looks cleaner.',
    ],
  };

  return messagesByContextAndKind[context]?.[kind] ?? messagesByKind[kind];
}

function pickSpecificAmbientObjectMessages(objectText: string) {
  if (/globe/.test(objectText)) {
    return ['Route map checked.', 'Global view helps.', 'Spin once, decide.'];
  }

  if (/studio-screen/.test(objectText)) {
    return ['Studio feed ready.', 'Frame looks clean.', 'Preview monitor OK.'];
  }

  if (/podium/.test(objectText)) {
    return ['Briefing point ready.', 'Podium mic checked.', 'Lead with the risk.'];
  }

  if (/cart/.test(objectText)) {
    return ['Cart parked.', 'Supplies moved.', 'Pantry cart OK.'];
  }

  if (/phone/.test(objectText)) {
    return ['Desk phone idle.', 'No missed calls.', 'Line is clear.'];
  }

  return [];
}

function pickAmbientInteractionRoomSuffix(context: ObservatoryAmbientRoomContext) {
  const suffixes: Partial<Record<ObservatoryAmbientRoomContext, string>> = {
    commonWork: ' Work area.',
    executive: ' Exec room.',
    meeting: ' Meeting room.',
    pantry: ' Pantry.',
    planning: ' Planning room.',
    reception: ' Reception.',
    runtimeLab: ' Runtime lab.',
    smallMeeting: ' Small room.',
    warRoom: ' War room.',
  };

  return suffixes[context] ?? '';
}

function pickAmbientInteractionSpeechTone(
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number]
): ObservatoryAgentVisualState['speechTone'] {
  const kind = classifyAmbientInteractionKind(object);

  if (kind === 'computer' || kind === 'tv') {
    return 'computer';
  }

  if (kind === 'server') {
    return 'runtime';
  }

  if (kind === 'whiteboard') {
    return 'planning';
  }

  if (kind === 'books' || kind === 'chair' || kind === 'surface') {
    return 'storage';
  }

  return 'pantry';
}

function pickAmbientInteractionObject(
  roomObjects: ObservatoryLayoutDocument['world']['maps'][number]['objects'],
  agentId: string,
  seed: number
) {
  const weightedObjects = roomObjects
    .filter((object) => isAmbientObjectRole(classifyObjectBehaviorRole(object.assetId)))
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((object) =>
      Array.from({ length: getAmbientInteractionObjectWeight(object) }, () => object)
    );

  return weightedObjects[
    (hashString(`${agentId}:${seed}`) + seed) % Math.max(weightedObjects.length, 1)
  ];
}

function getAmbientInteractionObjectWeight(
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number]
) {
  const kind = classifyAmbientInteractionKind(object);

  if (kind === 'whiteboard') {
    return 5;
  }

  if (kind === 'computer' || kind === 'tv') {
    return 4;
  }

  if (kind === 'chair') {
    return 3;
  }

  if (kind === 'server' || kind === 'coffee' || kind === 'water') {
    return 2;
  }

  return 1;
}

function pickObjectAdjacentWalkablePoint(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number],
  agentId: string,
  fromPoint?: { x: number; y: number } | number,
  assetsById?: Map<string, ObservatoryAssetDefinition>,
  seed?: number
) {
  const resolvedFromPoint =
    typeof fromPoint === 'number' || fromPoint === undefined ? undefined : fromPoint;
  const resolvedSeed = typeof fromPoint === 'number' ? fromPoint : (seed ?? object.id);

  return pickObservatoryObjectAdjacentWalkablePoint(map, object, {
    assetsById,
    fromPoint: resolvedFromPoint,
    seed: `${agentId}:${object.id}:${resolvedSeed}`,
  });
}

function pickRoomRoamPoint(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number],
  agentId: string,
  seed: number
) {
  const { minX, maxX, minY, maxY } = observatoryRoomInteriorBounds(room);
  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const start = hashString(`${agentId}:${seed}`) % (width * height);

  for (let offset = 0; offset < width * height; offset += 1) {
    const cursor = (start + offset) % (width * height);
    const candidate = {
      x: minX + (cursor % width),
      y: minY + Math.floor(cursor / width),
    };

    if (isLayoutGridWalkable(map, candidate)) {
      return candidate;
    }
  }

  return { x: minX, y: minY };
}

function isLayoutGridWalkable(
  map: ObservatoryLayoutDocument['world']['maps'][number],
  point: { x: number; y: number }
) {
  return isObservatoryGridWalkable(map, point);
}

function pickInteractionAction(
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number] | undefined,
  behavior: NonNullable<
    ObservatoryLayoutDocument['world']['maps'][number]['agents'][number]['runtime']
  >['behavior'],
  seed: number
): ObservatoryAgentVisualState['action'] {
  const role = object ? classifyObjectBehaviorRole(object.assetId) : 'unknown';

  if (behavior === 'planning' || behavior === 'approval' || role === 'planning') {
    const planningActions: NonNullable<ObservatoryAgentVisualState['action']>[] = [
      'reading',
      'phone',
      'idle',
    ];
    return planningActions[seed % planningActions.length];
  }

  if (isWorkingBehavior(behavior) || role === 'computer' || role === 'runtime') {
    const workActions: NonNullable<ObservatoryAgentVisualState['action']>[] = [
      'sit',
      'phone',
      'reading',
    ];
    return workActions[seed % workActions.length];
  }

  if (role === 'seating') {
    const seatingActions: NonNullable<ObservatoryAgentVisualState['action']>[] = [
      'phone',
      'phone',
      'sit',
      'reading',
      'idle',
    ];
    return seatingActions[seed % seatingActions.length];
  }

  if (role === 'pantry') {
    const pantryActions: NonNullable<ObservatoryAgentVisualState['action']>[] = ['idle', 'phone'];
    return pantryActions[seed % pantryActions.length];
  }

  if (role === 'storage' || role === 'surface') {
    const inspectActions: NonNullable<ObservatoryAgentVisualState['action']>[] = [
      'reading',
      'idle',
    ];
    return inspectActions[seed % inspectActions.length];
  }

  return seed % 3 === 0 ? 'phone' : 'idle';
}

function classifyObjectBehaviorRole(assetId: string): ObservatoryFurnitureBehaviorRole {
  const normalized = assetId.toLowerCase();

  if (/(coffee|water|pantry|bottle|fridge|kitchen)/.test(normalized)) {
    return 'pantry';
  }

  if (/(whiteboard|chalkboard|planning|bulletin|board)/.test(normalized)) {
    return 'planning';
  }

  if (/(runtime-server|server|rack)/.test(normalized)) {
    return 'runtime';
  }

  if (
    /(runtime-screens|screen|monitor|workstation|computer|laptop|keyboard|mouse)/.test(normalized)
  ) {
    return 'computer';
  }

  if (/(chair|sofa|seat|bench)/.test(normalized)) {
    return 'seating';
  }

  if (/(book|cabinet|shelf|storage)/.test(normalized)) {
    return 'storage';
  }

  if (/(table|desk|podium|lectern)/.test(normalized)) {
    return 'surface';
  }

  return 'unknown';
}

function classifyAmbientRoomContext(
  room: ObservatoryLayoutDocument['world']['maps'][number]['rooms'][number] | undefined
): ObservatoryAmbientRoomContext {
  const text = `${room?.id ?? ''} ${room?.name ?? ''} ${room?.kind ?? ''}`.toLowerCase();

  if (!room) {
    return 'generic';
  }

  if (/reception/.test(text)) {
    return 'reception';
  }

  if (/(pantry|coffee|kitchen)/.test(text)) {
    return 'pantry';
  }

  if (/(war room|war-|runtime war)/.test(text)) {
    return 'warRoom';
  }

  if (/(runtime lab|lab|ops|server)/.test(text)) {
    return 'runtimeLab';
  }

  if (/(executive)/.test(text)) {
    return 'executive';
  }

  if (/(planning|lounge)/.test(text)) {
    return 'planning';
  }

  if (/(small meeting|small-)/.test(text)) {
    return 'smallMeeting';
  }

  if (/(meeting|medium)/.test(text)) {
    return 'meeting';
  }

  if (/(common work|work area|workspace)/.test(text)) {
    return 'commonWork';
  }

  if (/(corridor)/.test(text)) {
    return 'corridor';
  }

  if (/(connector)/.test(text)) {
    return 'connector';
  }

  return 'generic';
}

function classifyAmbientInteractionKind(
  object: ObservatoryLayoutDocument['world']['maps'][number]['objects'][number]
): ObservatoryAmbientInteractionKind {
  const text = `${object.id} ${object.assetId}`.toLowerCase();

  if (/(chair|sofa|seat|bench)/.test(text)) {
    return 'chair';
  }

  if (/(whiteboard|chalkboard|planning|bulletin|chart|wall-map)/.test(text)) {
    return 'whiteboard';
  }

  if (/(water-cooler|water|cooler)/.test(text)) {
    return 'water';
  }

  if (/(coffee|espresso|tea)/.test(text)) {
    return 'coffee';
  }

  if (/(cup|mug|condiment|jar)/.test(text)) {
    return 'cup';
  }

  if (/(fridge|refrigerator)/.test(text)) {
    return 'fridge';
  }

  if (/(server-rack|runtime-server|server|rack)/.test(text)) {
    return 'server';
  }

  if (/(tv|television|projector|wall-monitor|screen|dashboard)/.test(text)) {
    return 'tv';
  }

  if (
    /(workstation|workbench|computer|laptop|monitor|terminal|keyboard|mouse|printer)/.test(text)
  ) {
    return 'computer';
  }

  if (/(bookshelf|bookcase|book|library|shelf)/.test(text)) {
    return 'books';
  }

  if (/(plant|potted)/.test(text)) {
    return 'plant';
  }

  return 'surface';
}

function isAmbientObjectRole(role: ObservatoryFurnitureBehaviorRole) {
  return (
    role === 'pantry' ||
    role === 'planning' ||
    role === 'computer' ||
    role === 'runtime' ||
    role === 'seating' ||
    role === 'storage' ||
    role === 'surface'
  );
}

function pickAmbientDirection(seed: number): ObservatoryAgentVisualState['direction'] {
  const directions: NonNullable<ObservatoryAgentVisualState['direction']>[] = [
    'down',
    'right',
    'up',
    'left',
  ];
  return directions[seed % directions.length];
}

function pickDirectionBetweenPoints(
  from: { x: number; y: number },
  to: { x: number; y: number }
): ObservatoryAgentVisualState['direction'] {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'down' : 'up';
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function createRepoPublishedLayout(): ObservatoryLayoutDocument {
  const validation = validateObservatoryLayout(repoPublishedLayout);

  if (!validation.layout) {
    throw new Error('Observatory repo published layout is invalid.');
  }

  return cloneObservatoryLayout(validation.layout);
}
