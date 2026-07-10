import type {
  ObservatoryAssetDefinition,
  ObservatoryCharacterActionDefinition,
  ObservatoryCharacterActionName,
  ObservatoryCharacterDirection,
} from '@/modules/observatory/engine/assets/assetRegistry';

export interface ObservatoryCharacterActionManifestIssue {
  action: string;
  reason: string;
}

const directionalActionFrameCounts: Partial<Record<ObservatoryCharacterActionName, number>> = {
  gift: 10,
  'grab-gun': 4,
  'gun-idle': 6,
  hit: 6,
  hurt: 3,
  lift: 14,
  'pick-up': 12,
  punch: 6,
  'push-cart': 6,
  shoot: 3,
  stab: 6,
  throw: 14,
  face: 1,
  idle: 6,
  walk: 6,
};

const twoDirectionActionOrder: Partial<
  Record<ObservatoryCharacterActionName, ObservatoryCharacterDirection[]>
> = {
  'high-chair-sit': ['right', 'left'],
  sit: ['right', 'left'],
};

export function validateObservatoryCharacterActionManifest(
  asset: ObservatoryAssetDefinition
): ObservatoryCharacterActionManifestIssue[] {
  if (!asset.characterActions?.length) {
    return [];
  }

  const columns = asset.characterSheet?.columns;
  const directionOrder = asset.characterSheet?.directionOrder;
  const issues: ObservatoryCharacterActionManifestIssue[] = [];

  if (!columns) {
    issues.push({
      action: asset.id,
      reason: 'characterSheet.columns is required when characterActions are present',
    });
    return issues;
  }

  for (const action of asset.characterActions) {
    issues.push(...validateActionWindow(action, columns, directionOrder));
  }

  return issues;
}

function validateActionWindow(
  action: ObservatoryCharacterActionDefinition,
  columns: number,
  directionOrder: ObservatoryCharacterDirection[] | undefined
): ObservatoryCharacterActionManifestIssue[] {
  const issues: ObservatoryCharacterActionManifestIssue[] = [];
  const expectedFrameCount = directionalActionFrameCounts[action.action];

  if (
    expectedFrameCount !== undefined &&
    action.direction &&
    action.frameCount !== expectedFrameCount
  ) {
    issues.push({
      action: action.action,
      reason: `expected ${expectedFrameCount} frames for ${action.action}/${action.direction}, got ${action.frameCount}`,
    });
  }

  if (action.direction && directionOrder) {
    const effectiveDirectionOrder = twoDirectionActionOrder[action.action] ?? directionOrder;
    const directionIndex = effectiveDirectionOrder.indexOf(action.direction);
    const expectedStartFrame = (action.row - 1) * columns + directionIndex * action.frameCount;

    if (directionIndex === -1) {
      issues.push({ action: action.action, reason: `unsupported direction ${action.direction}` });
    } else if (action.startFrame !== expectedStartFrame) {
      issues.push({
        action: action.action,
        reason: `expected startFrame ${expectedStartFrame} for ${action.action}/${action.direction}, got ${action.startFrame}`,
      });
    }
  }

  if (action.endFrame !== action.startFrame + action.frameCount - 1) {
    issues.push({
      action: action.action,
      reason: `expected endFrame ${action.startFrame + action.frameCount - 1}, got ${action.endFrame}`,
    });
  }

  if (
    action.loopStartFrame !== undefined &&
    action.loopEndFrame !== undefined &&
    (action.loopStartFrame < action.startFrame ||
      action.loopEndFrame > action.endFrame ||
      action.loopEndFrame < action.loopStartFrame)
  ) {
    issues.push({
      action: action.action,
      reason: 'loop window must be inside action frame window',
    });
  }

  return issues;
}
