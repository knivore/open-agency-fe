export const OBSERVATORY_ASSET_REGISTRY_VERSION = 1;

export const OBSERVATORY_FALLBACK_TEXTURE_KEY = 'observatory:fallback-texture';

export type ObservatoryAssetCategory = 'floor' | 'wall' | 'furniture' | 'decor' | 'human';

export type ObservatoryAssetSourceKind = 'image' | 'spritesheet';

export type ObservatoryAutotileKind = 'rpgmaker-a2-ground' | 'rpgmaker-a4-wall';

export interface ObservatoryAssetSource {
  kind: ObservatoryAssetSourceKind;
  uri: string;
  frameWidth?: number;
  frameHeight?: number;
}

export interface ObservatoryAssetSourceCrop {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ObservatoryAssetAnimation {
  key: string;
  startFrame: number;
  endFrame: number;
  frameRate: number;
  repeat?: number;
}

export type ObservatoryAssetStatusAnimationKey = 'blocked' | 'complete' | 'error' | 'idle' | 'moving' | 'working';

export type ObservatoryCharacterDirection = 'down' | 'left' | 'right' | 'up';

export type ObservatoryCharacterActionName =
  | 'face'
  | 'gift'
  | 'grab-gun'
  | 'gun-idle'
  | 'high-chair-sit'
  | 'hit'
  | 'hurt'
  | 'idle'
  | 'lift'
  | 'phone'
  | 'pick-up'
  | 'punch'
  | 'push-cart'
  | 'reading'
  | 'shoot'
  | 'sit'
  | 'sleep'
  | 'stab'
  | 'throw'
  | 'walk';

export type ObservatoryCharacterActionPriority = 'documented' | 'office';

export interface ObservatoryCharacterActionDefinition {
  action: ObservatoryCharacterActionName;
  row: number;
  frameCount: number;
  startFrame: number;
  endFrame: number;
  direction?: ObservatoryCharacterDirection;
  frameRate?: number;
  loopStartFrame?: number;
  loopEndFrame?: number;
  playOnce?: boolean;
  priority?: ObservatoryCharacterActionPriority;
}

export interface ObservatoryCharacterSheetDefinition {
  columns: number;
  directionOrder?: ObservatoryCharacterDirection[];
}

export interface ObservatoryAutotileDefinition {
  columns: number;
  kind: ObservatoryAutotileKind;
  set: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  sourceLayout?: {
    blockCount?: number;
    blockWidth?: number;
    colorKey?: string | null;
    faceY?: number;
    topY?: number;
    x?: number;
  };
  tileSize: number;
}

export interface ObservatoryAssetDefinition {
  id: string;
  catalogPath?: string;
  category: ObservatoryAssetCategory;
  label: string;
  source: ObservatoryAssetSource;
  previewCrop?: ObservatoryAssetSourceCrop;
  sourceCrop?: ObservatoryAssetSourceCrop;
  frame?: number;
  animation?: ObservatoryAssetAnimation;
  animations?: ObservatoryAssetAnimation[];
  autotile?: ObservatoryAutotileDefinition;
  characterActions?: ObservatoryCharacterActionDefinition[];
  characterSheet?: ObservatoryCharacterSheetDefinition;
  width?: number;
  height?: number;
  anchor?: {
    x: number;
    y: number;
  };
  collision?: {
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
  };
  semanticId?: string;
  statusAnimations?: Partial<Record<ObservatoryAssetStatusAnimationKey, string>>;
  tags?: string[];
}

export interface ObservatoryAssetRegistry {
  registryVersion: number;
  assetPackVersion: string;
  assets: ObservatoryAssetDefinition[];
}

export interface ObservatoryInvalidAsset {
  assetId: string;
  reason: string;
}

export interface ObservatoryValidatedAssetRegistry {
  registryVersion: number;
  assetPackVersion: string;
  assets: ObservatoryAssetDefinition[];
  invalidAssets: ObservatoryInvalidAsset[];
}

const assetCategories = new Set<ObservatoryAssetCategory>(['floor', 'wall', 'furniture', 'decor', 'human']);
const autotileKinds = new Set<ObservatoryAutotileKind>(['rpgmaker-a2-ground', 'rpgmaker-a4-wall']);
const sourceKinds = new Set<ObservatoryAssetSourceKind>(['image', 'spritesheet']);
const characterActions = new Set<ObservatoryCharacterActionName>([
  'face',
  'gift',
  'grab-gun',
  'gun-idle',
  'high-chair-sit',
  'hit',
  'hurt',
  'idle',
  'lift',
  'phone',
  'pick-up',
  'punch',
  'push-cart',
  'reading',
  'shoot',
  'sit',
  'sleep',
  'stab',
  'throw',
  'walk',
]);
const characterDirections = new Set<ObservatoryCharacterDirection>(['down', 'left', 'right', 'up']);
const characterPriorities = new Set<ObservatoryCharacterActionPriority>(['documented', 'office']);
const statusAnimationKeys = new Set<ObservatoryAssetStatusAnimationKey>([
  'blocked',
  'complete',
  'error',
  'idle',
  'moving',
  'working',
]);
const assetIdPattern = /^[a-z0-9][a-z0-9:-]*$/;
const semanticIdPattern = /^[a-z0-9][a-z0-9:-]*$/;
const maxAssetUriLength = 32_768;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isOptionalPositiveNumber(value: unknown): value is number | undefined {
  return value === undefined || isPositiveNumber(value);
}

function isOptionalPositiveInteger(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

function isOptionalNonNegativeInteger(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0);
}

function isOptionalStringOrNull(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validateAssetAnchor(value: unknown): { anchor?: ObservatoryAssetDefinition['anchor']; reason?: string } {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return { reason: 'anchor must be an object when present' };
  }

  if (!isFiniteNumber(value.x) || value.x < 0 || value.x > 1 || !isFiniteNumber(value.y) || value.y < 0 || value.y > 1) {
    return { reason: 'anchor.x and anchor.y must be numbers between 0 and 1' };
  }

  return { anchor: { x: value.x, y: value.y } };
}

function validateAssetCollision(value: unknown): { collision?: ObservatoryAssetDefinition['collision']; reason?: string } {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return { reason: 'collision must be an object when present' };
  }

  if (!isPositiveNumber(value.width) || !isPositiveNumber(value.height)) {
    return { reason: 'collision.width and collision.height must be positive numbers' };
  }

  if (value.offsetX !== undefined && !isFiniteNumber(value.offsetX)) {
    return { reason: 'collision.offsetX must be a finite number when present' };
  }

  if (value.offsetY !== undefined && !isFiniteNumber(value.offsetY)) {
    return { reason: 'collision.offsetY must be a finite number when present' };
  }

  return {
    collision: {
      width: value.width,
      height: value.height,
      offsetX: value.offsetX,
      offsetY: value.offsetY,
    },
  };
}

function validateAssetAnimation(value: unknown): { animation?: ObservatoryAssetAnimation; reason?: string } {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return { reason: 'animation must be an object when present' };
  }

  if (typeof value.key !== 'string' || value.key.length === 0) {
    return { reason: 'animation.key must be a non-empty string' };
  }

  if (!isNonNegativeInteger(value.startFrame)) {
    return { reason: 'animation.startFrame must be a non-negative integer' };
  }

  if (!isNonNegativeInteger(value.endFrame) || value.endFrame < value.startFrame) {
    return { reason: 'animation.endFrame must be greater than or equal to startFrame' };
  }

  if (!isPositiveNumber(value.frameRate)) {
    return { reason: 'animation.frameRate must be a positive number' };
  }

  if (value.repeat !== undefined && (typeof value.repeat !== 'number' || !Number.isInteger(value.repeat) || value.repeat < -1)) {
    return { reason: 'animation.repeat must be an integer >= -1 when present' };
  }

  return {
    animation: {
      key: value.key,
      startFrame: value.startFrame,
      endFrame: value.endFrame,
      frameRate: value.frameRate,
      repeat: value.repeat,
    },
  };
}

function validateAssetAnimations(value: unknown): { animations?: ObservatoryAssetAnimation[]; reason?: string } {
  if (value === undefined) {
    return {};
  }

  if (!Array.isArray(value)) {
    return { reason: 'animations must be an array when present' };
  }

  const animations: ObservatoryAssetAnimation[] = [];
  const seenKeys = new Set<string>();

  for (const animationCandidate of value) {
    const result = validateAssetAnimation(animationCandidate);

    if (!result.animation) {
      return { reason: result.reason ?? 'animation entry is invalid' };
    }

    if (seenKeys.has(result.animation.key)) {
      return { reason: `duplicate animation key ${result.animation.key}` };
    }

    seenKeys.add(result.animation.key);
    animations.push(result.animation);
  }

  return { animations };
}

function validateStatusAnimations(value: unknown): {
  reason?: string;
  statusAnimations?: ObservatoryAssetDefinition['statusAnimations'];
} {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return { reason: 'statusAnimations must be an object when present' };
  }

  const statusAnimations: Partial<Record<ObservatoryAssetStatusAnimationKey, string>> = {};

  for (const [status, animationKey] of Object.entries(value)) {
    if (!statusAnimationKeys.has(status as ObservatoryAssetStatusAnimationKey)) {
      return { reason: `statusAnimations contains unsupported status ${status}` };
    }

    if (typeof animationKey !== 'string' || animationKey.length === 0) {
      return { reason: `statusAnimations.${status} must be a non-empty string` };
    }

    statusAnimations[status as ObservatoryAssetStatusAnimationKey] = animationKey;
  }

  return { statusAnimations };
}

function validateCharacterAction(value: unknown): { action?: ObservatoryCharacterActionDefinition; reason?: string } {
  if (!isRecord(value)) {
    return { reason: 'character action must be an object' };
  }

  if (typeof value.action !== 'string' || !characterActions.has(value.action as ObservatoryCharacterActionName)) {
    return { reason: 'character action is not supported' };
  }

  if (value.direction !== undefined && (typeof value.direction !== 'string' || !characterDirections.has(value.direction as ObservatoryCharacterDirection))) {
    return { reason: 'character action direction is not supported' };
  }

  if (!isPositiveNumber(value.row) || !Number.isInteger(value.row)) {
    return { reason: 'character action row must be a positive integer' };
  }

  if (!isPositiveNumber(value.frameCount) || !Number.isInteger(value.frameCount)) {
    return { reason: 'character action frameCount must be a positive integer' };
  }

  if (!isNonNegativeInteger(value.startFrame)) {
    return { reason: 'character action startFrame must be a non-negative integer' };
  }

  if (!isNonNegativeInteger(value.endFrame) || value.endFrame < value.startFrame) {
    return { reason: 'character action endFrame must be greater than or equal to startFrame' };
  }

  if (value.frameRate !== undefined && !isPositiveNumber(value.frameRate)) {
    return { reason: 'character action frameRate must be positive when present' };
  }

  if (value.loopStartFrame !== undefined && !isNonNegativeInteger(value.loopStartFrame)) {
    return { reason: 'character action loopStartFrame must be a non-negative integer when present' };
  }

  if (value.loopEndFrame !== undefined && !isNonNegativeInteger(value.loopEndFrame)) {
    return { reason: 'character action loopEndFrame must be a non-negative integer when present' };
  }

  if (
    (value.loopStartFrame !== undefined || value.loopEndFrame !== undefined) &&
    (value.loopStartFrame === undefined ||
      value.loopEndFrame === undefined ||
      value.loopStartFrame < value.startFrame ||
      value.loopEndFrame > value.endFrame ||
      value.loopEndFrame < value.loopStartFrame)
  ) {
    return { reason: 'character action loop window must be inside startFrame/endFrame' };
  }

  if (value.playOnce !== undefined && typeof value.playOnce !== 'boolean') {
    return { reason: 'character action playOnce must be a boolean when present' };
  }

  if (value.priority !== undefined && (typeof value.priority !== 'string' || !characterPriorities.has(value.priority as ObservatoryCharacterActionPriority))) {
    return { reason: 'character action priority is not supported' };
  }

  return {
    action: {
      action: value.action as ObservatoryCharacterActionName,
      direction: value.direction as ObservatoryCharacterDirection | undefined,
      endFrame: value.endFrame,
      frameCount: value.frameCount,
      frameRate: value.frameRate,
      loopEndFrame: value.loopEndFrame,
      loopStartFrame: value.loopStartFrame,
      playOnce: value.playOnce,
      priority: value.priority as ObservatoryCharacterActionPriority | undefined,
      row: value.row,
      startFrame: value.startFrame,
    },
  };
}

function validateCharacterActions(value: unknown): { actions?: ObservatoryCharacterActionDefinition[]; reason?: string } {
  if (value === undefined) {
    return {};
  }

  if (!Array.isArray(value)) {
    return { reason: 'characterActions must be an array when present' };
  }

  const actions: ObservatoryCharacterActionDefinition[] = [];
  const seenKeys = new Set<string>();

  for (const actionCandidate of value) {
    const result = validateCharacterAction(actionCandidate);

    if (!result.action) {
      return { reason: result.reason ?? 'character action entry is invalid' };
    }

    const key = `${result.action.action}:${result.action.direction ?? 'all'}:${result.action.startFrame}:${result.action.endFrame}`;
    if (seenKeys.has(key)) {
      return { reason: `duplicate character action ${key}` };
    }

    seenKeys.add(key);
    actions.push(result.action);
  }

  return { actions };
}

function validateCharacterSheet(value: unknown): { reason?: string; sheet?: ObservatoryCharacterSheetDefinition } {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return { reason: 'characterSheet must be an object when present' };
  }

  if (!isPositiveNumber(value.columns) || !Number.isInteger(value.columns)) {
    return { reason: 'characterSheet.columns must be a positive integer' };
  }

  if (
    value.directionOrder !== undefined &&
    (!Array.isArray(value.directionOrder) ||
      value.directionOrder.some((direction) => typeof direction !== 'string' || !characterDirections.has(direction as ObservatoryCharacterDirection)))
  ) {
    return { reason: 'characterSheet.directionOrder must contain supported directions' };
  }

  return {
    sheet: {
      columns: value.columns,
      directionOrder: Array.isArray(value.directionOrder)
        ? (value.directionOrder as ObservatoryCharacterDirection[])
        : undefined,
    },
  };
}

function validateAutotile(value: unknown): { autotile?: ObservatoryAutotileDefinition; reason?: string } {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return { reason: 'autotile must be an object when present' };
  }

  if (typeof value.kind !== 'string' || !autotileKinds.has(value.kind as ObservatoryAutotileKind)) {
    return { reason: 'autotile.kind is not supported' };
  }

  if (!isPositiveNumber(value.tileSize) || !Number.isInteger(value.tileSize)) {
    return { reason: 'autotile.tileSize must be a positive integer' };
  }

  if (!isPositiveNumber(value.columns) || !Number.isInteger(value.columns)) {
    return { reason: 'autotile.columns must be a positive integer' };
  }

  if (!isRecord(value.set)) {
    return { reason: 'autotile.set must be an object' };
  }

  if (
    !isNonNegativeInteger(value.set.x) ||
    !isNonNegativeInteger(value.set.y) ||
    !isPositiveNumber(value.set.width) ||
    !Number.isInteger(value.set.width) ||
    !isPositiveNumber(value.set.height) ||
    !Number.isInteger(value.set.height)
  ) {
    return { reason: 'autotile.set must include non-negative x/y and positive integer width/height' };
  }

  if (value.sourceLayout !== undefined && !isRecord(value.sourceLayout)) {
    return { reason: 'autotile.sourceLayout must be an object when present' };
  }

  if (
    isRecord(value.sourceLayout) &&
    (
      !isOptionalNonNegativeInteger(value.sourceLayout.x) ||
      !isOptionalNonNegativeInteger(value.sourceLayout.topY) ||
      !isOptionalNonNegativeInteger(value.sourceLayout.faceY) ||
      !isOptionalPositiveInteger(value.sourceLayout.blockWidth) ||
      !isOptionalPositiveInteger(value.sourceLayout.blockCount) ||
      !isOptionalStringOrNull(value.sourceLayout.colorKey)
    )
  ) {
    return { reason: 'autotile.sourceLayout must use non-negative integer offsets, positive integer sizes/counts, and optional string colorKey' };
  }

  const sourceLayout = isRecord(value.sourceLayout)
    ? {
        blockCount: value.sourceLayout.blockCount as number | undefined,
        blockWidth: value.sourceLayout.blockWidth as number | undefined,
        colorKey: value.sourceLayout.colorKey as string | null | undefined,
        faceY: value.sourceLayout.faceY as number | undefined,
        topY: value.sourceLayout.topY as number | undefined,
        x: value.sourceLayout.x as number | undefined,
      }
    : undefined;

  return {
    autotile: {
      columns: value.columns,
      kind: value.kind as ObservatoryAutotileKind,
      set: {
        height: value.set.height,
        width: value.set.width,
        x: value.set.x,
        y: value.set.y,
      },
      sourceLayout,
      tileSize: value.tileSize,
    },
  };
}

function validateAssetSource(value: unknown): { source?: ObservatoryAssetSource; reason?: string } {
  if (!isRecord(value)) {
    return { reason: 'source must be an object' };
  }

  if (typeof value.kind !== 'string' || !sourceKinds.has(value.kind as ObservatoryAssetSourceKind)) {
    return { reason: 'source.kind must be image or spritesheet' };
  }

  const sourceKind = value.kind as ObservatoryAssetSourceKind;

  if (typeof value.uri !== 'string' || value.uri.length === 0 || value.uri.length > maxAssetUriLength) {
    return { reason: `source.uri must be a non-empty string up to ${maxAssetUriLength} characters` };
  }

  if (!isOptionalPositiveNumber(value.frameWidth) || !isOptionalPositiveNumber(value.frameHeight)) {
    return { reason: 'source frame dimensions must be positive numbers when present' };
  }

  if (sourceKind === 'spritesheet' && (!isPositiveNumber(value.frameWidth) || !isPositiveNumber(value.frameHeight))) {
    return { reason: 'spritesheet assets require frameWidth and frameHeight' };
  }

  return {
    source: {
      kind: sourceKind,
      uri: value.uri,
      frameWidth: value.frameWidth,
      frameHeight: value.frameHeight,
    },
  };
}

function validateAssetSourceCrop(value: unknown): { sourceCrop?: ObservatoryAssetSourceCrop; reason?: string } {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    return { reason: 'sourceCrop must be an object when present' };
  }

  if (
    !isNonNegativeInteger(value.x) ||
    !isNonNegativeInteger(value.y) ||
    !isPositiveNumber(value.width) ||
    !Number.isInteger(value.width) ||
    !isPositiveNumber(value.height) ||
    !Number.isInteger(value.height)
  ) {
    return { reason: 'sourceCrop must include non-negative x/y and positive integer width/height' };
  }

  return {
    sourceCrop: {
      height: value.height,
      width: value.width,
      x: value.x,
      y: value.y,
    },
  };
}

function validateAsset(value: unknown): { asset?: ObservatoryAssetDefinition; invalidAsset?: ObservatoryInvalidAsset } {
  if (!isRecord(value)) {
    return { invalidAsset: { assetId: 'unknown', reason: 'asset must be an object' } };
  }

  const assetId = typeof value.id === 'string' ? value.id : 'unknown';

  if (!assetIdPattern.test(assetId)) {
    return { invalidAsset: { assetId, reason: 'id must use lowercase letters, numbers, colon, or dash' } };
  }

  if (value.catalogPath !== undefined && (typeof value.catalogPath !== 'string' || value.catalogPath.length === 0)) {
    return { invalidAsset: { assetId, reason: 'catalogPath must be a non-empty string when present' } };
  }

  if (typeof value.category !== 'string' || !assetCategories.has(value.category as ObservatoryAssetCategory)) {
    return { invalidAsset: { assetId, reason: 'category is not supported' } };
  }

  if (typeof value.label !== 'string' || value.label.length === 0) {
    return { invalidAsset: { assetId, reason: 'label must be a non-empty string' } };
  }

  const sourceResult = validateAssetSource(value.source);

  if (!sourceResult.source) {
    return { invalidAsset: { assetId, reason: sourceResult.reason ?? 'source is invalid' } };
  }

  const sourceCropResult = validateAssetSourceCrop(value.sourceCrop);

  if (sourceCropResult.reason) {
    return { invalidAsset: { assetId, reason: sourceCropResult.reason } };
  }

  const previewCropResult = validateAssetSourceCrop(value.previewCrop);

  if (previewCropResult.reason) {
    return { invalidAsset: { assetId, reason: `previewCrop ${previewCropResult.reason}` } };
  }

  if (!isOptionalPositiveNumber(value.width) || !isOptionalPositiveNumber(value.height)) {
    return { invalidAsset: { assetId, reason: 'asset dimensions must be positive numbers when present' } };
  }

  if (!isOptionalNonNegativeInteger(value.frame)) {
    return { invalidAsset: { assetId, reason: 'frame must be a non-negative integer when present' } };
  }

  const animationResult = validateAssetAnimation(value.animation);

  if (animationResult.reason) {
    return { invalidAsset: { assetId, reason: animationResult.reason } };
  }

  const animationsResult = validateAssetAnimations(value.animations);

  if (animationsResult.reason) {
    return { invalidAsset: { assetId, reason: animationsResult.reason } };
  }

  const statusAnimationsResult = validateStatusAnimations(value.statusAnimations);

  if (statusAnimationsResult.reason) {
    return { invalidAsset: { assetId, reason: statusAnimationsResult.reason } };
  }

  const characterActionsResult = validateCharacterActions(value.characterActions);

  if (characterActionsResult.reason) {
    return { invalidAsset: { assetId, reason: characterActionsResult.reason } };
  }

  const characterSheetResult = validateCharacterSheet(value.characterSheet);

  if (characterSheetResult.reason) {
    return { invalidAsset: { assetId, reason: characterSheetResult.reason } };
  }

  const autotileResult = validateAutotile(value.autotile);

  if (autotileResult.reason) {
    return { invalidAsset: { assetId, reason: autotileResult.reason } };
  }

  const anchorResult = validateAssetAnchor(value.anchor);

  if (anchorResult.reason) {
    return { invalidAsset: { assetId, reason: anchorResult.reason } };
  }

  const collisionResult = validateAssetCollision(value.collision);

  if (collisionResult.reason) {
    return { invalidAsset: { assetId, reason: collisionResult.reason } };
  }

  if (value.semanticId !== undefined && (typeof value.semanticId !== 'string' || !semanticIdPattern.test(value.semanticId))) {
    return { invalidAsset: { assetId, reason: 'semanticId must use lowercase letters, numbers, colon, or dash' } };
  }

  return {
    asset: {
      id: assetId,
      catalogPath: value.catalogPath,
      category: value.category as ObservatoryAssetCategory,
      label: value.label,
      source: sourceResult.source,
      previewCrop: previewCropResult.sourceCrop,
      sourceCrop: sourceCropResult.sourceCrop,
      frame: value.frame,
      animation: animationResult.animation,
      animations: animationsResult.animations,
      autotile: autotileResult.autotile,
      characterActions: characterActionsResult.actions,
      characterSheet: characterSheetResult.sheet,
      width: value.width,
      height: value.height,
      anchor: anchorResult.anchor,
      collision: collisionResult.collision,
      semanticId: value.semanticId,
      statusAnimations: statusAnimationsResult.statusAnimations,
      tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    },
  };
}

export function createObservatoryAssetLookup(registry: ObservatoryValidatedAssetRegistry) {
  return new Map(registry.assets.map((asset) => [asset.id, asset]));
}

export function filterObservatoryAssetRegistry(
  registry: ObservatoryValidatedAssetRegistry,
  assetIds: Iterable<string>,
): ObservatoryValidatedAssetRegistry {
  const requestedIds = new Set(assetIds);

  return {
    ...registry,
    assets: registry.assets.filter((asset) => requestedIds.has(asset.id)),
  };
}

export function createObservatoryCharacterActionAnimationKey(
  assetId: string,
  action: ObservatoryCharacterActionName,
  direction?: ObservatoryCharacterDirection,
) {
  return `${assetId}:action:${action}:${direction ?? 'all'}`;
}

export function validateObservatoryAssetRegistry(registry: unknown): ObservatoryValidatedAssetRegistry {
  if (!isRecord(registry)) {
    return {
      registryVersion: OBSERVATORY_ASSET_REGISTRY_VERSION,
      assetPackVersion: 'invalid',
      assets: [],
      invalidAssets: [{ assetId: 'registry', reason: 'registry must be an object' }],
    };
  }

  const invalidAssets: ObservatoryInvalidAsset[] = [];
  const assets: ObservatoryAssetDefinition[] = [];

  if (registry.registryVersion !== OBSERVATORY_ASSET_REGISTRY_VERSION) {
    invalidAssets.push({
      assetId: 'registry',
      reason: `unsupported registryVersion ${String(registry.registryVersion)}`,
    });
  }

  if (typeof registry.assetPackVersion !== 'string' || registry.assetPackVersion.length === 0) {
    invalidAssets.push({ assetId: 'registry', reason: 'assetPackVersion must be a non-empty string' });
  }

  if (!Array.isArray(registry.assets)) {
    invalidAssets.push({ assetId: 'registry', reason: 'assets must be an array' });
  } else {
    const seenIds = new Set<string>();

    for (const assetCandidate of registry.assets) {
      const result = validateAsset(assetCandidate);

      if (result.invalidAsset) {
        invalidAssets.push(result.invalidAsset);
        continue;
      }

      if (!result.asset) {
        continue;
      }

      if (seenIds.has(result.asset.id)) {
        invalidAssets.push({ assetId: result.asset.id, reason: 'duplicate asset id' });
        continue;
      }

      seenIds.add(result.asset.id);
      assets.push(result.asset);
    }
  }

  return {
    registryVersion:
      registry.registryVersion === OBSERVATORY_ASSET_REGISTRY_VERSION
        ? registry.registryVersion
        : OBSERVATORY_ASSET_REGISTRY_VERSION,
    assetPackVersion: typeof registry.assetPackVersion === 'string' ? registry.assetPackVersion : 'invalid',
    assets,
    invalidAssets,
  };
}
