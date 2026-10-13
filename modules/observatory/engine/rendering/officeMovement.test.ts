import { describe, expect, it } from 'vitest';
import published from '../../layouts/publishedLayout.json';
import { getObservatoryFullModuleAssetRegistry } from '../assets/moduleFullAssetRegistry';
import { cloneObservatoryLayout } from '../world/layoutEditing';
import type { ObservatoryMap, ObservatoryLayoutDocument } from '../world/layoutTypes';
import { pointInGridRect } from '../world/grid';
import { observatoryObjectVisibleBounds } from '../world/objectGeometry';
import {
  isObservatoryGridWalkable,
  pickObservatoryAgentBehaviorTargetPoint,
  pickObservatoryRoomRoamPoint,
  resolveObservatoryGridPath,
  resolveObservatoryObjectInteraction,
} from './agentBehaviorTargets';
import { createOfficeWalkthroughStops, resolveOfficeWalkthroughStop } from './officeWalkthrough';

const assets = new Map(
  getObservatoryFullModuleAssetRegistry().assets.map((asset) => [asset.id, asset])
);
const maps = (published as ObservatoryLayoutDocument).world.maps;
describe('furnished office movement', () => {
  for (const map of maps) {
    describe(map.name, () => {
      for (const room of map.rooms) {
        it(`routes from ${room.name} to every room and workstation`, () => {
          const start = pickObservatoryRoomRoamPoint(map, room, {
            assetsById: assets,
            seed: room.id,
          });
          expect(start).not.toBeNull();
          const targets = map.rooms.map((targetRoom) =>
            pickObservatoryRoomRoamPoint(map, targetRoom, { assetsById: assets, fromPoint: start! })
          );
          targets.push(
            ...map.objects
              .filter((object) => object.runtime?.role === 'workstation')
              .map(
                (object) =>
                  resolveObservatoryObjectInteraction(map, object, {
                    assetsById: assets,
                    fromPoint: start!,
                  })?.point ?? null
              )
          );
          targets.forEach((target) => {
            expect(target, JSON.stringify({ from: start, room: room.name })).not.toBeNull();
            const path = resolveObservatoryGridPath(map, start!, target!, assets);
            expect(path.length > 0 || (start!.x === target!.x && start!.y === target!.y)).toBe(
              true
            );
            let previous = start!;
            path.forEach((point) => {
              expect(isObservatoryGridWalkable(map, point, assets)).toBe(true);
              expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)).toBe(1);
              previous = point;
            });
          });
        });
      }
      it('centers agents on available chairs and faces the desk', () => {
        const desks = map.objects.filter((object) => object.runtime?.role === 'workstation');
        for (const desk of desks) {
          const interaction = resolveObservatoryObjectInteraction(map, desk, {
            assetsById: assets,
          });
          expect(interaction, desk.id).not.toBeNull();
          const seat = map.objects.find(
            (object) =>
              object.runtime?.targetObjectId === desk.id &&
              object.runtime.role === 'workstation-seat'
          )!;
          const bounds = observatoryObjectVisibleBounds(seat, assets.get(seat.assetId), 48);
          const footX = (interaction!.point.x + 0.5) * 48 + interaction!.offsetPx.x;
          expect(footX, desk.id).toBeCloseTo(bounds.x + bounds.width / 2);
          expect(interaction!.direction, desk.id).toBe('up');
          expect(interaction!.action, desk.id).toBe('idle');
        }
      });
      it('completes a route through every walkthrough stop without teleporting', () => {
        const stops = createOfficeWalkthroughStops(map);
        expect(new Set(stops.map((stop) => stop.roomId)).size).toBe(map.rooms.length);
        expect(
          stops.filter(
            (stop) =>
              stop.objectId &&
              map.objects.find((object) => object.id === stop.objectId)?.runtime?.role ===
                'workstation'
          )
        ).toHaveLength(
          map.objects.filter((object) => object.runtime?.role === 'workstation').length
        );
        let from = map.agents[0].position;
        for (const stop of stops) {
          const interaction = resolveOfficeWalkthroughStop(map, stop, from, assets, 48);
          expect(interaction, stop.label).not.toBeNull();
          expect(
            resolveObservatoryGridPath(map, from, interaction!.point, assets).length > 0 ||
              (from.x === interaction!.point.x && from.y === interaction!.point.y),
            stop.label
          ).toBe(true);
          from = interaction!.point;
        }
      });
    });
  }
  it('does not follow a previous room workstation when entering the pantry', () => {
    const map = cloneObservatoryLayout(published as ObservatoryLayoutDocument).world.maps[0];
    const room = map.rooms.find((room) => room.name === 'Pantry')!;
    const point = pickObservatoryAgentBehaviorTargetPoint(map, {
      agentId: map.agents[0].id,
      targetRoomId: room.id,
      assetsById: assets,
      fromPoint: map.agents[0].position,
    });
    expect(point).not.toBeNull();
    expect(pointInGridRect(point!, room.bounds)).toBe(true);
  });
  it('returns no interaction point for a disconnected room', () => {
    const map: ObservatoryMap = {
      id: 'map:test',
      name: 'Test',
      defaultFloorAssetId: 'floor:test',
      size: { width: 18, height: 8 },
      agents: [],
      rooms: [
        { id: 'room:a', name: 'A', kind: 'workspace', bounds: { x: 0, y: 0, width: 7, height: 8 } },
        {
          id: 'room:b',
          name: 'B',
          kind: 'workspace',
          bounds: { x: 10, y: 0, width: 7, height: 8 },
        },
      ],
      objects: [
        {
          id: 'object:desk',
          assetId: 'furniture:desk',
          position: { x: 12, y: 2 },
          size: { width: 2, height: 2 },
          roomId: 'room:b',
          blocksMovement: true,
        },
      ],
    };
    expect(
      resolveObservatoryObjectInteraction(map, map.objects[0], { fromPoint: { x: 2, y: 3 } })
    ).toBeNull();
  });
  it('avoids stopping on another agent at a workstation', () => {
    const map = maps[0];
    const desk = map.objects.find((object) => object.runtime?.role === 'workstation')!;
    const preferred = resolveObservatoryObjectInteraction(map, desk, { assetsById: assets })!;
    const other = resolveObservatoryObjectInteraction(map, desk, {
      assetsById: assets,
      occupiedPoints: [preferred.point],
    });
    expect(other).not.toBeNull();
    expect(other!.point).not.toEqual(preferred.point);
  });
  it('keeps adjacent destinations clear of an avatar shifted by its chair offset', () => {
    const map = maps[0];
    const desk = map.objects.find(
      (object) => object.id === 'object:level-1-executive-review-desk'
    )!;
    const preferred = resolveObservatoryObjectInteraction(map, desk, { assetsById: assets })!;
    const feet = {
      x: (preferred.point.x + 0.5) * 48 + preferred.offsetPx.x,
      y: (preferred.point.y + 0.5) * 48 + preferred.offsetPx.y,
    };
    const other = resolveObservatoryObjectInteraction(map, desk, {
      assetsById: assets,
      occupiedPoints: [preferred.point],
      occupiedFootPositions: [feet],
    });
    expect(other).not.toBeNull();
    const x = (other!.point.x + 0.5) * 48 + other!.offsetPx.x;
    const y = (other!.point.y + 0.5) * 48 + other!.offsetPx.y;
    expect(Math.abs(x - feet.x) >= 48 * 0.9 || Math.abs(y - feet.y) >= 48 * 0.6).toBe(true);
  });
});
