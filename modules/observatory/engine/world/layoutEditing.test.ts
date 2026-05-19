import { describe, expect, it } from 'vitest';

import {
  applyObservatoryProceduralLayoutRules,
  createBlankObservatoryLayout,
  createObservatoryRoom,
  createObservatoryCorridor,
  deleteObservatoryObject,
  moveObservatoryObject,
  moveObservatoryRoom,
  placeObservatoryObject,
  placeObservatoryRoomTemplate,
  resizeObservatoryRoom,
  setObservatoryRoomFloorCellAsset,
  toggleObservatoryRoomWallCell,
  toggleObservatoryRoomWallCellKind,
  toggleObservatoryRoomWallTile,
} from '@/modules/observatory/engine/world/layoutEditing';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';

function layout() {
  const validation = validateObservatoryLayout(sampleLayout);
  if (!validation.layout) {
    throw new Error('Sample layout must be valid for layout editing tests.');
  }

  return validation.layout as ObservatoryLayoutDocument;
}

describe('observatory pixel layout editing', () => {
  it('creates a valid blank canvas from an existing layout', () => {
    const blankLayout = createBlankObservatoryLayout(layout());
    const validation = validateObservatoryLayout(blankLayout);
    const map = validation.layout?.world.maps[0];

    expect(validation.issues).toEqual([]);
    expect(blankLayout.metadata?.status).toBe('draft');
    expect(map?.rooms).toEqual([]);
    expect(map?.objects).toEqual([]);
    expect(map?.agents).toEqual([]);
  });

  it('places an object and infers the containing room', () => {
    const result = placeObservatoryObject(layout(), 'map:main-office', {
      assetId: 'furniture:1-modern-office-singles-48x48:modern-office-multi-monitor-control-station',
      position: { x: 2, y: 9 },
      size: { width: 4, height: 3 },
    });

    expect(result.changed).toBe(true);
    expect(result.selectedObjectId).toBe('object:manual-5');
    expect(result.layout.world.maps[0]?.objects.at(-1)).toMatchObject({
      assetId: 'furniture:1-modern-office-singles-48x48:modern-office-multi-monitor-control-station',
      id: 'object:manual-5',
      roomId: 'room:runtime-floor',
    });
  });

  it('moves an object and updates room assignment', () => {
    const result = moveObservatoryObject(layout(), 'map:main-office', 'object:runtime-desk-1', {
      x: 16,
      y: 9,
    });

    expect(result.changed).toBe(true);
    expect(result.layout.world.maps[0]?.objects[0]).toMatchObject({
      id: 'object:runtime-desk-1',
      position: { x: 16, y: 9 },
      roomId: 'room:workflow-pod',
    });
  });

  it('deletes an object without mutating the source layout', () => {
    const sourceLayout = layout();
    const result = deleteObservatoryObject(sourceLayout, 'map:main-office', 'object:commons-orb');

    expect(result.changed).toBe(true);
    expect(
      result.layout.world.maps[0]?.objects.some((object) => object.id === 'object:commons-orb')
    ).toBe(false);
    expect(
      sourceLayout.world.maps[0]?.objects.some((object) => object.id === 'object:commons-orb')
    ).toBe(true);
  });

  it('resizes a room and preserves layout validity', () => {
    const result = resizeObservatoryRoom(layout(), 'map:main-office', 'room:runtime-floor', {
      height: 13,
      width: 14,
      x: 1,
      y: 1,
    });

    expect(result.changed).toBe(true);
    expect(result.layout.world.maps[0]?.rooms[0]?.bounds).toEqual({
      height: 13,
      width: 14,
      x: 1,
      y: 1,
    });
  });

  it('moves a room and keeps its scoped objects aligned', () => {
    const result = moveObservatoryRoom(layout(), 'map:main-office', 'room:runtime-floor', {
      x: 2,
      y: 2,
    });
    const movedRoom = result.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );
    const movedObject = result.layout.world.maps[0]?.objects.find(
      (object) => object.id === 'object:runtime-desk-1'
    );

    expect(result.changed).toBe(true);
    expect(movedRoom?.bounds).toEqual({ height: 12, width: 13, x: 2, y: 2 });
    expect(movedObject?.position).toEqual({ x: 5, y: 6 });
    expect(movedObject?.roomId).toBe('room:runtime-floor');
  });

  it('toggles perimeter wall cells as room openings', () => {
    const opened = toggleObservatoryRoomWallCell(
      layout(),
      'map:main-office',
      'room:runtime-floor',
      { x: 1, y: 1 }
    );
    const reopened = toggleObservatoryRoomWallCell(
      opened.layout,
      'map:main-office',
      'room:runtime-floor',
      { x: 1, y: 1 }
    );

    expect(opened.changed).toBe(true);
    expect(
      opened.layout.world.maps[0]?.rooms.find((room) => room.id === 'room:runtime-floor')
        ?.wallOpenings
    ).toEqual([{ x: 1, y: 1 }]);
    expect(
      reopened.layout.world.maps[0]?.rooms.find((room) => room.id === 'room:runtime-floor')
        ?.wallOpenings
    ).toBeUndefined();
  });

  it('toggles a single corner wall side without removing the whole corner', () => {
    const opened = toggleObservatoryRoomWallCell(
      layout(),
      'map:main-office',
      'room:runtime-floor',
      { wallSide: 'north', x: 1, y: 1 }
    );
    const reopened = toggleObservatoryRoomWallCell(
      opened.layout,
      'map:main-office',
      'room:runtime-floor',
      { wallSide: 'north', x: 1, y: 1 }
    );
    const openedRoom = opened.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );
    const reopenedRoom = reopened.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );

    expect(opened.changed).toBe(true);
    expect(openedRoom?.wallOpenings).toBeUndefined();
    expect(openedRoom?.wallEdgeOpenings).toEqual([{ point: { x: 1, y: 1 }, side: 'north' }]);
    expect(reopenedRoom?.wallEdgeOpenings).toBeUndefined();
  });

  it('toggles a north wall tile while keeping the perimeter border intact', () => {
    const hidden = toggleObservatoryRoomWallTile(
      layout(),
      'map:main-office',
      'room:runtime-floor',
      { wallSide: 'north', x: 1, y: 1 }
    );
    const restored = toggleObservatoryRoomWallTile(
      hidden.layout,
      'map:main-office',
      'room:runtime-floor',
      { wallSide: 'north', x: 1, y: 1 }
    );
    const hiddenRoom = hidden.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );
    const restoredRoom = restored.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );

    expect(hidden.changed).toBe(true);
    expect(hiddenRoom?.wallOpenings).toBeUndefined();
    expect(hiddenRoom?.wallEdgeOpenings).toBeUndefined();
    expect(hiddenRoom?.wallTileOpenings).toEqual([{ point: { x: 1, y: 1 }, side: 'north' }]);
    expect(restoredRoom?.wallTileOpenings).toBeUndefined();
  });

  it('stores per-cell floor overrides inside a room', () => {
    const painted = setObservatoryRoomFloorCellAsset(
      layout(),
      'map:main-office',
      'room:runtime-floor',
      { x: 2, y: 2 },
      'floor:office-gray'
    );
    const reset = setObservatoryRoomFloorCellAsset(
      painted.layout,
      'map:main-office',
      'room:runtime-floor',
      { x: 2, y: 2 },
      'floor:office-blue'
    );

    expect(painted.changed).toBe(true);
    expect(
      painted.layout.world.maps[0]?.rooms.find((room) => room.id === 'room:runtime-floor')
        ?.floorAssetOverrides
    ).toEqual([{ assetId: 'floor:office-gray', point: { x: 2, y: 2 } }]);
    expect(
      reset.layout.world.maps[0]?.rooms.find((room) => room.id === 'room:runtime-floor')
        ?.floorAssetOverrides
    ).toBeUndefined();
  });

  it('updates only the selected room when removing shared wall cells', () => {
    const sourceLayout = layout();
    const workflowPod = sourceLayout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:workflow-pod'
    );

    if (!workflowPod) {
      throw new Error('Expected workflow pod room.');
    }

    workflowPod.bounds.x = 14;
    const opened = toggleObservatoryRoomWallCell(
      sourceLayout,
      'map:main-office',
      'room:runtime-floor',
      { x: 13, y: 5 }
    );
    const runtimeFloor = opened.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );
    const adjacentWorkflowPod = opened.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:workflow-pod'
    );

    expect(opened.changed).toBe(true);
    expect(runtimeFloor?.wallOpenings).toEqual([{ x: 13, y: 5 }]);
    expect(adjacentWorkflowPod?.wallOpenings).toBeUndefined();
  });

  it('toggles perimeter wall cells as room doors while keeping them as openings', () => {
    const opened = toggleObservatoryRoomWallCellKind(
      layout(),
      'map:main-office',
      'room:runtime-floor',
      { x: 1, y: 1 },
      'door'
    );
    const cleared = toggleObservatoryRoomWallCellKind(
      opened.layout,
      'map:main-office',
      'room:runtime-floor',
      { x: 1, y: 1 },
      'door'
    );
    const roomWithDoor = opened.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );
    const roomCleared = cleared.layout.world.maps[0]?.rooms.find(
      (room) => room.id === 'room:runtime-floor'
    );

    expect(opened.changed).toBe(true);
    expect(roomWithDoor?.wallDoors).toEqual([{ x: 1, y: 1 }]);
    expect(roomWithDoor?.wallOpenings).toEqual([{ x: 1, y: 1 }]);
    expect(roomCleared?.wallDoors).toBeUndefined();
    expect(roomCleared?.wallOpenings).toBeUndefined();
  });

  it('rejects wall openings outside the room perimeter', () => {
    const result = toggleObservatoryRoomWallCell(
      layout(),
      'map:main-office',
      'room:runtime-floor',
      { x: 2, y: 2 }
    );

    expect(result.changed).toBe(false);
    expect(result.issues).toEqual([
      { path: 'room.wallOpenings', reason: 'Wall edits must target a room perimeter cell.' },
    ]);
  });

  it('creates a new room with default floor metadata', () => {
    const result = createObservatoryRoom(layout(), 'map:main-office', {
      bounds: { height: 4, width: 5, x: 1, y: 14 },
      kind: 'workspace',
      name: 'Manual QA Room',
      wallAssetId: 'wall:office-partition',
    });

    expect(result.changed).toBe(true);
    expect(result.selectedRoomId).toBe('room:manual-4');
    expect(result.layout.world.maps[0]?.rooms.at(-1)).toMatchObject({
      floorAssetId: 'floor:office-blue',
      id: 'room:manual-4',
      name: 'Manual QA Room',
    });
  });

  it('rejects edits that exceed map bounds', () => {
    const result = createObservatoryRoom(layout(), 'map:main-office', {
      bounds: { height: 4, width: 5, x: 40, y: 16 },
    });

    expect(result.changed).toBe(false);
    expect(result.issues).toEqual([
      { path: 'room.bounds', reason: 'Room must fit inside the map bounds.' },
    ]);
  });

  it('places an engineering room template with scoped objects', () => {
    const result = placeObservatoryRoomTemplate(layout(), 'map:main-office', 'engineering-pod', {
      x: 1,
      y: 14,
    });

    expect(result.changed).toBe(true);
    expect(result.selectedRoomId).toBe('room:engineering-pod-4');
    expect(result.placedTemplate).toEqual({
      objectIds: [
        'object:engineering-pod-1-5',
        'object:engineering-pod-2-6',
        'object:engineering-pod-3-7',
      ],
      roomId: 'room:engineering-pod-4',
    });
    expect(result.layout.world.maps[0]?.rooms.at(-1)).toMatchObject({
      id: 'room:engineering-pod-4',
      name: 'Engineering Pod',
    });
    expect(result.layout.world.maps[0]?.objects.slice(-3).map((object) => object.roomId)).toEqual([
      'room:engineering-pod-4',
      'room:engineering-pod-4',
      'room:engineering-pod-4',
    ]);
  });

  it('places each E2 MVP room template as a valid layout edit', () => {
    const templateIds = [
      'engineering-pod',
      'research-room',
      'finance-room',
      'audit-workspace',
      'meeting-room',
      'ops-center',
      'approval-room',
    ] as const;
    let currentLayout = layout();

    templateIds.forEach((templateId, index) => {
      const result = placeObservatoryRoomTemplate(currentLayout, 'map:main-office', templateId, {
        x: 1 + (index % 4) * 8,
        y: index < 4 ? 14 : 0,
      });
      expect(result.changed).toBe(true);
      currentLayout = result.layout;
    });

    expect(currentLayout.world.maps[0]?.rooms.slice(-7).map((room) => room.name)).toEqual([
      'Engineering Pod',
      'Research Room',
      'Finance Room',
      'Audit Workspace',
      'Meeting Room',
      'Ops Center',
      'Approval Room',
    ]);
  });

  it('creates a procedural corridor room', () => {
    const result = createObservatoryCorridor(layout(), 'map:main-office');

    expect(result.changed).toBe(true);
    expect(result.selectedRoomId).toBe('room:corridor-4');
    expect(result.layout.world.maps[0]?.rooms.at(-1)).toMatchObject({
      bounds: { height: 1, width: 40, x: 1, y: 0 },
      id: 'room:corridor-4',
      name: 'Main Corridor',
    });
  });

  it('relocates manual objects to a collision-safe placement', () => {
    const result = placeObservatoryObject(layout(), 'map:main-office', {
      assetId: 'furniture:1-modern-office-singles-48x48:modern-office-gray-runtime-server-tower',
      position: { x: 4, y: 5 },
      size: { height: 1, width: 1 },
    });

    expect(result.changed).toBe(true);
    expect(result.layout.world.maps[0]?.objects.at(-1)?.position).toEqual({ x: 0, y: 0 });
  });

  it('applies procedural rules by placing doors and validating generated layout quality', () => {
    const result = applyObservatoryProceduralLayoutRules(layout(), 'map:main-office');

    expect(result.changed).toBe(true);
    expect(result.message).toBe('Applied procedural rules: 3 doors placed and layout is walkable.');
    expect(result.layout.world.maps[0]?.objects.slice(-3).map((object) => object.id)).toEqual([
      'object:door-runtime-floor-5',
      'object:door-workflow-pod-5',
      'object:door-commons-5',
    ]);
  });
});
