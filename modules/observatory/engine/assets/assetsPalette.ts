import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import { observatoryAssetCatalogEntries } from '@/modules/observatory/engine/assets/assetCatalog';

export type ObservatoryPaletteThemeId =
  | 'all'
  | 'office'
  | 'classroom'
  | 'museum'
  | 'retail'
  | 'hospital'
  | 'home'
  | 'kitchen'
  | 'conference'
  | 'basement'
  | 'utility'
  | 'specialty';

export type ObservatoryPaletteRoleId =
  | 'all'
  | 'tables'
  | 'seating'
  | 'storage'
  | 'displays'
  | 'screens'
  | 'decor'
  | 'utility'
  | 'partitions'
  | 'workstations';

export type ObservatoryPaletteSortId = 'recommended' | 'alpha' | 'footprint' | 'pack';

export type ObservatoryPaletteGroupId = 'furniture' | 'animations' | 'floors' | 'walls' | 'decor';
export type ObservatoryPaletteSurfaceType =
  | 'none'
  | 'a2-ground'
  | 'a4-wall'
  | 'normal-floor-sheet'
  | 'normal-wall-sheet';

export interface ObservatoryPaletteAsset {
  assetId: string;
  category: ObservatoryAssetDefinition['category'];
  footprint: {
    height: number;
    width: number;
  };
  groupId: ObservatoryPaletteGroupId;
  isAnimated: boolean;
  isReviewedFurniture: boolean;
  label: string;
  previewUri: string;
  previewCrop?: {
    height: number;
    sourceHeight: number;
    sourceWidth: number;
    width: number;
    x: number;
    y: number;
  };
  roleId: ObservatoryPaletteRoleId;
  roleLabel: string;
  sourcePath: string;
  surfaceType: ObservatoryPaletteSurfaceType;
  tags: string[];
  themeId: ObservatoryPaletteThemeId;
}

export interface ObservatoryPaletteGroup {
  assets: ObservatoryPaletteAsset[];
  description: string;
  id: ObservatoryPaletteGroupId;
  label: string;
}

export const observatoryPaletteThemeOptions: Array<{
  id: ObservatoryPaletteThemeId;
  label: string;
}> = [
  { id: 'all', label: 'All Themes' },
  { id: 'office', label: 'Office' },
  { id: 'classroom', label: 'Classroom' },
  { id: 'museum', label: 'Museum' },
  { id: 'retail', label: 'Retail' },
  { id: 'hospital', label: 'Hospital' },
  { id: 'home', label: 'Home' },
  { id: 'kitchen', label: 'Kitchen & Pantry' },
  { id: 'conference', label: 'Conference' },
  { id: 'basement', label: 'Basement & Utility' },
  { id: 'utility', label: 'General Utility' },
  { id: 'specialty', label: 'Specialty Packs' },
];

export const observatoryPaletteRoleOptions: Array<{ id: ObservatoryPaletteRoleId; label: string }> =
  [
    { id: 'all', label: 'All Roles' },
    { id: 'tables', label: 'Tables' },
    { id: 'seating', label: 'Seating' },
    { id: 'storage', label: 'Storage' },
    { id: 'displays', label: 'Displays' },
    { id: 'screens', label: 'Screens' },
    { id: 'decor', label: 'Decor' },
    { id: 'utility', label: 'Utility' },
    { id: 'partitions', label: 'Partitions' },
    { id: 'workstations', label: 'Workstations' },
  ];

export const observatoryPaletteSortOptions: Array<{ id: ObservatoryPaletteSortId; label: string }> =
  [
    { id: 'recommended', label: 'Recommended' },
    { id: 'alpha', label: 'A-Z' },
    { id: 'footprint', label: 'Smallest Footprint' },
    { id: 'pack', label: 'Pack' },
  ];

export const observatoryAssetsPaletteSummary = (() => {
  const registry = getObservatoryFullModuleAssetRegistry();
  const assets = registry.assets.filter((asset) => asset.category !== 'human');
  const reviewedFurnitureCount = assets.filter((asset) =>
    asset.tags?.includes('manifest-backed')
  ).length;

  return {
    assetCount: assets.length,
    reviewedFurnitureCount,
  };
})();

const paletteGroups: Array<Omit<ObservatoryPaletteGroup, 'assets'>> = [
  {
    id: 'furniture',
    label: 'Furniture',
    description: 'Desks, chairs, storage, tables, and room props.',
  },
  {
    id: 'animations',
    label: 'Animations',
    description: 'Animated props and looping decor from the animation packs.',
  },
  {
    id: 'floors',
    label: 'Floors',
    description: 'Floor tiles and floor sheets for maps and rooms.',
  },
  {
    id: 'walls',
    label: 'Walls',
    description: 'Wall tiles, partitions, and boundary surfaces for rooms.',
  },
  {
    id: 'decor',
    label: 'Decor',
    description: 'Non-furniture decor and utility assets from the registry.',
  },
];

const catalogDimensionsByPath = new Map(
  observatoryAssetCatalogEntries.map((entry) => [
    entry.path,
    { width: entry.width, height: entry.height },
  ])
);

export function getObservatoryPaletteAssets({
  includeUnreviewed = false,
  role = 'all',
  search = '',
  sort = 'recommended',
  theme = 'all',
}: {
  includeUnreviewed?: boolean;
  role?: ObservatoryPaletteRoleId;
  search?: string;
  sort?: ObservatoryPaletteSortId;
  theme?: ObservatoryPaletteThemeId;
} = {}): ObservatoryPaletteAsset[] {
  const query = search.trim().toLowerCase();
  const registry = getObservatoryFullModuleAssetRegistry();

  return registry.assets
    .filter((asset) => asset.category !== 'human')
    .filter((asset) => !asset.tags?.includes('builder-hidden'))
    .map(toPaletteAsset)
    .filter(
      (asset) => includeUnreviewed || asset.isReviewedFurniture || asset.category !== 'furniture'
    )
    .filter((asset) => theme === 'all' || asset.themeId === theme)
    .filter((asset) => role === 'all' || asset.roleId === role)
    .filter((asset) => {
      if (!query) {
        return true;
      }

      const haystack = [
        asset.assetId,
        asset.label,
        asset.roleLabel,
        asset.sourcePath,
        ...asset.tags,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (sort === 'alpha') {
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      }

      if (sort === 'footprint') {
        const footprintDiff =
          a.footprint.width * a.footprint.height - b.footprint.width * b.footprint.height;
        return footprintDiff || a.label.localeCompare(b.label, undefined, { numeric: true });
      }

      if (sort === 'pack') {
        const packDiff = packNameFromPath(a.sourcePath).localeCompare(
          packNameFromPath(b.sourcePath),
          undefined,
          { numeric: true }
        );
        return packDiff || a.label.localeCompare(b.label, undefined, { numeric: true });
      }

      const priorityDiff = builderPriority(b) - builderPriority(a);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      if (a.groupId !== b.groupId) {
        return groupSortIndex(a.groupId) - groupSortIndex(b.groupId);
      }

      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });
}

export function getObservatoryPaletteGroups(options?: {
  includeUnreviewed?: boolean;
  role?: ObservatoryPaletteRoleId;
  search?: string;
  sort?: ObservatoryPaletteSortId;
  theme?: ObservatoryPaletteThemeId;
}) {
  const assets = getObservatoryPaletteAssets(options);

  return paletteGroups
    .map((group) => ({
      ...group,
      assets: assets.filter((asset) => asset.groupId === group.id),
    }))
    .filter((group) => group.assets.length > 0);
}

function toPaletteAsset(asset: ObservatoryAssetDefinition): ObservatoryPaletteAsset {
  const sourcePath = asset.catalogPath ?? asset.source.uri;
  const footprint = footprintForAsset(asset);

  return {
    assetId: asset.id,
    category: asset.category,
    footprint,
    groupId: groupForAsset(asset, sourcePath),
    isAnimated: Boolean(asset.animation || asset.animations?.length),
    isReviewedFurniture: Boolean(asset.tags?.includes('manifest-backed')),
    label: asset.label,
    previewCrop: previewCropForAsset(asset, sourcePath),
    previewUri: asset.source.uri,
    roleId: roleForAsset(asset, sourcePath),
    roleLabel: roleLabelForAsset(asset, sourcePath),
    sourcePath,
    surfaceType: surfaceTypeForAsset(asset, sourcePath),
    tags: asset.tags ?? [],
    themeId: themeForAsset(asset, sourcePath),
  };
}

function previewCropForAsset(asset: ObservatoryAssetDefinition, sourcePath: string) {
  const dimensions = catalogDimensionsByPath.get(sourcePath);

  if (!dimensions?.width || !dimensions.height) {
    return undefined;
  }

  if (asset.autotile) {
    const tileSize = asset.autotile.tileSize;
    if (asset.autotile.kind === 'rpgmaker-a4-wall') {
      const previewRowOffset = resolveA4WallPreviewRowOffset(asset.autotile.set.height);
      const sourceLayout = asset.autotile.sourceLayout;
      return {
        x: (sourceLayout?.x ?? 0) + asset.autotile.set.x * tileSize,
        y: sourceLayout?.faceY ?? (asset.autotile.set.y + previewRowOffset) * tileSize,
        width: tileSize,
        height: tileSize,
        sourceWidth: dimensions.width,
        sourceHeight: dimensions.height,
      };
    }

    const previewWidth =
      asset.autotile.kind === 'rpgmaker-a2-ground' ? tileSize : asset.autotile.set.width * tileSize;
    const previewHeight =
      asset.autotile.kind === 'rpgmaker-a2-ground'
        ? tileSize
        : asset.autotile.set.height * tileSize;
    return {
      x: asset.autotile.set.x * tileSize,
      y: asset.autotile.set.y * tileSize,
      width: previewWidth,
      height: previewHeight,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
    };
  }

  const previewCrop = asset.previewCrop ?? asset.sourceCrop;

  if (previewCrop) {
    return {
      ...previewCrop,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
    };
  }

  if (asset.source.kind === 'spritesheet' && asset.source.frameWidth && asset.source.frameHeight) {
    const columns = Math.max(1, Math.floor(dimensions.width / asset.source.frameWidth));
    const frame = Math.max(0, asset.frame ?? 0);

    return {
      x: (frame % columns) * asset.source.frameWidth,
      y: Math.floor(frame / columns) * asset.source.frameHeight,
      width: asset.source.frameWidth,
      height: asset.source.frameHeight,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
    };
  }

  return undefined;
}

function resolveA4WallPreviewRowOffset(setHeight: number) {
  if (setHeight <= 2) {
    return 0;
  }

  if (setHeight <= 3) {
    return 1;
  }

  return 3;
}

function footprintForAsset(asset: ObservatoryAssetDefinition) {
  const frameWidth = asset.source.frameWidth ?? asset.width ?? 48;
  const frameHeight = asset.source.frameHeight ?? asset.height ?? 48;

  if (asset.width || asset.height) {
    return {
      width: Math.max(1, Math.ceil((asset.width ?? frameWidth) / 48)),
      height: Math.max(1, Math.ceil((asset.height ?? frameHeight) / 48)),
    };
  }

  if (asset.collision) {
    return {
      width: Math.max(1, Math.round(asset.collision.width)),
      height: Math.max(1, Math.round(asset.collision.height)),
    };
  }

  return {
    width: Math.max(1, Math.ceil(frameWidth / 48)),
    height: Math.max(1, Math.ceil(frameHeight / 48)),
  };
}

function groupForAsset(
  asset: ObservatoryAssetDefinition,
  sourcePath: string
): ObservatoryPaletteGroupId {
  if (asset.category === 'floor') {
    return 'floors';
  }
  if (asset.category === 'wall') {
    return 'walls';
  }
  if (asset.category === 'furniture') {
    return 'furniture';
  }
  if (sourcePath.startsWith('animations/') || asset.animation || asset.animations?.length) {
    return 'animations';
  }
  return 'decor';
}

function themeForAsset(
  asset: ObservatoryAssetDefinition,
  sourcePath: string
): ObservatoryPaletteThemeId {
  const tags = (asset.tags ?? []).filter(
    (tag) => tag !== 'office-pack' && !tag.startsWith('catalog:')
  );
  const text = `${sourcePath} ${asset.label} ${tags.join(' ')}`.toLowerCase();

  if (/(museum|gallery|exhibit|artifact|display case|laser)/.test(text)) return 'museum';
  if (/(classroom|library|school|student|teacher|chalkboard)/.test(text)) return 'classroom';
  if (/(hospital|clinic|medical|ward|surgery|pharmacy)/.test(text)) return 'hospital';
  if (/(grocery|clothing|retail|store|shop|checkout|market|ice cream)/.test(text)) return 'retail';
  if (/(kitchen|pantry|fridge|coffee|canteen|oven|sink|dishwasher)/.test(text)) return 'kitchen';
  if (/(bedroom|living room|bathroom|home|condominium|interiors|japanese)/.test(text))
    return 'home';
  if (/(conference|hall|studio|television|film|meeting room|auditorium)/.test(text))
    return 'conference';
  if (/(basement|jail|shooting range|maintenance|boiler|prison)/.test(text)) return 'basement';
  if (
    /(modern office|office|workspace|approval|research|finance|audit|ops center|reception|server room)/.test(
      text
    )
  )
    return 'office';
  if (/(utility|storage|tool|workbench|rack|terminal|machine room)/.test(text)) return 'utility';
  return 'specialty';
}

function surfaceTypeForAsset(
  asset: ObservatoryAssetDefinition,
  sourcePath: string
): ObservatoryPaletteSurfaceType {
  if (asset.category === 'floor') {
    if (asset.autotile?.kind === 'rpgmaker-a2-ground' || sourcePath.startsWith('floors/')) {
      return 'a2-ground';
    }

    return 'normal-floor-sheet';
  }

  if (asset.category === 'wall') {
    if (asset.autotile?.kind === 'rpgmaker-a4-wall' || sourcePath.startsWith('walls/')) {
      return 'a4-wall';
    }

    return 'normal-wall-sheet';
  }

  return 'none';
}

function roleForAsset(
  asset: ObservatoryAssetDefinition,
  sourcePath: string
): ObservatoryPaletteRoleId {
  const text = `${sourcePath} ${asset.label} ${(asset.tags ?? []).join(' ')}`.toLowerCase();

  if (asset.category === 'floor') return 'decor';
  if (asset.category === 'wall') return 'partitions';
  if (/(workstation|computer|printer|laptop|keyboard|mouse|console)/.test(text))
    return 'workstations';
  if (/(desk|table|counter|workbench)/.test(text)) return 'tables';
  if (/(chair|seating|seat|sofa|bench|stool)/.test(text)) return 'seating';
  if (/(cabinet|storage|shelf|rack|bookcase|locker)/.test(text)) return 'storage';
  if (/(display|showcase|museum|pedestal|stand)/.test(text)) return 'displays';
  if (/(monitor|screen|tv|terminal|keypad)/.test(text)) return 'screens';
  if (/(partition|divider|panel|wall)/.test(text)) return 'partitions';
  if (/(fridge|water|coffee|sink|kitchen|machine|cart|server|utility|tool|door)/.test(text))
    return 'utility';
  return 'decor';
}

function roleLabelForAsset(asset: ObservatoryAssetDefinition, sourcePath: string) {
  const roleId = roleForAsset(asset, sourcePath);
  return observatoryPaletteRoleOptions.find((option) => option.id === roleId)?.label ?? 'Decor';
}

function builderPriority(asset: ObservatoryPaletteAsset) {
  let score = 0;
  if (asset.isReviewedFurniture) score += 40;
  if (asset.groupId === 'furniture') score += 18;
  if (asset.groupId === 'floors' || asset.groupId === 'walls') score += 16;
  if (asset.groupId === 'animations') score += 14;
  if (asset.themeId === 'office' || asset.themeId === 'classroom' || asset.themeId === 'museum')
    score += 12;
  if (
    asset.roleId === 'workstations' ||
    asset.roleId === 'tables' ||
    asset.roleId === 'seating' ||
    asset.roleId === 'screens'
  )
    score += 10;
  score -= asset.footprint.width * asset.footprint.height;
  return score;
}

function groupSortIndex(groupId: ObservatoryPaletteGroupId) {
  const index = paletteGroups.findIndex((group) => group.id === groupId);
  return index === -1 ? paletteGroups.length : index;
}

function packNameFromPath(path: string) {
  const segments = path.split('/');
  return segments.length > 1 ? (segments[1] ?? path) : path;
}
