import type { ObservatoryGridPoint, ObservatoryGridSize } from '@/modules/observatory/engine/world/grid';
import type { ObservatoryObject, ObservatoryRoomKind } from '@/modules/observatory/engine/world/layoutTypes';

export type ObservatoryRoomTemplateId =
  | 'engineering-pod'
  | 'research-room'
  | 'finance-room'
  | 'audit-workspace'
  | 'meeting-room'
  | 'ops-center'
  | 'approval-room';

export interface ObservatoryRoomTemplateObject {
  assetId: string;
  blocksMovement?: boolean;
  offset: ObservatoryGridPoint;
  size?: ObservatoryGridSize;
}

export interface ObservatoryRoomTemplate {
  defaultName: string;
  id: ObservatoryRoomTemplateId;
  kind: ObservatoryRoomKind;
  label: string;
  objects: ObservatoryRoomTemplateObject[];
  size: ObservatoryGridSize;
  wallAssetId?: string;
}

export interface ObservatoryPlacedRoomTemplate {
  objectIds: string[];
  roomId: string;
}

export const observatoryRoomTemplates = [
  {
    defaultName: 'Engineering Pod',
    id: 'engineering-pod',
    kind: 'workspace',
    label: 'Engineering pod',
    objects: [
      workstation({ x: 1, y: 1 }),
      workstation({ x: 4, y: 1 }),
      screens({ x: 2, y: 2 }),
    ],
    size: { height: 4, width: 7 },
    wallAssetId: 'wall:office-partition',
  },
  {
    defaultName: 'Research Room',
    id: 'research-room',
    kind: 'workspace',
    label: 'Research room',
    objects: [
      screens({ x: 1, y: 1 }),
      screens({ x: 4, y: 1 }),
      coffee({ x: 3, y: 2 }),
    ],
    size: { height: 4, width: 7 },
    wallAssetId: 'wall:office-partition',
  },
  {
    defaultName: 'Finance Room',
    id: 'finance-room',
    kind: 'workspace',
    label: 'Finance room',
    objects: [
      workstation({ x: 1, y: 1 }),
      workstation({ x: 4, y: 1 }),
      server({ x: 3, y: 2 }),
    ],
    size: { height: 4, width: 7 },
    wallAssetId: 'wall:office-partition',
  },
  {
    defaultName: 'Audit Workspace',
    id: 'audit-workspace',
    kind: 'runtime',
    label: 'Audit workspace',
    objects: [
      server({ x: 1, y: 1 }),
      screens({ x: 3, y: 1 }),
      workstation({ x: 5, y: 2 }),
    ],
    size: { height: 4, width: 7 },
    wallAssetId: 'wall:office-partition',
  },
  {
    defaultName: 'Meeting Room',
    id: 'meeting-room',
    kind: 'commons',
    label: 'Meeting room',
    objects: [
      workstation({ x: 1, y: 1 }),
      workstation({ x: 4, y: 1 }),
      coffee({ x: 3, y: 2 }),
    ],
    size: { height: 4, width: 7 },
    wallAssetId: 'wall:office-partition',
  },
  {
    defaultName: 'Ops Center',
    id: 'ops-center',
    kind: 'runtime',
    label: 'Ops center',
    objects: [
      screens({ x: 1, y: 1 }),
      server({ x: 4, y: 1 }),
      workstation({ x: 2, y: 2 }),
    ],
    size: { height: 4, width: 7 },
    wallAssetId: 'wall:office-partition',
  },
  {
    defaultName: 'Approval Room',
    id: 'approval-room',
    kind: 'workspace',
    label: 'Approval room',
    objects: [
      screens({ x: 1, y: 1 }),
      workstation({ x: 4, y: 1 }),
      coffee({ x: 5, y: 2 }),
    ],
    size: { height: 4, width: 7 },
    wallAssetId: 'wall:office-partition',
  },
] satisfies ObservatoryRoomTemplate[];

export function getObservatoryRoomTemplate(templateId: string): ObservatoryRoomTemplate | undefined {
  return observatoryRoomTemplates.find((template) => template.id === templateId);
}

export function createObservatoryTemplateObject(
  template: ObservatoryRoomTemplate,
  object: ObservatoryRoomTemplateObject,
  roomId: string,
  objectId: string,
  origin: ObservatoryGridPoint,
): ObservatoryObject {
  return {
    assetId: object.assetId,
    blocksMovement: object.blocksMovement ?? true,
    id: objectId,
    position: {
      x: origin.x + object.offset.x,
      y: origin.y + object.offset.y,
    },
    roomId,
    size: object.size,
  };
}

function workstation(offset: ObservatoryGridPoint): ObservatoryRoomTemplateObject {
  return {
    assetId: 'furniture:1-modern-office-singles-48x48:dual-monitor-workstation-wide',
    blocksMovement: true,
    offset,
    size: { height: 3, width: 2 },
  };
}

function screens(offset: ObservatoryGridPoint): ObservatoryRoomTemplateObject {
  return {
    assetId: 'furniture:1-modern-office-singles-48x48:modern-office-multi-monitor-control-station',
    blocksMovement: false,
    offset,
    size: { height: 1, width: 2 },
  };
}

function server(offset: ObservatoryGridPoint): ObservatoryRoomTemplateObject {
  return {
    assetId: 'furniture:1-modern-office-singles-48x48:modern-office-gray-runtime-server-tower',
    blocksMovement: true,
    offset,
    size: { height: 1, width: 1 },
  };
}

function coffee(offset: ObservatoryGridPoint): ObservatoryRoomTemplateObject {
  return {
    assetId: 'furniture:1-modern-office-singles-48x48:office-water-cooler',
    blocksMovement: false,
    offset,
    size: { height: 1, width: 1 },
  };
}
