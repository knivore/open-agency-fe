import type { ObservatoryLayoutDocument } from './layoutTypes';
export function observatoryLayoutContentKey(layout: ObservatoryLayoutDocument) {
  // Save/deploy timestamps change independently of what the user is editing.
  return JSON.stringify({
    world: layout.world,
    name: layout.metadata?.name ?? layout.world.name,
    notes: layout.metadata?.notes ?? '',
  });
}
