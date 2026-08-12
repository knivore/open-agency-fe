'use client';

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BaseEdge,
  type Connection,
  ConnectionMode,
  Controls,
  type EdgeChange,
  EdgeLabelRenderer,
  type EdgeProps,
  type FitViewOptions,
  getBezierPath,
  getSmoothStepPath,
  Handle,
  MiniMap,
  type NodeChange,
  type NodeProps,
  type OnSelectionChangeFunc,
  Position,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
  ViewportPortal,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { applyRuntimeEventsToGraphDocument } from './runtime';
import type {
  GraphDocument,
  GraphEdge,
  GraphId,
  GraphNode,
  GraphPaletteItem,
  GraphRuntimeEvent,
  GraphSelection,
  GraphToolbarAction,
  GraphValidationIssue,
} from './types';
import {
  graphDocumentToXyflow,
  graphEdgeToXyflowEdge,
  graphNodeToXyflowNode,
  xyflowEdgeToGraphEdge,
  type XyflowGraphEdge,
  type XyflowGraphNode,
  type XyflowGraphNodeData,
  xyflowNodeToGraphNode,
} from './xyflowAdapter';
import { createGraphEdgeId } from './ids';
import { layoutGraphDocumentGrid, type LayoutGraphDocumentGridOptions } from './layout';
import { stringifyGraphDocument } from './persistence';
import { downloadGraphDocumentJson } from './export';
import { agencyColors, graphStateColors } from '../design/colors';

export const graphBuiltInToolbarActionIds = {
  addNode: 'graph.addNode',
  autoLayout: 'graph.autoLayout',
  fitView: 'graph.fitView',
  focusSelection: 'graph.focusSelection',
  undo: 'graph.undo',
  redo: 'graph.redo',
  export: 'graph.export',
  import: 'graph.import',
} as const;

const emptyGraphValidationIssues: GraphValidationIssue[] = [];
const emptyGraphKeyboardShortcuts: GraphKeyboardShortcut[] = [];
const runtimePlaybackSpeeds = [0.5, 1, 2] as const;

function minimapNodeColor(node: XyflowGraphNode) {
  const graphNodeType = node.data?.graphNode?.type ?? node.type ?? '';

  if (graphNodeType.includes('agent')) {
    return agencyColors.violet;
  }
  if (graphNodeType.includes('task')) {
    return agencyColors.violetBright;
  }
  if (graphNodeType.includes('tool')) {
    return agencyColors.violet;
  }
  if (graphNodeType.includes('approval')) {
    return agencyColors.violetBright;
  }
  if (graphNodeType.includes('memory')) {
    return agencyColors.violetSoft;
  }
  if (graphNodeType.includes('artifact')) {
    return agencyColors.graphiteMuted;
  }

  return agencyColors.graphiteMuted;
}

function minimapNodeStrokeColor(node: XyflowGraphNode) {
  return node.selected ? agencyColors.violet : agencyColors.graphite;
}

function mergeClassNames(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(' ');
}

function runtimeNodeClassName(status: string | undefined) {
  if (status === 'running') {
    return 'border-(--agent-running) ring-2 ring-(--activity-subtle) animate-pulse';
  }

  if (status === 'queued') {
    return 'border-primary-300 ring-2 ring-primary-100 animate-pulse';
  }

  if (status === 'waiting') {
    return 'border-warning-400 ring-2 ring-warning-100 animate-pulse';
  }

  if (status === 'succeeded' || status === 'completed') {
    return 'border-success-300 ring-2 ring-success-100';
  }

  if (status === 'failed' || status === 'blocked') {
    return 'border-destructive-400 ring-2 ring-destructive-100';
  }

  if (status === 'skipped') {
    return 'border-neutral-300 ring-2 ring-neutral-100 opacity-75';
  }

  return 'border-neutral-200';
}

function runtimeEdgeClassName(status: string | undefined) {
  if (status === 'running' || status === 'transmitting' || status === 'queued') {
    return 'graph-runtime-edge-flow';
  }

  if (status === 'waiting' || status === 'blocked') {
    return 'graph-runtime-edge-paused';
  }

  if (status === 'failed') {
    return 'graph-runtime-edge-failed';
  }

  return undefined;
}

function runtimeEdgeCompletedClassName(status: string | undefined) {
  if (status === 'succeeded' || status === 'completed') {
    return 'graph-runtime-edge-completed';
  }

  return undefined;
}

function runtimeEdgeIsTransientStatus(status: string | undefined) {
  return (
    status === 'running' ||
    status === 'transmitting' ||
    status === 'queued' ||
    status === 'waiting' ||
    status === 'blocked'
  );
}

function runtimeEdgeHasPacket(status: string | undefined) {
  return status === 'running' || status === 'transmitting' || status === 'queued';
}

function runtimeEdgeActivityKind(
  event: GraphRuntimeEvent | undefined,
  edge: GraphEdge | undefined
) {
  const eventType = event?.type.replace(/_/g, '.').toLowerCase() ?? '';
  const projectedRole = event?.metadata?.projectedRole;

  if (event?.payload?.error !== undefined || event?.status === 'failed') {
    return 'error';
  }

  if (eventType.startsWith('approval.') || projectedRole === 'approvalGate') {
    return 'approval';
  }

  if (
    eventType.startsWith('tool.') ||
    projectedRole === 'toolEdge' ||
    edge?.type.includes('tool')
  ) {
    return 'tool';
  }

  if (eventType.startsWith('assignment.') || projectedRole === 'assignmentEdge') {
    return 'assignment';
  }

  if (
    eventType.startsWith('dependency.') ||
    projectedRole === 'dependencyEdge' ||
    projectedRole === 'downstreamEdge'
  ) {
    return 'dependency';
  }

  if (event?.payload?.artifactId !== undefined || event?.payload?.artifact_id !== undefined) {
    return 'artifact';
  }

  if (event?.payload?.output !== undefined || event?.payload?.result !== undefined) {
    return 'output';
  }

  if (edge?.type.includes('memory')) {
    return 'memory';
  }

  if (edge?.type.includes('condition')) {
    return 'condition';
  }

  if (edge?.type.includes('data')) {
    return 'data-flow';
  }

  return 'status';
}

function runtimeEdgeActivityClassName(
  event: GraphRuntimeEvent | undefined,
  edge: GraphEdge | undefined
) {
  return `graph-runtime-edge-${runtimeEdgeActivityKind(event, edge)}`;
}

function graphEdgeHasPacket(edge: GraphEdge | undefined) {
  return edge?.style?.custom?.animated === true;
}

function runtimeEdgePacketClassName(
  status: string | undefined,
  event: GraphRuntimeEvent | undefined,
  edge: GraphEdge | undefined
) {
  const activityClassName = runtimeEdgeActivityClassName(event, edge);

  if (status === 'queued') {
    return `graph-runtime-edge-packet graph-runtime-edge-packet-queued ${activityClassName}`;
  }

  if (status === 'running' || status === 'transmitting') {
    return `graph-runtime-edge-packet graph-runtime-edge-packet-active ${activityClassName}`;
  }

  return `graph-runtime-edge-packet ${activityClassName}`;
}

function graphEdgePacketClassName(edge: GraphEdge | undefined) {
  return edge?.style?.custom?.packetClassName === 'muted'
    ? 'graph-edge-packet graph-edge-packet-muted'
    : 'graph-edge-packet';
}

function runtimeEdgeStyle(status: string | undefined) {
  if (status === 'running' || status === 'transmitting' || status === 'queued') {
    return {
      stroke: graphStateColors.running,
      strokeWidth: 2.5,
    };
  }

  if (status === 'waiting' || status === 'blocked') {
    return {
      stroke: graphStateColors.warning,
      strokeWidth: 2,
    };
  }

  if (status === 'succeeded' || status === 'completed') {
    return {
      stroke: graphStateColors.completed,
      strokeWidth: 2,
    };
  }

  if (status === 'failed') {
    return {
      stroke: graphStateColors.failed,
      strokeWidth: 2,
    };
  }

  return {};
}

function summarizePayloadValue(key: string, value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${key}: ${String(value)}`;
  }

  if (value && typeof value === 'object') {
    try {
      const serializedValue = JSON.stringify(value);
      return `${key}: ${
        serializedValue.length > 96 ? `${serializedValue.slice(0, 93)}...` : serializedValue
      }`;
    } catch {
      return `${key}: [object]`;
    }
  }

  return null;
}

function runtimePayloadSummary(event: GraphRuntimeEvent) {
  const payload = event.payload ?? {};
  const preferredKeys = [
    'message',
    'summary',
    'error',
    'input',
    'output',
    'result',
    'data',
    'artifactId',
    'runId',
    'taskId',
    'agentId',
    'triggerType',
    'reason',
  ];
  const preferredEntry = preferredKeys
    .map((key) => [key, payload[key]] as const)
    .find(([, value]) => value !== undefined && value !== null);

  if (preferredEntry) {
    const [key, value] = preferredEntry;
    return summarizePayloadValue(key, value);
  }

  const firstEntry = Object.entries(payload).find(
    ([, value]) => value !== undefined && value !== null
  );

  if (!firstEntry) {
    return null;
  }

  const [key, value] = firstEntry;
  return summarizePayloadValue(key, value);
}

function clampRuntimeEventCursor(cursor: number, eventCount: number) {
  return Math.max(0, Math.min(cursor, eventCount));
}

function formatRuntimeEventJson(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function runtimeEventTargetLabel(event: GraphRuntimeEvent) {
  if (event.nodeId && event.edgeId) {
    return `${event.nodeId} / ${event.edgeId}`;
  }

  return event.nodeId ?? event.edgeId ?? event.graphId ?? null;
}

function runtimeEventStringValue(event: GraphRuntimeEvent, key: string) {
  const metadataValue = event.metadata?.[key];
  const payloadValue = event.payload?.[key];

  if (typeof metadataValue === 'string') {
    return metadataValue;
  }

  if (typeof payloadValue === 'string') {
    return payloadValue;
  }

  return null;
}

function runtimeEventNumberValue(event: GraphRuntimeEvent, keys: string[]) {
  for (const key of keys) {
    const metadataValue = event.metadata?.[key];
    const payloadValue = event.payload?.[key];

    if (typeof metadataValue === 'number') {
      return metadataValue;
    }

    if (typeof payloadValue === 'number') {
      return payloadValue;
    }
  }

  return null;
}

function formatRuntimeDuration(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 1 : 2)} s`;
  }

  return `${value} ms`;
}

function graphMotionDuration(duration: number) {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : duration;
}

function runtimeEventTimingRows(event: GraphRuntimeEvent) {
  const durationMs = runtimeEventNumberValue(event, ['durationMs', 'duration_ms', 'duration']);
  const latencyMs = runtimeEventNumberValue(event, ['latencyMs', 'latency_ms', 'latency']);
  const elapsedMs = runtimeEventNumberValue(event, ['elapsedMs', 'elapsed_ms']);
  const startedAt =
    runtimeEventStringValue(event, 'startedAt') ?? runtimeEventStringValue(event, 'started_at');
  const completedAt =
    runtimeEventStringValue(event, 'completedAt') ?? runtimeEventStringValue(event, 'completed_at');

  return [
    durationMs !== null ? { label: 'Duration', value: formatRuntimeDuration(durationMs) } : null,
    latencyMs !== null ? { label: 'Latency', value: formatRuntimeDuration(latencyMs) } : null,
    elapsedMs !== null ? { label: 'Elapsed', value: formatRuntimeDuration(elapsedMs) } : null,
    startedAt ? { label: 'Started', value: startedAt } : null,
    completedAt ? { label: 'Completed', value: completedAt } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
}

function runtimePanelPositionClassName(position: GraphRuntimePanelPosition | undefined) {
  if (position === 'top-left') {
    return 'left-3 top-3';
  }

  if (position === 'bottom-left') {
    return 'bottom-20 left-3';
  }

  if (position === 'bottom-right') {
    return 'bottom-20 right-3';
  }

  return 'right-3 top-3';
}

function runtimePanelMaxHeightClassName(compact: boolean) {
  return compact ? 'h-56 max-h-56' : 'h-[calc(100%-8rem)] max-h-[calc(100%-8rem)]';
}

export type GraphBuiltInToolbarActionId =
  (typeof graphBuiltInToolbarActionIds)[keyof typeof graphBuiltInToolbarActionIds];

export const graphBuiltInToolbarActions: Record<GraphBuiltInToolbarActionId, GraphToolbarAction> = {
  [graphBuiltInToolbarActionIds.addNode]: {
    id: graphBuiltInToolbarActionIds.addNode,
    label: 'Add Node',
    description: 'Add the first available palette node.',
  },
  [graphBuiltInToolbarActionIds.autoLayout]: {
    id: graphBuiltInToolbarActionIds.autoLayout,
    label: 'Auto Layout',
    description: 'Reflow nodes and save the new graph positions.',
  },
  [graphBuiltInToolbarActionIds.fitView]: {
    id: graphBuiltInToolbarActionIds.fitView,
    label: 'Fit View',
    description: 'Fit the graph into the current viewport.',
  },
  [graphBuiltInToolbarActionIds.focusSelection]: {
    id: graphBuiltInToolbarActionIds.focusSelection,
    label: 'Focus Selected',
    description: 'Fit the selected node or edge and its connected relationships.',
  },
  [graphBuiltInToolbarActionIds.undo]: {
    id: graphBuiltInToolbarActionIds.undo,
    label: 'Undo',
    description: 'Undo the previous graph edit.',
  },
  [graphBuiltInToolbarActionIds.redo]: {
    id: graphBuiltInToolbarActionIds.redo,
    label: 'Redo',
    description: 'Redo the previous graph edit.',
  },
  [graphBuiltInToolbarActionIds.export]: {
    id: graphBuiltInToolbarActionIds.export,
    label: 'Export',
    description: 'Export the graph document JSON.',
  },
  [graphBuiltInToolbarActionIds.import]: {
    id: graphBuiltInToolbarActionIds.import,
    label: 'Import',
    description: 'Import a graph document from the host project.',
  },
};

export function isGraphBuiltInToolbarActionId(id: string): id is GraphBuiltInToolbarActionId {
  return id in graphBuiltInToolbarActions;
}

export interface GraphKeyboardShortcut {
  id: GraphId;
  actionId: GraphId;
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description?: string;
  disabled?: boolean;
  preventDefault?: boolean;
}

export const defaultGraphKeyboardShortcuts: GraphKeyboardShortcut[] = [
  {
    id: 'graph.shortcut.undo.meta',
    actionId: graphBuiltInToolbarActionIds.undo,
    key: 'z',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: true,
  },
  {
    id: 'graph.shortcut.undo.ctrl',
    actionId: graphBuiltInToolbarActionIds.undo,
    key: 'z',
    metaKey: false,
    ctrlKey: true,
    shiftKey: false,
    altKey: false,
    preventDefault: true,
  },
  {
    id: 'graph.shortcut.redo.meta',
    actionId: graphBuiltInToolbarActionIds.redo,
    key: 'z',
    metaKey: true,
    ctrlKey: false,
    shiftKey: true,
    altKey: false,
    preventDefault: true,
  },
  {
    id: 'graph.shortcut.redo.ctrl',
    actionId: graphBuiltInToolbarActionIds.redo,
    key: 'z',
    metaKey: false,
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    preventDefault: true,
  },
  {
    id: 'graph.shortcut.redo.ctrl-y',
    actionId: graphBuiltInToolbarActionIds.redo,
    key: 'y',
    metaKey: false,
    ctrlKey: true,
    shiftKey: false,
    altKey: false,
    preventDefault: true,
  },
  {
    id: 'graph.shortcut.fit-view',
    actionId: graphBuiltInToolbarActionIds.fitView,
    key: '0',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: true,
  },
];

export interface GraphNodeRendererProps {
  node: GraphNode;
  selected: boolean;
  readOnly: boolean;
  runtimeEvent?: GraphRuntimeEvent;
  runtimeEventIsCurrent?: boolean;
  validationIssues: GraphValidationIssue[];
  onRemove?: () => void;
}

export interface GraphEdgeLabelRendererProps {
  edge: GraphEdge;
  selected: boolean;
  validationIssues: GraphValidationIssue[];
  onOpen: () => void;
}

export interface GraphInspectorRendererProps {
  node?: GraphNode;
  edge?: GraphEdge;
  document: GraphDocument;
  readOnly: boolean;
  onClose: () => void;
  onUpdateDocument: (document: GraphDocument) => void;
  onUpdateNode: (node: GraphNode) => void;
  onUpdateEdge: (edge: GraphEdge) => void;
}

export type GraphNodeRenderer = (props: GraphNodeRendererProps) => ReactNode;

export type GraphEdgeLabelRenderer = (props: GraphEdgeLabelRendererProps) => ReactNode;

export type GraphInspectorRenderer = (props: GraphInspectorRendererProps) => ReactNode;

export interface GraphPaletteRendererProps {
  items: GraphPaletteItem[];
  onAddNode: (item: GraphPaletteItem) => void;
}

export interface GraphToolbarRendererProps {
  actions: GraphToolbarAction[];
  onAction: (action: GraphToolbarAction) => void;
}

export interface GraphRuntimeEventRendererProps {
  event: GraphRuntimeEvent;
  isCurrent?: boolean;
  onClick?: (event: GraphRuntimeEvent) => void;
}

export type GraphConnectResult = GraphDocument | GraphEdge | false | void;

export type GraphPaletteRenderer = (props: GraphPaletteRendererProps) => ReactNode;

export type GraphToolbarRenderer = (props: GraphToolbarRendererProps) => ReactNode;

export type GraphRuntimeEventRenderer = (props: GraphRuntimeEventRendererProps) => ReactNode;

export type GraphRuntimePanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface GraphCanvasBaseProps {
  className?: string;
  readOnly?: boolean;
  fitView?: boolean;
  showBackground?: boolean;
  showControls?: boolean;
  showMiniMap?: boolean;
  showInspector?: boolean;
  focusNodeId?: GraphId | null;
  focusNodeRevision?: number;
  loading?: boolean;
  emptyContent?: ReactNode;
  loadingContent?: ReactNode;
  invalidContent?: ReactNode;
  readOnlyContent?: ReactNode;
  validationIssues?: GraphValidationIssue[];
  runtimeEvents?: GraphRuntimeEvent[];
  runtimeEventLimit?: number;
  runtimePanelPosition?: GraphRuntimePanelPosition;
  layoutOptions?: LayoutGraphDocumentGridOptions;
  edgeRouting?: 'bezier' | 'smooth-step';
  canvasBackdrop?: ReactNode;
  toolbarPlacement?: 'overlay' | 'docked';
  fitViewOptions?: FitViewOptions<XyflowGraphNode>;
  nodeRenderers?: Record<string, GraphNodeRenderer>;
  edgeLabelRenderers?: Record<string, GraphEdgeLabelRenderer>;
  nodeInspectors?: Record<string, GraphInspectorRenderer>;
  edgeInspectors?: Record<string, GraphInspectorRenderer>;
  paletteItems?: GraphPaletteItem[];
  toolbarActions?: GraphToolbarAction[];
  builtInToolbarActions?: boolean | GraphBuiltInToolbarActionId[];
  keyboardShortcuts?: boolean | GraphKeyboardShortcut[];
  renderNode?: GraphNodeRenderer;
  renderEdgeLabel?: GraphEdgeLabelRenderer;
  renderInspector?: GraphInspectorRenderer;
  renderPalette?: GraphPaletteRenderer;
  renderToolbar?: GraphToolbarRenderer;
  renderRuntimeEvent?: GraphRuntimeEventRenderer;
  getRuntimeEventRunHref?: (event: GraphRuntimeEvent) => string | null;
  onGraphChange?: (document: GraphDocument) => void;
  onSelectionChange?: (selection: GraphSelection) => void;
  onNodeOpen?: (node: GraphNode) => void;
  onEdgeOpen?: (edge: GraphEdge) => void;
  onRemoveNode?: (node: GraphNode, document: GraphDocument) => GraphDocument | false | void;
  onConnect?: (edge: GraphEdge, document: GraphDocument) => GraphConnectResult;
  onAddNode?: (item: GraphPaletteItem) => GraphNode | void;
  onToolbarAction?: (action: GraphToolbarAction, document: GraphDocument) => GraphDocument | void;
  onExportGraph?: (document: GraphDocument, json: string) => void;
  onImportGraph?: (document: GraphDocument) => GraphDocument | void;
  onRuntimeEventClick?: (event: GraphRuntimeEvent) => void;
}

export type GraphCanvasProps =
  | (GraphCanvasBaseProps & {
      document: GraphDocument;
      defaultDocument?: never;
    })
  | (GraphCanvasBaseProps & {
      document?: never;
      defaultDocument: GraphDocument;
    });

type CanvasNodeData = XyflowGraphNodeData & {
  renderNode?: GraphNodeRenderer;
  readOnly?: boolean;
  onRemove?: () => void;
  runtimeEvent?: GraphRuntimeEvent;
  runtimeEventIsCurrent?: boolean;
  validationIssues?: GraphValidationIssue[];
};

type CanvasNode = XyflowGraphNode & {
  data: CanvasNodeData;
};

type CanvasEdgeData = NonNullable<XyflowGraphEdge['data']> & {
  edgeRouting?: 'bezier' | 'smooth-step';
  renderEdgeLabel?: GraphEdgeLabelRenderer;
  hovered?: boolean;
  runtimeEvent?: GraphRuntimeEvent;
  runtimeEventIsCurrent?: boolean;
  runtimeStatus?: string | null;
  validationIssues?: GraphValidationIssue[];
  onOpen?: () => void;
};

function DefaultGraphNode({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.graphNode;
  const validationIssues = data.validationIssues ?? [];
  const runtimeEvent = data.runtimeEvent;
  const runtimeEventIsCurrent = data.runtimeEventIsCurrent ?? false;
  const renderedNode = data.renderNode?.({
    node,
    selected,
    runtimeEvent,
    runtimeEventIsCurrent,
    validationIssues,
    readOnly: data.readOnly ?? false,
    onRemove: data.onRemove,
  });
  const inputPorts = node.ports?.filter((port) => port.direction !== 'output') ?? [];
  const outputPorts = node.ports?.filter((port) => port.direction !== 'input') ?? [];

  if (renderedNode) {
    return renderedNode;
  }

  return (
    <div
      className={`min-w-48 rounded-md border bg-white px-3 py-2 text-sm shadow-sm ${
        selected
          ? 'border-sky-500 ring-2 ring-sky-100'
          : validationIssues.length > 0
            ? 'border-red-300 ring-2 ring-red-100'
            : runtimeNodeClassName(node.status)
      }`}
    >
      {inputPorts.length > 0 || node.ports?.length === 0 ? (
        <Handle type="target" position={Position.Left} />
      ) : null}
      <div className="font-medium text-neutral-900">{data.label}</div>
      {data.description ? (
        <div className="mt-1 line-clamp-2 text-xs text-neutral-500">{data.description}</div>
      ) : null}
      {runtimeEvent ? (
        <div
          className={`mt-2 rounded-md border px-2 py-1 text-[11px] ${
            runtimeEventIsCurrent
              ? 'border-sky-300 bg-sky-50 text-sky-900'
              : 'border-neutral-200 bg-neutral-50 text-neutral-600'
          }`}
        >
          <div className="truncate font-medium">{runtimeEvent.type}</div>
          {runtimePayloadSummary(runtimeEvent) ? (
            <div className="truncate">{runtimePayloadSummary(runtimeEvent)}</div>
          ) : null}
        </div>
      ) : null}
      {outputPorts.length > 0 || node.ports?.length === 0 ? (
        <Handle type="source" position={Position.Right} />
      ) : null}
    </div>
  );
}

const defaultNodeTypes = {
  graphNode: DefaultGraphNode,
  default: DefaultGraphNode,
};

function DefaultGraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  label,
  interactionWidth,
  data,
}: EdgeProps<XyflowGraphEdge>) {
  const edgeData = data as CanvasEdgeData | undefined;
  const pathArguments = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };
  const [edgePath, labelX, labelY] =
    edgeData?.edgeRouting === 'smooth-step'
      ? getSmoothStepPath({
          ...pathArguments,
          borderRadius: 14,
          offset: 28,
          stepPosition: 0.5,
        })
      : getBezierPath(pathArguments);
  const graphEdge = edgeData?.graphEdge;
  const runtimeEvent = edgeData?.runtimeEvent;
  const runtimeEventIsCurrent = edgeData?.runtimeEventIsCurrent ?? false;
  const runtimeStatus =
    edgeData && 'runtimeStatus' in edgeData
      ? (edgeData.runtimeStatus ?? undefined)
      : graphEdge?.status;
  const runtimeActivityKind = runtimeEdgeActivityKind(runtimeEvent, graphEdge);
  const runtimePayload = runtimeEvent ? runtimePayloadSummary(runtimeEvent) : null;
  const runtimeLabel = runtimePayload ?? runtimeEvent?.type ?? null;
  const validationIssues = edgeData?.validationIssues ?? [];
  const focused = Boolean(selected) || Boolean(edgeData?.hovered);
  const resolvedStyle = selected
    ? {
        ...style,
        strokeWidth: Math.max(typeof style?.strokeWidth === 'number' ? style.strokeWidth : 1, 3),
      }
    : style;
  const renderedLabel =
    graphEdge && edgeData?.renderEdgeLabel
      ? edgeData.renderEdgeLabel({
          edge: graphEdge,
          selected: focused,
          validationIssues,
          onOpen: edgeData.onOpen ?? (() => undefined),
        })
      : label;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={selected ? 'react-flow__edge-path-selected' : undefined}
        style={resolvedStyle}
        interactionWidth={interactionWidth}
      />
      {runtimeEdgeHasPacket(runtimeStatus) || graphEdgeHasPacket(graphEdge) ? (
        <g
          className={
            runtimeEdgeHasPacket(runtimeStatus)
              ? runtimeEdgePacketClassName(runtimeStatus, runtimeEvent, graphEdge)
              : graphEdgePacketClassName(graphEdge)
          }
        >
          <animateMotion dur="1.2s" repeatCount="indefinite" path={edgePath} />
          {runtimeActivityKind === 'tool' ? (
            <path d="M0 -5 L5 0 L0 5 L-5 0 Z" />
          ) : runtimeActivityKind === 'memory' ? (
            <rect x="-4" y="-4" width="8" height="8" rx="1.5" />
          ) : runtimeActivityKind === 'error' ? (
            <>
              <circle r="4.5" />
              <path d="M-2.2 -2.2 L2.2 2.2 M2.2 -2.2 L-2.2 2.2" />
            </>
          ) : runtimeActivityKind === 'dependency' || runtimeActivityKind === 'output' ? (
            <path d="M-4 -4 L5 0 L-4 4 Z" />
          ) : runtimeActivityKind === 'approval' ? (
            <path d="M0 -5 L4 -3.2 L3.2 2.2 L0 5 L-3.2 2.2 L-4 -3.2 Z" />
          ) : (
            <circle r={runtimeEdgeHasPacket(runtimeStatus) ? '4' : '3.5'} />
          )}
        </g>
      ) : null}
      {renderedLabel ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              pointerEvents: 'all',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {renderedLabel}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {runtimeLabel ? (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan graph-runtime-edge-payload pointer-events-none absolute max-w-56 -translate-x-1/2 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm ${
              runtimeEventIsCurrent
                ? 'border-sky-400 bg-sky-50 text-sky-900 ring-2 ring-sky-100'
                : 'border-sky-200 bg-white/95 text-sky-800'
            }`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 30}px)`,
            }}
          >
            <span className="block truncate">{runtimeLabel}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const defaultEdgeTypes = {
  graphEdge: DefaultGraphEdge,
  default: DefaultGraphEdge,
};

function DefaultPalette({ items, onAddNode }: GraphPaletteRendererProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-[min(520px,calc(100%-1.5rem))] flex-wrap gap-2 rounded-md border border-neutral-200 bg-white p-2 shadow-sm">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="rounded-md border border-neutral-200 px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:border-sky-300 hover:bg-sky-50"
          onClick={() => onAddNode(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function DefaultToolbar({ actions, onAction }: GraphToolbarRendererProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-neutral-200 bg-white p-2 shadow-sm">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={action.disabled}
          title={action.description}
          className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onAction(action)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function DefaultRuntimeEvent({
  event,
  isCurrent = false,
  onClick,
}: GraphRuntimeEventRendererProps) {
  const payloadSummary = runtimePayloadSummary(event);
  const eventContent = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-neutral-800">{event.type}</span>
        {event.status ? (
          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
            {event.status}
          </span>
        ) : null}
      </div>
      {payloadSummary ? (
        <div className="mt-0.5 truncate text-[11px] text-neutral-500">{payloadSummary}</div>
      ) : null}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-current={isCurrent ? 'step' : undefined}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-neutral-100 ${
          isCurrent ? 'border border-sky-200 bg-sky-50 text-sky-900 shadow-sm' : ''
        }`}
        onClick={() => onClick(event)}
      >
        {eventContent}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs">{eventContent}</div>
  );
}

function createDocumentFromXyflow(
  document: GraphDocument,
  nodes: XyflowGraphNode[],
  edges: XyflowGraphEdge[]
): GraphDocument {
  const savedNodeStatusById = new Map(document.nodes.map((node) => [node.id, node.status]));
  const savedEdgeStatusById = new Map(document.edges.map((edge) => [edge.id, edge.status]));

  return {
    ...document,
    nodes: nodes.map((node) => ({
      ...xyflowNodeToGraphNode(node),
      status: savedNodeStatusById.get(node.id),
    })),
    edges: edges.map((edge) => ({
      ...xyflowEdgeToGraphEdge(edge),
      status: savedEdgeStatusById.get(edge.id),
    })),
  };
}

function toolbarActionMatches(action: GraphToolbarAction, actionId: GraphId) {
  return action.id === actionId;
}

function keyboardTargetIsEditable(target: EventTarget | null) {
  return target instanceof Element
    ? Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    : false;
}

function matchesKeyboardShortcut(event: KeyboardEvent, shortcut: GraphKeyboardShortcut) {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    (shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey) &&
    (shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey) &&
    (shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey) &&
    (shortcut.altKey === undefined || event.altKey === shortcut.altKey)
  );
}

function isPersistentNodeChange(change: NodeChange<XyflowGraphNode>) {
  if (change.type === 'position' && 'dragging' in change && change.dragging) {
    return false;
  }

  return (
    change.type === 'position' ||
    change.type === 'remove' ||
    change.type === 'add' ||
    change.type === 'replace'
  );
}

function isPersistentEdgeChange(change: EdgeChange<XyflowGraphEdge>) {
  return change.type === 'remove' || change.type === 'add' || change.type === 'replace';
}

function normalizeGraphSelection(selection: Partial<GraphSelection> | null | undefined) {
  return {
    nodeIds: selection?.nodeIds ?? [],
    edgeIds: selection?.edgeIds ?? [],
  };
}

function areGraphSelectionsEqual(
  left: Partial<GraphSelection> | null | undefined,
  right: Partial<GraphSelection> | null | undefined
) {
  const normalizedLeft = normalizeGraphSelection(left);
  const normalizedRight = normalizeGraphSelection(right);

  return (
    normalizedLeft.nodeIds.length === normalizedRight.nodeIds.length &&
    normalizedLeft.edgeIds.length === normalizedRight.edgeIds.length &&
    normalizedLeft.nodeIds.every((nodeId, index) => nodeId === normalizedRight.nodeIds[index]) &&
    normalizedLeft.edgeIds.every((edgeId, index) => edgeId === normalizedRight.edgeIds[index])
  );
}

function validationIssuesForTarget(
  issues: GraphValidationIssue[],
  target: 'node' | 'edge',
  id: GraphId
) {
  return issues.filter((issue) => issue.target === target && issue.targetId === id);
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  // React Flow stores controlled callbacks by identity; refs keep those callbacks
  // stable without letting them act on stale graph state.
  // eslint-disable-next-line react-hooks/refs
  ref.current = value;
  return ref;
}

export default function GraphCanvas({
  document,
  defaultDocument,
  className,
  readOnly = false,
  fitView = true,
  showBackground = true,
  showControls = true,
  showMiniMap = false,
  showInspector = false,
  focusNodeId = null,
  focusNodeRevision = 0,
  loading = false,
  emptyContent,
  loadingContent,
  invalidContent,
  readOnlyContent,
  validationIssues,
  runtimeEvents,
  runtimeEventLimit = 6,
  runtimePanelPosition = 'top-right',
  layoutOptions,
  edgeRouting = 'bezier',
  canvasBackdrop,
  toolbarPlacement = 'overlay',
  fitViewOptions,
  nodeRenderers,
  edgeLabelRenderers,
  nodeInspectors,
  edgeInspectors,
  paletteItems,
  toolbarActions,
  builtInToolbarActions,
  keyboardShortcuts = true,
  renderNode,
  renderEdgeLabel,
  renderInspector,
  renderPalette,
  renderToolbar,
  renderRuntimeEvent,
  getRuntimeEventRunHref,
  onGraphChange,
  onSelectionChange,
  onNodeOpen,
  onEdgeOpen,
  onRemoveNode,
  onConnect,
  onAddNode,
  onToolbarAction,
  onExportGraph,
  onImportGraph,
  onRuntimeEventClick,
}: GraphCanvasProps) {
  const [internalDocument, setInternalDocument] = useState<GraphDocument>(
    () => defaultDocument ?? document
  );
  const [history, setHistory] = useState<{ past: GraphDocument[]; future: GraphDocument[] }>({
    past: [],
    future: [],
  });
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
    XyflowGraphNode,
    XyflowGraphEdge
  > | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const activeDocument = document ?? internalDocument;
  const [selection, setSelection] = useState<GraphSelection>({ nodeIds: [], edgeIds: [] });
  const activeDocumentRef = useLatestRef(activeDocument);
  const selectionRef = useLatestRef(selection);
  const onSelectionChangeRef = useLatestRef(onSelectionChange);
  const onConnectRef = useLatestRef(onConnect);
  const onEdgeOpenRef = useLatestRef(onEdgeOpen);
  const showInspectorRef = useLatestRef(showInspector);
  const lastFocusedNodeKeyRef = useRef<string | null>(null);
  const [runtimeEventCursor, setRuntimeEventCursor] = useState<number | null>(null);
  const [runtimePlaybackActive, setRuntimePlaybackActive] = useState(false);
  const [runtimePlaybackSpeed, setRuntimePlaybackSpeed] = useState<number>(1);
  const [selectedRuntimeEventId, setSelectedRuntimeEventId] = useState<GraphId | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<GraphId | null>(null);
  const [focusedRuntimeEdgeId, setFocusedRuntimeEdgeId] = useState<GraphId | null>(null);
  const [transientNodesState, setTransientNodesState] = useState<{
    document: GraphDocument;
    nodes: CanvasNode[];
  } | null>(null);
  const visibleValidationIssues = validationIssues ?? emptyGraphValidationIssues;
  const blockingValidationIssues = visibleValidationIssues.filter(
    (issue) => issue.severity === 'error'
  );
  const runtimeEventCount = runtimeEvents?.length ?? 0;
  const activeRuntimeEventCount =
    runtimeEventCursor === null
      ? runtimeEventCount
      : clampRuntimeEventCursor(runtimeEventCursor, runtimeEventCount);
  const runtimePlaybackIsActive =
    runtimePlaybackActive && runtimeEventCount > 0 && activeRuntimeEventCount < runtimeEventCount;
  const activeRuntimeEvents = useMemo(
    () => (runtimeEvents?.length ? runtimeEvents.slice(0, activeRuntimeEventCount) : undefined),
    [activeRuntimeEventCount, runtimeEvents]
  );
  const currentReplayEvent = useMemo(
    () =>
      runtimeEventCursor !== null && activeRuntimeEventCount > 0
        ? (activeRuntimeEvents?.[activeRuntimeEventCount - 1] ?? null)
        : null,
    [activeRuntimeEventCount, activeRuntimeEvents, runtimeEventCursor]
  );
  const renderedDocument = useMemo(
    () =>
      activeRuntimeEvents?.length
        ? applyRuntimeEventsToGraphDocument(activeDocument, activeRuntimeEvents)
        : activeDocument,
    [activeDocument, activeRuntimeEvents]
  );
  useEffect(() => {
    if (!runtimePlaybackIsActive) {
      return;
    }

    const intervalId = window.setInterval(
      () => {
        setRuntimeEventCursor((currentCursor) => {
          const currentCount =
            currentCursor === null ? 0 : clampRuntimeEventCursor(currentCursor, runtimeEventCount);

          return Math.min(currentCount + 1, runtimeEventCount);
        });
      },
      Math.max(250, 1000 / runtimePlaybackSpeed)
    );

    return () => window.clearInterval(intervalId);
  }, [runtimeEventCount, runtimePlaybackIsActive, runtimePlaybackSpeed]);
  const effectiveSelectedRuntimeEventId =
    runtimePlaybackIsActive && currentReplayEvent ? currentReplayEvent.id : selectedRuntimeEventId;
  const effectiveFocusedRuntimeEdgeId =
    runtimePlaybackIsActive && currentReplayEvent
      ? (currentReplayEvent.edgeId ?? null)
      : focusedRuntimeEdgeId;
  const selectedRuntimeEvent = useMemo(
    () => activeRuntimeEvents?.find((event) => event.id === effectiveSelectedRuntimeEventId),
    [activeRuntimeEvents, effectiveSelectedRuntimeEventId]
  );
  const latestRuntimeEventByEdgeId = useMemo(() => {
    const eventByEdgeId = new Map<GraphId, GraphRuntimeEvent>();

    if (runtimeEventCursor !== null) {
      if (currentReplayEvent?.edgeId) {
        eventByEdgeId.set(currentReplayEvent.edgeId, currentReplayEvent);
      }

      return eventByEdgeId;
    }

    for (const event of activeRuntimeEvents ?? []) {
      if (event.edgeId) {
        eventByEdgeId.set(event.edgeId, event);
      }
    }

    return eventByEdgeId;
  }, [activeRuntimeEvents, currentReplayEvent, runtimeEventCursor]);
  const currentRuntimeEdgeIds = useMemo(() => {
    const edgeIds = new Set<GraphId>();

    if (runtimeEventCursor !== null) {
      if (currentReplayEvent?.edgeId && runtimeEdgeIsTransientStatus(currentReplayEvent.status)) {
        edgeIds.add(currentReplayEvent.edgeId);
      }

      return edgeIds;
    }

    const latestTimestamp = activeRuntimeEvents?.at(-1)?.timestamp;
    if (!latestTimestamp) {
      return edgeIds;
    }

    // Projection events share the source event timestamp, so this treats the latest
    // runtime event and its projected connectors as the only live transfer batch.
    for (const event of activeRuntimeEvents ?? []) {
      if (
        event.timestamp === latestTimestamp &&
        event.edgeId &&
        runtimeEdgeIsTransientStatus(event.status)
      ) {
        edgeIds.add(event.edgeId);
      }
    }

    return edgeIds;
  }, [activeRuntimeEvents, currentReplayEvent, runtimeEventCursor]);
  const latestRuntimeEventByNodeId = useMemo(() => {
    const eventByNodeId = new Map<GraphId, GraphRuntimeEvent>();

    if (runtimeEventCursor !== null) {
      if (currentReplayEvent?.nodeId) {
        eventByNodeId.set(currentReplayEvent.nodeId, currentReplayEvent);
      }

      return eventByNodeId;
    }

    for (const event of activeRuntimeEvents ?? []) {
      if (event.nodeId) {
        eventByNodeId.set(event.nodeId, event);
      }
    }

    return eventByNodeId;
  }, [activeRuntimeEvents, currentReplayEvent, runtimeEventCursor]);
  const graph = useMemo(() => graphDocumentToXyflow(renderedDocument), [renderedDocument]);
  const commitGraphDocument = useCallback(
    (nextDocument: GraphDocument, options: { recordHistory?: boolean } = {}) => {
      if (options.recordHistory ?? true) {
        setHistory((currentHistory) => ({
          past: [...currentHistory.past.slice(-49), activeDocument],
          future: [],
        }));
      }

      if (!document) {
        setInternalDocument(nextDocument);
      }
      onGraphChange?.(nextDocument);
    },
    [activeDocument, document, onGraphChange]
  );
  const commitGraphDocumentRef = useLatestRef(commitGraphDocument);
  const removeGraphNode = useCallback(
    (node: GraphNode) => {
      if (readOnly) {
        return;
      }

      const projectedDocument = onRemoveNode?.(node, activeDocument);
      if (projectedDocument === false) {
        return;
      }

      const nextDocument =
        projectedDocument && 'nodes' in projectedDocument && 'edges' in projectedDocument
          ? projectedDocument
          : {
              ...activeDocument,
              nodes: activeDocument.nodes.filter((candidate) => candidate.id !== node.id),
              edges: activeDocument.edges.filter(
                (edge) => edge.source !== node.id && edge.target !== node.id
              ),
            };

      setSelection({ nodeIds: [], edgeIds: [] });
      onSelectionChange?.({ nodeIds: [], edgeIds: [] });
      commitGraphDocument(nextDocument);
    },
    [activeDocument, commitGraphDocument, onRemoveNode, onSelectionChange, readOnly]
  );
  const openGraphEdgeData = useCallback(
    (graphEdge: GraphEdge) => {
      const nextSelection = { nodeIds: [], edgeIds: [graphEdge.id] };
      const shouldSelectEdge = showInspectorRef.current || !onEdgeOpenRef.current;

      if (shouldSelectEdge && !areGraphSelectionsEqual(selectionRef.current, nextSelection)) {
        selectionRef.current = nextSelection;
        setSelection(nextSelection);
        onSelectionChangeRef.current?.(nextSelection);
      }

      onEdgeOpenRef.current?.(graphEdge);
    },
    [onEdgeOpenRef, onSelectionChangeRef, selectionRef, showInspectorRef]
  );
  const openGraphEdgeDataRef = useLatestRef(openGraphEdgeData);
  const openGraphEdge = useCallback(
    (edge: XyflowGraphEdge) => {
      openGraphEdgeData(xyflowEdgeToGraphEdge(edge));
    },
    [openGraphEdgeData]
  );
  const selectGraphNodeData = useCallback(
    (graphNode: GraphNode) => {
      const nextSelection = { nodeIds: [graphNode.id], edgeIds: [] };

      if (areGraphSelectionsEqual(selectionRef.current, nextSelection)) {
        return;
      }

      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      onSelectionChangeRef.current?.(nextSelection);
    },
    [onSelectionChangeRef, selectionRef]
  );
  const baseNodes = useMemo<CanvasNode[]>(
    () =>
      graph.nodes.map((node) => {
        const graphNode = node.data.graphNode;
        const nodeValidationIssues = validationIssuesForTarget(
          visibleValidationIssues,
          'node',
          node.id
        );
        return {
          ...node,
          selected: selection.nodeIds.includes(node.id),
          data: {
            ...node.data,
            renderNode: nodeRenderers?.[graphNode.type] ?? renderNode,
            readOnly,
            onRemove: readOnly ? undefined : () => removeGraphNode(graphNode),
            runtimeEvent: latestRuntimeEventByNodeId.get(node.id),
            runtimeEventIsCurrent: currentReplayEvent?.nodeId === node.id,
            validationIssues: nodeValidationIssues,
          },
        };
      }),
    [
      currentReplayEvent,
      graph.nodes,
      latestRuntimeEventByNodeId,
      nodeRenderers,
      readOnly,
      renderNode,
      removeGraphNode,
      selection.nodeIds,
      visibleValidationIssues,
    ]
  );
  const transientNodes =
    transientNodesState?.document === activeDocument ? transientNodesState.nodes : null;
  const nodes = transientNodes ?? baseNodes;
  const nodesRef = useLatestRef(nodes);
  const edges = useMemo<XyflowGraphEdge[]>(
    () =>
      graph.edges.map((edge) => {
        const graphEdge = edge.data?.graphEdge ?? xyflowEdgeToGraphEdge(edge);
        const graphEdgeStatus = graphEdge?.status;
        const isCurrentRuntimeEdge = currentRuntimeEdgeIds.has(edge.id);
        const visualRuntimeStatus =
          runtimeEdgeIsTransientStatus(graphEdgeStatus) && !isCurrentRuntimeEdge
            ? undefined
            : graphEdgeStatus;
        const runtimeEvent = latestRuntimeEventByEdgeId.get(edge.id);
        const visibleRuntimeEvent =
          runtimeEdgeIsTransientStatus(runtimeEvent?.status) && !isCurrentRuntimeEdge
            ? undefined
            : runtimeEvent;
        const edgeValidationIssues = graphEdge
          ? validationIssuesForTarget(visibleValidationIssues, 'edge', edge.id)
          : [];
        const edgeLabelRenderer = graphEdge
          ? (edgeLabelRenderers?.[graphEdge.type] ?? renderEdgeLabel)
          : undefined;

        return {
          ...edge,
          selected: selection.edgeIds.includes(edge.id),
          className: mergeClassNames(
            edge.className,
            runtimeEdgeClassName(visualRuntimeStatus),
            runtimeEdgeCompletedClassName(visualRuntimeStatus),
            visualRuntimeStatus
              ? runtimeEdgeActivityClassName(visibleRuntimeEvent, graphEdge)
              : undefined,
            effectiveFocusedRuntimeEdgeId === edge.id ? 'graph-runtime-edge-focused' : undefined
          ),
          data: {
            ...edge.data,
            graphEdge,
            edgeRouting,
            renderEdgeLabel: edgeLabelRenderer,
            hovered: hoveredEdgeId === edge.id,
            runtimeEvent: visibleRuntimeEvent,
            runtimeEventIsCurrent: currentReplayEvent?.edgeId === edge.id,
            runtimeStatus: visualRuntimeStatus ?? null,
            validationIssues: edgeValidationIssues,
            onOpen: () => openGraphEdge(edge),
          },
          style:
            edgeValidationIssues.length > 0
              ? {
                  ...(edge.style ?? {}),
                  stroke: '#dc2626',
                  strokeWidth: 2,
                }
              : {
                  ...(edge.style ?? {}),
                  ...runtimeEdgeStyle(visualRuntimeStatus),
                },
        };
      }),
    [
      edgeLabelRenderers,
      edgeRouting,
      currentReplayEvent,
      currentRuntimeEdgeIds,
      effectiveFocusedRuntimeEdgeId,
      graph.edges,
      hoveredEdgeId,
      latestRuntimeEventByEdgeId,
      openGraphEdge,
      renderEdgeLabel,
      selection.edgeIds,
      visibleValidationIssues,
    ]
  );
  const edgesRef = useLatestRef(edges);

  const emitGraphChange = useCallback(
    (nextNodes: XyflowGraphNode[], nextEdges: XyflowGraphEdge[]) => {
      commitGraphDocumentRef.current(
        createDocumentFromXyflow(activeDocumentRef.current, nextNodes, nextEdges)
      );
    },
    [activeDocumentRef, commitGraphDocumentRef]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<XyflowGraphNode>[]) => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      const nextNodes = applyNodeChanges(changes, currentNodes);
      const persistentChanges = changes.filter(isPersistentNodeChange);

      if (persistentChanges.length > 0) {
        setTransientNodesState(null);
        emitGraphChange(nextNodes, currentEdges);
        return;
      }

      if (changes.some((change) => change.type === 'position')) {
        setTransientNodesState({ document: activeDocumentRef.current, nodes: nextNodes });
      }
    },
    [activeDocumentRef, edgesRef, emitGraphChange, nodesRef]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<XyflowGraphEdge>[]) => {
      const persistentChanges = changes.filter(isPersistentEdgeChange);

      if (persistentChanges.length > 0) {
        emitGraphChange(nodesRef.current, applyEdgeChanges(persistentChanges, edgesRef.current));
      }
    },
    [edgesRef, emitGraphChange, nodesRef]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }

      const graphEdge: GraphEdge = {
        id: createGraphEdgeId({
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
        }),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'default',
      };
      const currentDocument = activeDocumentRef.current;
      const projectResult = onConnectRef.current?.(graphEdge, currentDocument);
      if (projectResult === false) {
        return;
      }

      if (projectResult && 'nodes' in projectResult && 'edges' in projectResult) {
        commitGraphDocumentRef.current(projectResult);
        const existingEdgeIds = new Set(currentDocument.edges.map((edge) => edge.id));
        const openedEdge =
          projectResult.edges.find((edge) => !existingEdgeIds.has(edge.id)) ??
          projectResult.edges.find(
            (edge) => edge.source === graphEdge.source && edge.target === graphEdge.target
          );
        if (openedEdge) {
          openGraphEdgeDataRef.current(openedEdge);
        }
        return;
      }

      const nextGraphEdge = projectResult ?? graphEdge;
      emitGraphChange(nodesRef.current, [
        ...edgesRef.current,
        graphEdgeToXyflowEdge(nextGraphEdge),
      ]);
      openGraphEdgeDataRef.current(nextGraphEdge);
    },
    [
      activeDocumentRef,
      commitGraphDocumentRef,
      edgesRef,
      emitGraphChange,
      nodesRef,
      onConnectRef,
      openGraphEdgeDataRef,
    ]
  );

  const handleSelectionChange = useCallback<
    OnSelectionChangeFunc<XyflowGraphNode, XyflowGraphEdge>
  >(
    (nextXyflowSelection) => {
      const nextSelection = {
        nodeIds: (nextXyflowSelection.nodes ?? []).map((node) => node.id),
        edgeIds: (nextXyflowSelection.edges ?? []).map((edge) => edge.id),
      };

      if (areGraphSelectionsEqual(selectionRef.current, nextSelection)) {
        return;
      }

      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      onSelectionChangeRef.current?.(nextSelection);
    },
    [onSelectionChangeRef, selectionRef]
  );
  const handleReactFlowInit = useCallback(
    (instance: ReactFlowInstance<XyflowGraphNode, XyflowGraphEdge>) => {
      setReactFlowInstance((currentInstance) => currentInstance ?? instance);
    },
    []
  );

  const selectValidationIssueTarget = (issue: GraphValidationIssue) => {
    if (!issue.targetId) {
      return;
    }

    const nextSelection =
      issue.target === 'node'
        ? { nodeIds: [issue.targetId], edgeIds: [] }
        : issue.target === 'edge'
          ? { nodeIds: [], edgeIds: [issue.targetId] }
          : null;

    if (!nextSelection || areGraphSelectionsEqual(selection, nextSelection)) {
      return;
    }

    setSelection(nextSelection);
    onSelectionChange?.(nextSelection);
  };

  const focusRuntimeEventTarget = useCallback(
    (event: GraphRuntimeEvent) => {
      if (!reactFlowInstance) {
        return;
      }

      const nodeIds = new Set<string>();

      if (event.nodeId) {
        nodeIds.add(event.nodeId);
      }

      if (event.edgeId) {
        const edge = renderedDocument.edges.find((candidate) => candidate.id === event.edgeId);
        if (edge) {
          nodeIds.add(edge.source);
          nodeIds.add(edge.target);
        }
      }

      if (nodeIds.size === 0) {
        return;
      }

      void reactFlowInstance.fitView({
        nodes: Array.from(nodeIds).map((id) => ({ id })),
        padding: nodeIds.size === 1 ? 0.55 : 0.35,
        duration: graphMotionDuration(320),
        maxZoom: 1.25,
      });
    },
    [reactFlowInstance, renderedDocument.edges]
  );

  const focusSelectedNeighborhood = () => {
    if (!reactFlowInstance) {
      return;
    }

    const selectedNodeIds = new Set(selectionRef.current.nodeIds);
    const selectedEdgeIds = new Set(selectionRef.current.edgeIds);
    const focusedNodeIds = new Set(selectedNodeIds);

    for (const edge of activeDocument.edges) {
      const edgeIsSelected = selectedEdgeIds.has(edge.id);
      const edgeTouchesSelectedNode =
        selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target);

      if (!edgeIsSelected && !edgeTouchesSelectedNode) {
        continue;
      }

      focusedNodeIds.add(edge.source);
      focusedNodeIds.add(edge.target);
    }

    if (focusedNodeIds.size === 0) {
      return;
    }

    void reactFlowInstance.fitView({
      nodes: Array.from(focusedNodeIds).map((id) => ({ id })),
      padding: focusedNodeIds.size === 1 ? 0.55 : 0.35,
      duration: graphMotionDuration(280),
      maxZoom: 1.15,
    });
  };

  useEffect(() => {
    const focusNodeKey = focusNodeId ? `${focusNodeId}:${focusNodeRevision}` : null;
    if (!focusNodeId || !focusNodeKey || !reactFlowInstance) {
      return;
    }

    if (lastFocusedNodeKeyRef.current === focusNodeKey) {
      return;
    }

    const nodeExists = activeDocumentRef.current.nodes.some((node) => node.id === focusNodeId);
    if (!nodeExists) {
      return;
    }

    lastFocusedNodeKeyRef.current = focusNodeKey;
    const nextSelection = { nodeIds: [focusNodeId], edgeIds: [] };

    if (!areGraphSelectionsEqual(selectionRef.current, nextSelection)) {
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      onSelectionChangeRef.current?.(nextSelection);
    }

    // The built-in initial fit runs after custom cards are measured. Delay the first requested
    // focus just enough to make the readable entrypoint framing win that initialization race.
    const timeoutId = window.setTimeout(
      () => {
        const focusedNode = reactFlowInstance.getNode(focusNodeId);
        const width = focusedNode?.measured?.width ?? focusedNode?.width;
        const height = focusedNode?.measured?.height ?? focusedNode?.height;

        if (focusedNode && width && height) {
          void reactFlowInstance.setCenter(
            focusedNode.position.x + width / 2,
            focusedNode.position.y + height / 2,
            { zoom: 0.95, duration: graphMotionDuration(320) }
          );
          return;
        }

        void reactFlowInstance.fitView({
          nodes: [{ id: focusNodeId }],
          padding: 0.55,
          duration: graphMotionDuration(320),
          maxZoom: 1.25,
        });
      },
      focusNodeRevision === 0 ? 220 : 0
    );

    return () => window.clearTimeout(timeoutId);
  }, [
    activeDocumentRef,
    focusNodeId,
    focusNodeRevision,
    onSelectionChangeRef,
    reactFlowInstance,
    selectionRef,
  ]);

  useEffect(() => {
    if (!runtimePlaybackIsActive || !currentReplayEvent) {
      return;
    }

    focusRuntimeEventTarget(currentReplayEvent);
  }, [currentReplayEvent, focusRuntimeEventTarget, runtimePlaybackIsActive]);

  const selectRuntimeEventTarget = (event: GraphRuntimeEvent) => {
    setFocusedRuntimeEdgeId(event.edgeId ?? null);
    focusRuntimeEventTarget(event);

    if (!event.nodeId && !event.edgeId) {
      return;
    }

    if (!event.nodeId) {
      return;
    }

    const nextSelection = {
      nodeIds: event.nodeId ? [event.nodeId] : [],
      edgeIds: [],
    };

    if (areGraphSelectionsEqual(selection, nextSelection)) {
      return;
    }

    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    onSelectionChange?.(nextSelection);
  };

  const closeRuntimeEventDetails = () => {
    setSelectedRuntimeEventId(null);
    setFocusedRuntimeEdgeId(null);
  };

  const handleRuntimeEventClick = (event: GraphRuntimeEvent) => {
    if (selectedRuntimeEventId === event.id) {
      closeRuntimeEventDetails();
      onRuntimeEventClick?.(event);
      return;
    }

    setSelectedRuntimeEventId(event.id);
    selectRuntimeEventTarget(event);
    onRuntimeEventClick?.(event);
  };

  const addNodeFromPalette = (item: GraphPaletteItem) => {
    const projectNode = onAddNode?.(item);
    const graphNode: GraphNode = projectNode ?? {
      id: `${item.type}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
      type: item.type,
      label: item.label,
      description: item.description,
      position: {
        x: 80 + nodes.length * 40,
        y: 80 + nodes.length * 40,
      },
      data: item.defaultData,
      style: {
        color: item.color,
        icon: item.icon,
      },
      metadata: item.metadata,
    };

    commitGraphDocument(
      createDocumentFromXyflow(activeDocument, [...nodes, graphNodeToXyflowNode(graphNode)], edges)
    );
  };

  const undoGraphChange = () => {
    setHistory((currentHistory) => {
      const previousDocument = currentHistory.past.at(-1);

      if (!previousDocument) {
        return currentHistory;
      }

      if (!document) {
        setInternalDocument(previousDocument);
      }
      onGraphChange?.(previousDocument);

      return {
        past: currentHistory.past.slice(0, -1),
        future: [activeDocument, ...currentHistory.future],
      };
    });
  };

  const redoGraphChange = () => {
    setHistory((currentHistory) => {
      const nextDocument = currentHistory.future[0];

      if (!nextDocument) {
        return currentHistory;
      }

      if (!document) {
        setInternalDocument(nextDocument);
      }
      onGraphChange?.(nextDocument);

      return {
        past: [...currentHistory.past, activeDocument],
        future: currentHistory.future.slice(1),
      };
    });
  };

  const updateGraphDocumentFromInspector = (nextDocument: GraphDocument) => {
    if (readOnly) {
      return;
    }

    commitGraphDocument(nextDocument);
  };

  const updateGraphNodeFromInspector = (nextNode: GraphNode) => {
    updateGraphDocumentFromInspector({
      ...activeDocument,
      nodes: activeDocument.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
    });
  };

  const updateGraphEdgeFromInspector = (nextEdge: GraphEdge) => {
    updateGraphDocumentFromInspector({
      ...activeDocument,
      edges: activeDocument.edges.map((edge) => (edge.id === nextEdge.id ? nextEdge : edge)),
    });
  };

  const runBuiltInToolbarAction = (action: GraphToolbarAction) => {
    if (!isGraphBuiltInToolbarActionId(action.id)) {
      return false;
    }

    if (action.id === graphBuiltInToolbarActionIds.addNode) {
      const firstPaletteItem = paletteItems?.[0];

      if (!readOnly && firstPaletteItem) {
        addNodeFromPalette(firstPaletteItem);
      }

      return true;
    }

    if (action.id === graphBuiltInToolbarActionIds.autoLayout) {
      if (!readOnly) {
        commitGraphDocument(layoutGraphDocumentGrid(activeDocument, layoutOptions));
      }

      return true;
    }

    if (action.id === graphBuiltInToolbarActionIds.fitView) {
      void reactFlowInstance?.fitView(fitViewOptions ?? { padding: 0.2 });
      return true;
    }

    if (action.id === graphBuiltInToolbarActionIds.focusSelection) {
      focusSelectedNeighborhood();
      return true;
    }

    if (action.id === graphBuiltInToolbarActionIds.undo) {
      if (!readOnly) {
        undoGraphChange();
      }

      return true;
    }

    if (action.id === graphBuiltInToolbarActionIds.redo) {
      if (!readOnly) {
        redoGraphChange();
      }

      return true;
    }

    if (action.id === graphBuiltInToolbarActionIds.export) {
      const json = stringifyGraphDocument(activeDocument);

      if (onExportGraph) {
        onExportGraph(activeDocument, json);
      } else {
        downloadGraphDocumentJson(activeDocument, json);
      }

      return true;
    }

    if (action.id === graphBuiltInToolbarActionIds.import) {
      if (!readOnly) {
        const nextDocument = onImportGraph?.(activeDocument);

        if (nextDocument) {
          commitGraphDocument(nextDocument);
        }
      }

      return true;
    }

    return false;
  };

  const runToolbarAction = (action: GraphToolbarAction) => {
    if (action.disabled) {
      return;
    }

    if (runBuiltInToolbarAction(action)) {
      return;
    }

    const nextDocument = onToolbarAction?.(action, activeDocument);
    if (!nextDocument || nextDocument === activeDocument) {
      return;
    }

    const currentNodeIds = new Set(activeDocument.nodes.map((node) => node.id));
    const addedNodeIds = nextDocument.nodes
      .filter((node) => !currentNodeIds.has(node.id))
      .map((node) => node.id);
    const documentToCommit =
      addedNodeIds.length > 0 && reactFlowInstance && canvasContainerRef.current
        ? {
            ...nextDocument,
            nodes: nextDocument.nodes.map((node) => {
              const addedNodeIndex = addedNodeIds.indexOf(node.id);
              if (addedNodeIndex < 0) {
                return node;
              }

              const rect = canvasContainerRef.current?.getBoundingClientRect();
              if (!rect) {
                return node;
              }

              const position = reactFlowInstance.screenToFlowPosition({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              });

              return {
                ...node,
                position: {
                  x: position.x + addedNodeIndex * 32,
                  y: position.y + addedNodeIndex * 32,
                },
              };
            }),
          }
        : nextDocument;

    commitGraphDocument(documentToCommit);

    if (action.metadata?.fitViewAfterRun === true) {
      // Wait for React Flow to measure the newly arranged nodes before fitting their full bounds.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const resolvedFitViewOptions = fitViewOptions ?? { padding: 0.2 };
          void reactFlowInstance?.fitView({
            ...resolvedFitViewOptions,
            duration: graphMotionDuration(resolvedFitViewOptions.duration ?? 280),
          });
        });
      });
    }
  };

  const runToolbarActionById = (actionId: GraphId) => {
    const action = resolvedToolbarActions.find((toolbarAction) =>
      toolbarActionMatches(toolbarAction, actionId)
    );

    if (action) {
      runToolbarAction(action);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!resolvedKeyboardShortcuts.length || keyboardTargetIsEditable(event.target)) {
      return;
    }

    const shortcut = resolvedKeyboardShortcuts.find(
      (keyboardShortcut) =>
        !keyboardShortcut.disabled && matchesKeyboardShortcut(event, keyboardShortcut)
    );

    if (!shortcut) {
      return;
    }

    if (shortcut.preventDefault ?? true) {
      event.preventDefault();
    }

    runToolbarActionById(shortcut.actionId);
  };

  const selectedNode = selection.nodeIds[0]
    ? activeDocument.nodes.find((node) => node.id === selection.nodeIds[0])
    : undefined;
  const selectedEdge = selection.edgeIds[0]
    ? activeDocument.edges.find((edge) => edge.id === selection.edgeIds[0])
    : undefined;
  const inspector =
    (selectedNode ? nodeInspectors?.[selectedNode.type] : undefined) ??
    (selectedEdge ? edgeInspectors?.[selectedEdge.type] : undefined) ??
    renderInspector;
  const palette = renderPalette ?? DefaultPalette;
  const toolbar = renderToolbar ?? DefaultToolbar;
  const RuntimeEventRenderer = renderRuntimeEvent ?? DefaultRuntimeEvent;
  const visibleRuntimeEvents = useMemo(
    () => activeRuntimeEvents?.slice(-runtimeEventLimit).reverse() ?? [],
    [activeRuntimeEvents, runtimeEventLimit]
  );
  const runtimeReplayLabel =
    runtimeEventCursor === null
      ? `Live · ${runtimeEventCount} event${runtimeEventCount === 1 ? '' : 's'}`
      : `Replay · ${activeRuntimeEventCount}/${runtimeEventCount}`;
  const playRuntimeReplay = () => {
    if (runtimeEventCount === 0) {
      return;
    }

    setRuntimeEventCursor((currentCursor) => {
      const currentCount =
        currentCursor === null ? 0 : clampRuntimeEventCursor(currentCursor, runtimeEventCount);

      return currentCount >= runtimeEventCount ? 0 : currentCount;
    });
    setRuntimePlaybackActive(true);
  };
  const pauseRuntimeReplay = () => {
    setRuntimePlaybackActive(false);
  };
  const showLiveRuntimeEvents = () => {
    setRuntimePlaybackActive(false);
    setRuntimeEventCursor(null);
  };
  const scrubRuntimeReplay = (eventCount: number) => {
    setRuntimePlaybackActive(false);
    setRuntimeEventCursor(eventCount);
  };
  const selectedRuntimeSummary = selectedRuntimeEvent
    ? runtimePayloadSummary(selectedRuntimeEvent)
    : null;
  const selectedRuntimeTimingRows = selectedRuntimeEvent
    ? runtimeEventTimingRows(selectedRuntimeEvent)
    : [];
  const selectedRuntimePayload = formatRuntimeEventJson(selectedRuntimeEvent?.payload);
  const selectedRuntimeMetadata = formatRuntimeEventJson(selectedRuntimeEvent?.metadata);
  const selectedRuntimeTarget = selectedRuntimeEvent
    ? runtimeEventTargetLabel(selectedRuntimeEvent)
    : null;
  const runtimePanelDetailEvent = runtimePlaybackIsActive ? null : selectedRuntimeEvent;
  const runtimePanelShowsDetails = Boolean(runtimePanelDetailEvent);
  const runtimePanelIsCompact = runtimePlaybackIsActive;
  const runtimeRunDetailsHref = useMemo(() => {
    if (!getRuntimeEventRunHref) {
      return null;
    }

    const candidates = [
      runtimePanelDetailEvent,
      currentReplayEvent,
      ...(activeRuntimeEvents ?? []).slice().reverse(),
    ].filter((event): event is GraphRuntimeEvent => Boolean(event));

    for (const event of candidates) {
      const href = getRuntimeEventRunHref(event);
      if (href) {
        return href;
      }
    }

    return null;
  }, [activeRuntimeEvents, currentReplayEvent, getRuntimeEventRunHref, runtimePanelDetailEvent]);
  const enabledBuiltInToolbarActions =
    builtInToolbarActions === true
      ? Object.values(graphBuiltInToolbarActionIds)
      : Array.isArray(builtInToolbarActions)
        ? builtInToolbarActions
        : [];
  const resolvedToolbarActions = [
    ...enabledBuiltInToolbarActions.map((actionId) => {
      const action = graphBuiltInToolbarActions[actionId];

      if (actionId === graphBuiltInToolbarActionIds.addNode) {
        return { ...action, disabled: readOnly || !paletteItems?.length };
      }

      if (actionId === graphBuiltInToolbarActionIds.autoLayout) {
        return { ...action, disabled: readOnly || activeDocument.nodes.length === 0 };
      }

      if (actionId === graphBuiltInToolbarActionIds.focusSelection) {
        return {
          ...action,
          disabled: selection.nodeIds.length === 0 && selection.edgeIds.length === 0,
        };
      }

      if (actionId === graphBuiltInToolbarActionIds.undo) {
        return { ...action, disabled: readOnly || history.past.length === 0 };
      }

      if (actionId === graphBuiltInToolbarActionIds.redo) {
        return { ...action, disabled: readOnly || history.future.length === 0 };
      }

      if (actionId === graphBuiltInToolbarActionIds.import) {
        return { ...action, disabled: readOnly || !onImportGraph };
      }

      if (actionId === graphBuiltInToolbarActionIds.export) {
        return action;
      }

      return action;
    }),
    ...(toolbarActions ?? []),
  ];
  const resolvedKeyboardShortcuts = Array.isArray(keyboardShortcuts)
    ? keyboardShortcuts
    : keyboardShortcuts
      ? defaultGraphKeyboardShortcuts
      : emptyGraphKeyboardShortcuts;

  return (
    <ReactFlowProvider>
      <div
        ref={canvasContainerRef}
        className={`relative ${toolbarPlacement === 'docked' ? 'flex flex-col' : ''} ${className ?? 'h-full min-h-80 w-full rounded-lg border border-neutral-200 bg-white dark:border-white/10 dark:bg-slate-950/88 dark:[&_.react-flow]:bg-slate-950/70 dark:[&_.react-flow__background]:opacity-70'}`}
        tabIndex={resolvedKeyboardShortcuts.length > 0 ? 0 : undefined}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => {
          if (resolvedKeyboardShortcuts.length > 0) {
            event.currentTarget.focus({ preventScroll: true });
          }
        }}
        onMouseMove={(event) => {
          const target = event.target instanceof Element ? event.target : null;
          const edgeElement = target?.closest('.react-flow__edge');
          const nextHoveredEdgeId = edgeElement?.getAttribute('data-id') ?? null;

          setHoveredEdgeId((current) =>
            current === nextHoveredEdgeId ? current : nextHoveredEdgeId
          );
        }}
        onMouseLeave={() => setHoveredEdgeId(null)}
      >
        {resolvedToolbarActions.length > 0 && toolbarPlacement === 'docked' ? (
          <div className="relative z-20 shrink-0 border-b border-neutral-200 bg-white/96 px-2 py-2 dark:border-white/10 dark:bg-slate-950/96">
            {/* eslint-disable-next-line react-hooks/refs */}
            {toolbar({ actions: resolvedToolbarActions, onAction: runToolbarAction })}
          </div>
        ) : null}
        <div className={toolbarPlacement === 'docked' ? 'relative min-h-0 flex-1' : 'contents'}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={defaultNodeTypes}
            edgeTypes={defaultEdgeTypes}
            fitView={fitView}
            fitViewOptions={fitViewOptions}
            nodesConnectable={!readOnly}
            nodesDraggable={!readOnly}
            connectionMode={ConnectionMode.Loose}
            elementsSelectable
            edgesReconnectable={!readOnly}
            onNodesChange={readOnly ? undefined : handleNodesChange}
            onEdgesChange={readOnly ? undefined : handleEdgesChange}
            onConnect={readOnly ? undefined : handleConnect}
            onSelectionChange={handleSelectionChange}
            onEdgeMouseEnter={(_, edge) => setHoveredEdgeId(edge.id)}
            onEdgeMouseLeave={() => setHoveredEdgeId(null)}
            onNodeClick={(_, node) => {
              const graphNode = xyflowNodeToGraphNode(node);

              if (readOnly) {
                onNodeOpen?.(graphNode);
                return;
              }

              selectGraphNodeData(graphNode);
            }}
            onNodeDoubleClick={(_, node) => onNodeOpen?.(xyflowNodeToGraphNode(node))}
            onEdgeClick={(_, edge) => openGraphEdge(edge)}
            onEdgeDoubleClick={(_, edge) => openGraphEdge(edge)}
            onInit={handleReactFlowInit}
          >
            {showBackground ? <Background /> : null}
            {canvasBackdrop ? <ViewportPortal>{canvasBackdrop}</ViewportPortal> : null}
            {showControls ? <Controls showInteractive={false} /> : null}
            {showMiniMap ? (
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                bgColor="var(--agency-graph-minimap-bg)"
                maskColor="var(--agency-graph-minimap-mask)"
                maskStrokeColor="var(--agency-graph-minimap-viewport-stroke)"
                maskStrokeWidth={2.5}
                nodeColor={minimapNodeColor}
                nodeStrokeColor={minimapNodeStrokeColor}
                nodeStrokeWidth={2}
                nodeBorderRadius={10}
                className="nowheel nopan rounded-xl border border-neutral-200 shadow-lg [--agency-graph-minimap-bg:rgba(248,250,252,0.98)] [--agency-graph-minimap-mask:rgba(15,23,42,0.16)] [--agency-graph-minimap-viewport-stroke:rgba(15,23,42,0.62)] dark:border-sky-300/35 dark:shadow-[0_18px_48px_rgba(2,8,23,0.72)] dark:[--agency-graph-minimap-bg:rgba(2,8,23,0.96)] dark:[--agency-graph-minimap-mask:rgba(2,8,23,0.58)] dark:[--agency-graph-minimap-viewport-stroke:rgba(226,232,240,0.95)]"
              />
            ) : null}
          </ReactFlow>
          {loading ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 p-6 dark:bg-slate-950/70">
              <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-200 dark:shadow-none">
                {loadingContent ?? 'Loading graph'}
              </div>
            </div>
          ) : null}
          {activeDocument.nodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="rounded-md border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-600 shadow-sm dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-300 dark:shadow-none">
                {emptyContent ?? 'No graph nodes'}
              </div>
            </div>
          ) : null}
          {blockingValidationIssues.length > 0 ? (
            <div className="absolute left-1/2 top-3 z-10 w-96 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs text-red-700 shadow-sm dark:border-red-400/25 dark:bg-slate-950/92 dark:text-red-300 dark:shadow-none">
              {invalidContent ?? (
                <div className="space-y-2">
                  <div className="font-medium">
                    {blockingValidationIssues.length} graph issue
                    {blockingValidationIssues.length === 1 ? '' : 's'} need attention
                  </div>
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {blockingValidationIssues.slice(0, 5).map((issue) => {
                      const canSelect =
                        Boolean(issue.targetId) &&
                        (issue.target === 'node' || issue.target === 'edge');

                      return (
                        <button
                          key={issue.id}
                          type="button"
                          disabled={!canSelect}
                          className="block w-full rounded px-2 py-1 text-left hover:bg-red-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-red-500/10"
                          onClick={() => selectValidationIssueTarget(issue)}
                        >
                          <span className="font-medium capitalize">{issue.severity}</span>
                          <span className="mx-1">·</span>
                          <span>{issue.message}</span>
                        </button>
                      );
                    })}
                    {blockingValidationIssues.length > 5 ? (
                      <div className="px-2 py-1 text-red-600 dark:text-red-300">
                        +{blockingValidationIssues.length - 5} more issue
                        {blockingValidationIssues.length - 5 === 1 ? '' : 's'}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          {readOnly ? (
            <div className="absolute right-3 top-3 z-10 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 shadow-sm dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-300 dark:shadow-none">
              {readOnlyContent ?? 'Read-only'}
            </div>
          ) : null}
          {!readOnly && paletteItems && paletteItems.length > 0 ? (
            <div className="absolute left-3 top-3 z-10">
              {palette({ items: paletteItems, onAddNode: addNodeFromPalette })}
            </div>
          ) : null}
          {resolvedToolbarActions.length > 0 && toolbarPlacement === 'overlay' ? (
            <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-16rem)] max-sm:max-w-[calc(100%-1.5rem)]">
              {/* eslint-disable-next-line react-hooks/refs */}
              {toolbar({ actions: resolvedToolbarActions, onAction: runToolbarAction })}
            </div>
          ) : null}
          {showInspector && inspector && (selectedNode || selectedEdge) ? (
            <div className="absolute right-3 top-3 z-10 w-80 max-w-[calc(100%-1.5rem)] rounded-md border border-neutral-200 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-slate-950/94 dark:shadow-[0_18px_48px_rgba(2,8,23,0.7)]">
              {inspector({
                node: selectedNode,
                edge: selectedEdge,
                document: activeDocument,
                readOnly,
                onClose: () => {
                  const nextSelection = { nodeIds: [], edgeIds: [] };
                  setSelection(nextSelection);
                  onSelectionChange?.(nextSelection);
                },
                onUpdateDocument: updateGraphDocumentFromInspector,
                onUpdateNode: updateGraphNodeFromInspector,
                onUpdateEdge: updateGraphEdgeFromInspector,
              })}
            </div>
          ) : null}
          {runtimeEventCount > 0 ? (
            <div
              className={`nowheel nopan absolute z-10 flex max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-neutral-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-slate-950/94 dark:shadow-[0_18px_48px_rgba(2,8,23,0.7)] ${
                runtimePanelShowsDetails ? 'w-2xl' : 'w-80'
              } ${runtimePanelPositionClassName(runtimePanelPosition)} ${runtimePanelMaxHeightClassName(runtimePanelIsCompact)}`}
              aria-label="Graph runtime timeline"
            >
              <div className="mb-2 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 dark:border-white/10 dark:bg-white/4">
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-neutral-600 dark:text-slate-300">
                  <span>{runtimeReplayLabel}</span>
                  <div className="flex items-center gap-1">
                    {runtimeRunDetailsHref ? (
                      <a
                        href={runtimeRunDetailsHref}
                        className="rounded border border-sky-200 bg-white px-2 py-0.5 text-[11px] text-sky-700 hover:border-sky-300 hover:text-sky-900 dark:border-sky-300/25 dark:bg-slate-950/78 dark:text-sky-200 dark:hover:border-sky-300/45"
                        aria-label="View run details"
                        title="View run details"
                        onClick={(event) => event.stopPropagation()}
                      >
                        View run
                      </a>
                    ) : null}
                    {runtimePlaybackIsActive ? (
                      <button
                        type="button"
                        className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-200 dark:hover:border-sky-300/40 dark:hover:text-sky-200"
                        aria-label="Pause runtime replay"
                        onClick={pauseRuntimeReplay}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-200 dark:hover:border-sky-300/40 dark:hover:text-sky-200"
                        aria-label="Play runtime replay"
                        disabled={runtimeEventCount === 0}
                        onClick={playRuntimeReplay}
                      >
                        Play
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-200 dark:hover:border-sky-300/40 dark:hover:text-sky-200"
                      disabled={runtimeEventCursor === null}
                      onClick={showLiveRuntimeEvents}
                    >
                      Live
                    </button>
                  </div>
                </div>
                <div className="mb-1 flex items-center gap-1 text-[11px] text-neutral-500 dark:text-slate-400">
                  <span className="shrink-0">Speed</span>
                  {runtimePlaybackSpeeds.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      className={`rounded border px-1.5 py-0.5 ${
                        runtimePlaybackSpeed === speed
                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-300 dark:hover:border-sky-300/40 dark:hover:text-sky-200'
                      }`}
                      aria-label={`Runtime replay speed ${speed}x`}
                      onClick={() => setRuntimePlaybackSpeed(speed)}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={0}
                  max={runtimeEventCount}
                  value={activeRuntimeEventCount}
                  className="h-2 w-full accent-sky-600"
                  aria-label="Runtime event replay position"
                  onChange={(event) => scrubRuntimeReplay(Number(event.target.value))}
                />
              </div>
              <div
                className={
                  runtimePanelShowsDetails
                    ? 'grid min-h-0 flex-1 grid-cols-[minmax(0,20rem)_minmax(18rem,1fr)] gap-2 overflow-hidden'
                    : 'min-h-0 flex-1 overflow-hidden'
                }
              >
                <div className="h-full min-h-0 space-y-1 overflow-y-auto pr-1">
                  {visibleRuntimeEvents.length > 0 ? (
                    visibleRuntimeEvents.map((event) => (
                      <div key={event.id}>
                        <RuntimeEventRenderer
                          event={event}
                          isCurrent={currentReplayEvent?.id === event.id}
                          onClick={handleRuntimeEventClick}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="px-2 py-1 text-xs text-neutral-500 dark:text-slate-400">
                      No events applied
                    </div>
                  )}
                </div>
                {runtimePanelDetailEvent ? (
                  <div
                    className="min-h-0 space-y-2 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 text-xs dark:border-white/10 dark:bg-white/4 dark:text-slate-300"
                    aria-label="Runtime event details"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-neutral-800 dark:text-slate-100">
                          {runtimePanelDetailEvent.type}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-slate-400">
                          {runtimePanelDetailEvent.timestamp}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {runtimePanelDetailEvent.status ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] capitalize text-neutral-600 dark:bg-slate-950/78 dark:text-slate-300">
                            {runtimePanelDetailEvent.status}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="rounded border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-600 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/78 dark:text-slate-300 dark:hover:border-sky-300/40 dark:hover:text-sky-200"
                          aria-label="Close runtime event details"
                          onClick={closeRuntimeEventDetails}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <div className="rounded border border-neutral-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950/78">
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                        Summary
                      </div>
                      <dl className="grid gap-1 text-[11px]">
                        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                          <dt className="text-neutral-500 dark:text-slate-400">Type</dt>
                          <dd className="truncate text-neutral-800 dark:text-slate-200">
                            {runtimePanelDetailEvent.type}
                          </dd>
                        </div>
                        {runtimePanelDetailEvent.status ? (
                          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                            <dt className="text-neutral-500 dark:text-slate-400">Status</dt>
                            <dd className="truncate capitalize text-neutral-800 dark:text-slate-200">
                              {runtimePanelDetailEvent.status}
                            </dd>
                          </div>
                        ) : null}
                        {selectedRuntimeTarget ? (
                          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                            <dt className="text-neutral-500 dark:text-slate-400">Target</dt>
                            <dd className="truncate text-neutral-800 dark:text-slate-200">
                              {selectedRuntimeTarget}
                            </dd>
                          </div>
                        ) : null}
                        {selectedRuntimeSummary ? (
                          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                            <dt className="text-neutral-500 dark:text-slate-400">Payload</dt>
                            <dd className="truncate text-neutral-800 dark:text-slate-200">
                              {selectedRuntimeSummary}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    {selectedRuntimeTarget ? (
                      <div className="sr-only mt-2 truncate text-[11px] text-neutral-500 dark:text-slate-400">
                        Target: {selectedRuntimeTarget}
                      </div>
                    ) : null}
                    {selectedRuntimeTimingRows.length > 0 ? (
                      <div className="rounded border border-neutral-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950/78">
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                          Timing
                        </div>
                        <dl className="grid gap-1 text-[11px]">
                          {selectedRuntimeTimingRows.map((row) => (
                            <div
                              key={row.label}
                              className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"
                            >
                              <dt className="text-neutral-500 dark:text-slate-400">{row.label}</dt>
                              <dd className="truncate text-neutral-800 dark:text-slate-200">
                                {row.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}
                    {selectedRuntimePayload ? (
                      <details className="rounded border border-neutral-200 bg-white dark:border-white/10 dark:bg-slate-950/78">
                        <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                          Payload
                        </summary>
                        <pre className="max-h-32 overflow-auto border-t border-neutral-200 p-2 text-[11px] leading-4 text-neutral-700 dark:border-white/10 dark:text-slate-300">
                          {selectedRuntimePayload}
                        </pre>
                      </details>
                    ) : null}
                    {selectedRuntimeMetadata ? (
                      <details className="rounded border border-neutral-200 bg-white dark:border-white/10 dark:bg-slate-950/78">
                        <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
                          Metadata
                        </summary>
                        <pre className="max-h-32 overflow-auto border-t border-neutral-200 p-2 text-[11px] leading-4 text-neutral-700 dark:border-white/10 dark:text-slate-300">
                          {selectedRuntimeMetadata}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
