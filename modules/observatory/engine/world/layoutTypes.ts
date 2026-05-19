import type {
  ObservatoryGridPoint,
  ObservatoryGridRect,
  ObservatoryGridSize,
} from '@/modules/observatory/engine/world/grid';

export const OBSERVATORY_LAYOUT_SCHEMA_VERSION = 1;

export type ObservatoryRoomKind = 'workspace' | 'runtime' | 'commons';
export type ObservatoryRoomWallCellKind = 'door' | 'opening' | 'wall';
export type ObservatoryRoomWallSide = 'east' | 'north' | 'south' | 'west';

export interface ObservatoryRoomWallEdgeOpening {
  point: ObservatoryGridPoint;
  side: ObservatoryRoomWallSide;
}

export interface ObservatoryRoomFloorAssetOverride {
  assetId: string;
  point: ObservatoryGridPoint;
}

export interface ObservatoryRoomWallAssetOverride {
  assetId: string;
  height?: number;
  point: ObservatoryGridPoint;
}

export type ObservatoryAgentStatus = 'idle' | 'working' | 'blocked' | 'complete' | 'error';

export interface ObservatoryWorld {
  id: string;
  name: string;
  grid: {
    tileSize: number;
    size: ObservatoryGridSize;
  };
  maps: ObservatoryMap[];
}

export interface ObservatoryMap {
  id: string;
  name: string;
  size: ObservatoryGridSize;
  defaultFloorAssetId: string;
  rooms: ObservatoryRoom[];
  objects: ObservatoryObject[];
  agents: ObservatoryAgent[];
}

export interface ObservatoryRoom {
  id: string;
  name: string;
  kind: ObservatoryRoomKind;
  bounds: ObservatoryGridRect;
  floorAssetId?: string;
  floorAssetOverrides?: ObservatoryRoomFloorAssetOverride[];
  runtime?: ObservatoryRuntimeLayoutMetadata;
  wallAssetId?: string;
  wallAssetOverrides?: ObservatoryRoomWallAssetOverride[];
  wallDoors?: ObservatoryGridPoint[];
  wallEdgeOpenings?: ObservatoryRoomWallEdgeOpening[];
  wallHeight?: number;
  wallOpenings?: ObservatoryGridPoint[];
  wallTileOpenings?: ObservatoryRoomWallEdgeOpening[];
}

export interface ObservatoryObject {
  id: string;
  assetId: string;
  roomId?: string;
  position: ObservatoryGridPoint;
  size?: ObservatoryGridSize;
  blocksMovement?: boolean;
  render?: ObservatoryObjectRenderOptions;
  runtime?: ObservatoryRuntimeLayoutMetadata;
}

export interface ObservatoryObjectRenderOptions {
  depth?: number;
  offsetPx?: {
    x: number;
    y: number;
  };
  sizePx?: {
    height: number;
    width: number;
  };
  sourceCrop?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
}

export interface ObservatoryAgent {
  id: string;
  name: string;
  assetId: string;
  roomId?: string;
  position: ObservatoryGridPoint;
  runtime?: ObservatoryRuntimeLayoutMetadata;
  status: ObservatoryAgentStatus;
}

export interface ObservatoryRuntimeLayoutMetadata {
  assignedWorkflows?: Array<{
    id: string;
    name?: string | null;
  }>;
  behavior?: 'ambient' | 'approval' | 'executing' | 'planning' | 'working';
  description?: string;
  logs?: string[];
  recentEvents?: string[];
  role?: string | null;
  runId?: string;
  targetObjectId?: string;
  workflowId?: string;
}

export interface ObservatoryLayoutDocument {
  metadata?: {
    id?: string;
    name?: string;
    notes?: string;
    publishedBy?: string;
    status?: 'draft' | 'published';
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string;
    version?: number;
  };
  schemaVersion: number;
  world: ObservatoryWorld;
}

export interface ObservatoryLayoutIssue {
  path: string;
  reason: string;
}

export interface ObservatoryValidatedLayout {
  layout?: ObservatoryLayoutDocument;
  issues: ObservatoryLayoutIssue[];
}
