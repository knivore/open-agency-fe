import furnitureManifest from '@/modules/observatory/assets/furnitures/furniture-manifest.generated.json';
import furnitureReviewMap from '@/modules/observatory/assets/furnitures/furniture-review-map.json';

export interface ObservatoryFurnitureManifestAsset {
  category: string;
  fileName: string;
  footprintH: number;
  footprintW: number;
  height: number;
  id: string;
  label: string;
  packId: string;
  packName: string;
  path: string;
  semanticRole: string;
  sourceCrop?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  source: {
    kind: string;
    path: string;
  };
  tags: string[];
  visibleHeight?: number;
  visibleWidth?: number;
  width: number;
}

export interface ObservatoryFurniturePaletteAsset {
  assetId: string;
  category: string;
  fileName: string;
  footprint: {
    height: number;
    width: number;
  };
  groupId: ObservatoryFurniturePaletteGroupId;
  height: number;
  isReviewed: boolean;
  label: string;
  packName: string;
  role: string;
  roleId: ObservatoryFurnitureRoleId;
  sourceCrop?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  sourcePath: string;
  tags: string[];
  themeId: ObservatoryFurnitureThemeId;
  width: number;
}

export type ObservatoryFurniturePaletteGroupId =
  | 'workstations'
  | 'planning'
  | 'seating'
  | 'storage'
  | 'pantry'
  | 'runtime'
  | 'screens'
  | 'desks'
  | 'other';

export type ObservatoryFurnitureThemeId =
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

export type ObservatoryFurnitureRoleId =
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

export type ObservatoryFurnitureSortId = 'recommended' | 'alpha' | 'footprint' | 'pack';

export interface ObservatoryFurniturePaletteGroup {
  assets: ObservatoryFurniturePaletteAsset[];
  description: string;
  id: ObservatoryFurniturePaletteGroupId;
  label: string;
}

export const observatoryFurnitureThemeOptions: Array<{ id: ObservatoryFurnitureThemeId; label: string }> = [
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

export const observatoryFurnitureRoleOptions: Array<{ id: ObservatoryFurnitureRoleId; label: string }> = [
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

export const observatoryFurnitureSortOptions: Array<{ id: ObservatoryFurnitureSortId; label: string }> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'alpha', label: 'A-Z' },
  { id: 'footprint', label: 'Smallest Footprint' },
  { id: 'pack', label: 'Pack' },
];

const furnitureAssets = (furnitureManifest.assets ?? []) as ObservatoryFurnitureManifestAsset[];
const reviewedSourcePaths = new Set(
  (furnitureReviewMap.reviews ?? []).flatMap((review) => [review.sourcePath, review.originalPath].filter(Boolean)),
);
const reviewedAssetCount = furnitureAssets.reduce((count, asset) => {
  const sourcePath = asset.source.path;
  return reviewedSourcePaths.has(asset.path) || reviewedSourcePaths.has(sourcePath) ? count + 1 : count;
}, 0);

const paletteGroups: Array<Omit<ObservatoryFurniturePaletteGroup, 'assets'>> = [
  {
    id: 'workstations',
    label: 'Workstations',
    description: 'Desks, consoles, printers, and computer-ready furniture for executing work.',
  },
  {
    id: 'planning',
    label: 'Planning',
    description: 'Whiteboards and planning surfaces for workflow planning states.',
  },
  {
    id: 'seating',
    label: 'Seating',
    description: 'Chairs and agent seating targets.',
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'Cabinets, shelves, racks, and display storage.',
  },
  {
    id: 'pantry',
    label: 'Pantry',
    description: 'Water coolers, bottles, and pantry props.',
  },
  {
    id: 'runtime',
    label: 'Runtime Servers',
    description: 'Server racks, terminal carts, and runtime infrastructure.',
  },
  {
    id: 'screens',
    label: 'Screens',
    description: 'Monitors, wall screens, and terminals.',
  },
  {
    id: 'desks',
    label: 'Tables',
    description: 'Tables, desks, and broad work surfaces.',
  },
  {
    id: 'other',
    label: 'Other Reviewed',
    description: 'Reviewed office props that do not fit a primary group yet.',
  },
];

export const observatoryFurnitureManifestSummary = {
  assetCount: furnitureAssets.length,
  folderCount: furnitureManifest.folders?.length ?? 0,
  reviewedCount: reviewedAssetCount,
};

export function getObservatoryFurniturePaletteAssets({
  includeUnreviewed = false,
  search = '',
  role = 'all',
  sort = 'recommended',
  theme = 'all',
}: {
  includeUnreviewed?: boolean;
  role?: ObservatoryFurnitureRoleId;
  search?: string;
  sort?: ObservatoryFurnitureSortId;
  theme?: ObservatoryFurnitureThemeId;
} = {}): ObservatoryFurniturePaletteAsset[] {
  const query = search.trim().toLowerCase();

  return furnitureAssets
    .map(toPaletteAsset)
    .filter((asset) => includeUnreviewed || asset.isReviewed)
    .filter((asset) => theme === 'all' || asset.themeId === theme)
    .filter((asset) => role === 'all' || asset.roleId === role)
    .filter((asset) => {
      if (!query) {
        return true;
      }

      const haystack = [
        asset.assetId,
        asset.category,
        asset.fileName,
        asset.label,
        asset.packName,
        asset.role,
        asset.sourcePath,
        ...asset.tags,
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (sort === 'alpha') {
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      }

      if (sort === 'footprint') {
        const footprintDiff = a.footprint.width * a.footprint.height - b.footprint.width * b.footprint.height;
        return footprintDiff || a.label.localeCompare(b.label, undefined, { numeric: true });
      }

      if (sort === 'pack') {
        const packDiff = a.packName.localeCompare(b.packName, undefined, { numeric: true });
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

export function getObservatoryFurniturePaletteGroups(options?: {
  includeUnreviewed?: boolean;
  role?: ObservatoryFurnitureRoleId;
  search?: string;
  sort?: ObservatoryFurnitureSortId;
  theme?: ObservatoryFurnitureThemeId;
}): ObservatoryFurniturePaletteGroup[] {
  const assets = getObservatoryFurniturePaletteAssets(options);

  return paletteGroups
    .map((group) => ({
      ...group,
      assets: assets.filter((asset) => asset.groupId === group.id),
    }))
    .filter((group) => group.assets.length > 0);
}

export function getObservatoryFurniturePaletteAsset(assetId: string) {
  return getObservatoryFurniturePaletteAssets({ includeUnreviewed: true }).find(
    (asset) => asset.assetId === assetId,
  );
}

function toPaletteAsset(asset: ObservatoryFurnitureManifestAsset): ObservatoryFurniturePaletteAsset {
  const sourcePath = asset.source.path;

  return {
    assetId: asset.id,
    category: asset.category,
    fileName: asset.fileName,
    footprint: {
      height: Math.max(1, asset.footprintH),
      width: Math.max(1, asset.footprintW),
    },
    groupId: groupForFurnitureAsset(asset),
    height: asset.height,
    isReviewed: reviewedSourcePaths.has(asset.path) || reviewedSourcePaths.has(sourcePath),
    label: asset.label,
    packName: asset.packName,
    role: asset.semanticRole,
    roleId: roleForFurnitureAsset(asset),
    sourceCrop: asset.sourceCrop,
    sourcePath,
    tags: asset.tags,
    themeId: themeForFurnitureAsset(asset),
    width: asset.width,
  };
}

function themeForFurnitureAsset(asset: ObservatoryFurnitureManifestAsset): ObservatoryFurnitureThemeId {
  const text = `${asset.packName} ${asset.category} ${asset.semanticRole} ${asset.label} ${asset.tags.join(' ')}`.toLowerCase();

  if (/(modern office|office|workspace|agency|meeting|approval|research|finance|audit|ops center)/.test(text)) {
    return 'office';
  }
  if (/(classroom|library|school|bookcase|student|teacher)/.test(text)) {
    return 'classroom';
  }
  if (/(museum|gallery|exhibit|display case|artifact)/.test(text)) {
    return 'museum';
  }
  if (/(store|shop|retail|grocery|clothing|ice cream)/.test(text)) {
    return 'retail';
  }
  if (/(hospital|clinic|medical|ward)/.test(text)) {
    return 'hospital';
  }
  if (/(bedroom|living room|bathroom|home|condominium|kitchen)/.test(text)) {
    return 'home';
  }
  if (/(kitchen|pantry|fridge|coffee|canteen)/.test(text)) {
    return 'kitchen';
  }
  if (/(conference|hall|stage|studio|television|film)/.test(text)) {
    return 'conference';
  }
  if (/(basement|jail|shooting range|maintenance)/.test(text)) {
    return 'basement';
  }
  if (/(server|rack|terminal|utility|storage|tool|workbench)/.test(text)) {
    return 'utility';
  }
  return 'specialty';
}

function roleForFurnitureAsset(asset: ObservatoryFurnitureManifestAsset): ObservatoryFurnitureRoleId {
  const text = `${asset.category} ${asset.semanticRole} ${asset.label} ${asset.tags.join(' ')}`.toLowerCase();

  if (/(workstation|computer|printer|laptop|keyboard|mouse|office-machine|console)/.test(text)) {
    return 'workstations';
  }
  if (/(desk|table|counter|workbench)/.test(text)) {
    return 'tables';
  }
  if (/(chair|seating|seat|sofa|bench|stool)/.test(text)) {
    return 'seating';
  }
  if (/(cabinet|storage|shelf|rack|bookcase|locker)/.test(text)) {
    return 'storage';
  }
  if (/(display|showcase|museum|pedestal|stand)/.test(text)) {
    return 'displays';
  }
  if (/(monitor|screen|display-board|tv|terminal|keypad)/.test(text)) {
    return 'screens';
  }
  if (/(partition|divider|panel|wall)/.test(text)) {
    return 'partitions';
  }
  if (/(fridge|water|coffee|sink|kitchen|machine|cart|server|utility|tool)/.test(text)) {
    return 'utility';
  }
  return 'decor';
}

function groupForFurnitureAsset(asset: ObservatoryFurnitureManifestAsset): ObservatoryFurniturePaletteGroupId {
  const text = `${asset.category} ${asset.semanticRole} ${asset.label} ${asset.tags.join(' ')}`.toLowerCase();

  if (/(server|runtime|rack|terminal|control-panel|server-cart)/.test(text)) {
    return 'runtime';
  }

  if (/(whiteboard|planning|chart)/.test(text)) {
    return 'planning';
  }

  if (/(monitor|screen|display|keypad)/.test(text)) {
    return 'screens';
  }

  if (/(workstation|workbench|printer|computer|laptop|keyboard|mouse|office-machine)/.test(text)) {
    return 'workstations';
  }

  if (/(chair|seating|seat|sofa|bench)/.test(text)) {
    return 'seating';
  }

  if (/(cabinet|storage|shelf|rack|display-cabinet)/.test(text)) {
    return 'storage';
  }

  if (/(pantry|water-cooler|bottle|coffee|fridge|kitchen)/.test(text)) {
    return 'pantry';
  }

  if (/(desk|table)/.test(text)) {
    return 'desks';
  }

  return 'other';
}

function groupSortIndex(groupId: ObservatoryFurniturePaletteGroupId) {
  const index = paletteGroups.findIndex((group) => group.id === groupId);
  return index === -1 ? paletteGroups.length : index;
}

function builderPriority(asset: ObservatoryFurniturePaletteAsset) {
  let score = 0;

  if (asset.isReviewed) {
    score += 50;
  }

  if (asset.themeId === 'office' || asset.themeId === 'classroom' || asset.themeId === 'museum') {
    score += 20;
  }

  if (asset.roleId === 'workstations' || asset.roleId === 'tables' || asset.roleId === 'seating' || asset.roleId === 'screens') {
    score += 18;
  }

  if (asset.groupId === 'planning' || asset.groupId === 'storage') {
    score += 10;
  }

  score -= asset.footprint.width * asset.footprint.height;
  return score;
}
