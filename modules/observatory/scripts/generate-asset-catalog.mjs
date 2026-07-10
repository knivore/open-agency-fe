#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const moduleDir = join(scriptDir, '..');
const assetsDir = join(moduleDir, 'assets');
const rasterExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const files = await walk(assetsDir);
const entries = await Promise.all(
  files
    .filter((filePath) => rasterExtensions.has(extname(filePath).toLowerCase()))
    .sort()
    .map(async (filePath) => {
      const relativePath = relative(assetsDir, filePath);
      const normalizedPath = relativePath.replace(/\\/g, '/');
      const metadata = await readRasterMetadata(filePath, normalizedPath);
      const directory = normalizedPath.split('/')[0] ?? 'root';
      const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
      return {
        id: toCandidateAssetId(normalizedPath),
        path: normalizedPath,
        directory,
        extension: extname(filePath).toLowerCase(),
        fileName,
        sha256: metadata.sha256,
        animationFrameCrop: metadata.animationFrameCrop,
        width: metadata.width,
        height: metadata.height,
      };
    })
);

const catalog = {
  generatedAt: new Date().toISOString(),
  totalFileCount: entries.length,
  directories: summarizeDirectories(entries),
  entries,
};

if (process.argv.includes('--registry-candidates-json')) {
  console.log(JSON.stringify(renderRegistryCandidates(catalog), null, 2));
} else if (process.argv.includes('--typescript-registry')) {
  console.log(renderTypescriptRegistry(catalog));
} else if (process.argv.includes('--typescript')) {
  console.log(renderTypescriptCatalog(catalog));
} else {
  console.log(JSON.stringify(catalog, null, 2));
}

async function walk(directory) {
  const dirents = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    dirents
      .filter((dirent) => !shouldSkipAssetCatalogEntry(dirent.name))
      .map((dirent) => {
        const childPath = join(directory, dirent.name);
        return dirent.isDirectory() ? walk(childPath) : childPath;
      })
  );

  return children.flat();
}

function shouldSkipAssetCatalogEntry(name) {
  return (
    name.startsWith('.') ||
    name === '_review' ||
    name === 'manifest.generated.json'
  );
}

async function readRasterMetadata(filePath, normalizedPath) {
  const file = await readFile(filePath);
  const metadata = {
    sha256: createHash('sha256').update(file).digest('hex'),
  };

  if (
    extname(filePath).toLowerCase() !== '.png' ||
    file.length < 24 ||
    file.toString('ascii', 1, 4) !== 'PNG'
  ) {
    return metadata;
  }

  return {
    ...metadata,
    animationFrameCrop: readPngAnimationFrameCrop(file, normalizedPath),
    height: file.readUInt32BE(20),
    width: file.readUInt32BE(16),
  };
}

function readPngAnimationFrameCrop(file, normalizedPath) {
  if (!normalizedPath.startsWith('animations/')) {
    return undefined;
  }

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const frameGeometry = inferCatalogAnimationFrameGeometryForBuild({
    fileName: normalizedPath.split('/').pop() ?? normalizedPath,
    height,
    path: normalizedPath,
    width,
  });

  if (
    isCatalogAnimationAtlasForBuild({
      fileName: normalizedPath.split('/').pop() ?? normalizedPath,
      height,
      width,
    })
  ) {
    return undefined;
  }

  return readPngAlphaTrim(file, {
    height: frameGeometry.frameHeight,
    width: frameGeometry.frameWidth,
    x: 0,
    y: 0,
  });
}

function readPngAlphaTrim(file, crop) {
  const alpha = decodePngAlpha(file);
  let minX = crop.width;
  let minY = crop.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const sourceX = crop.x + x;
      const sourceY = crop.y + y;
      const opacity = alpha.data[sourceY * alpha.width + sourceX];

      if (opacity === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return undefined;
  }

  const trimmed = {
    height: maxY - minY + 1,
    width: maxX - minX + 1,
    x: crop.x + minX,
    y: crop.y + minY,
  };

  if (
    trimmed.width === crop.width &&
    trimmed.height === crop.height &&
    trimmed.x === crop.x &&
    trimmed.y === crop.y
  ) {
    return undefined;
  }

  return trimmed;
}

function decodePngAlpha(file) {
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const bitDepth = file[24];
  const colorType = file[25];

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  }

  const bytesPerPixel =
    colorType === 6
      ? 4
      : colorType === 2
        ? 3
        : colorType === 3 || colorType === 0
          ? 1
          : 0;

  if (bytesPerPixel === 0) {
    throw new Error(`Unsupported PNG color type ${colorType}`);
  }

  const idatChunks = [];
  let paletteAlpha;
  let cursor = 33;

  while (cursor + 12 <= file.length) {
    const length = file.readUInt32BE(cursor);
    const type = file.toString('ascii', cursor + 4, cursor + 8);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > file.length) {
      throw new Error('Malformed PNG chunk length');
    }

    if (type === 'IDAT') {
      idatChunks.push(file.subarray(dataStart, dataEnd));
    } else if (type === 'tRNS') {
      paletteAlpha = file.subarray(dataStart, dataEnd);
    } else if (type === 'IEND') {
      break;
    }

    cursor = dataEnd + 4;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const scanlineLength = width * bytesPerPixel;
  const alpha = Buffer.alloc(width * height);
  const previous = Buffer.alloc(scanlineLength);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const current = Buffer.from(
      inflated.subarray(inputOffset, inputOffset + scanlineLength)
    );
    inputOffset += scanlineLength;

    unfilterScanline(current, previous, bytesPerPixel, filterType);

    if (colorType === 6) {
      for (let x = 0; x < width; x += 1) {
        alpha[y * width + x] = current[x * bytesPerPixel + 3];
      }
    } else if (colorType === 3) {
      for (let x = 0; x < width; x += 1) {
        alpha[y * width + x] = paletteAlpha?.[current[x]] ?? 255;
      }
    } else {
      alpha.fill(255, y * width, (y + 1) * width);
    }

    current.copy(previous);
  }

  return { data: alpha, height, width };
}

function unfilterScanline(current, previous, bytesPerPixel, filterType) {
  for (let index = 0; index < current.length; index += 1) {
    const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft =
      index >= bytesPerPixel ? (previous[index - bytesPerPixel] ?? 0) : 0;

    if (filterType === 1) {
      current[index] = (current[index] + left) & 0xff;
    } else if (filterType === 2) {
      current[index] = (current[index] + up) & 0xff;
    } else if (filterType === 3) {
      current[index] = (current[index] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filterType === 4) {
      current[index] =
        (current[index] + paethPredictor(left, up, upLeft)) & 0xff;
    } else if (filterType !== 0) {
      throw new Error(`Unsupported PNG filter type ${filterType}`);
    }
  }
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
}

function inferCatalogAnimationFrameGeometryForBuild(entry) {
  const sourceWidth = entry.width ?? 48;
  const sourceHeight = entry.height ?? 48;

  if (isCatalogAnimationAtlasForBuild(entry)) {
    return { frameWidth: 48, frameHeight: 48 };
  }

  return {
    frameWidth: sourceWidth % 48 === 0 ? 48 : sourceWidth,
    frameHeight: sourceHeight,
  };
}

function isCatalogAnimationAtlasForBuild(entry) {
  const fileName = entry.fileName.toLowerCase();
  const sourceWidth = entry.width ?? 0;
  const sourceHeight = entry.height ?? 0;

  return (
    fileName === 'animated_shopping_carts_48x48.png' ||
    (sourceWidth === sourceHeight && sourceWidth >= 480)
  );
}

function summarizeDirectories(entries) {
  const counts = new Map();

  for (const entry of entries) {
    const directory = entry.path.split('/')[0] ?? 'root';
    counts.set(directory, (counts.get(directory) ?? 0) + 1);
  }

  return [...counts.entries()].map(([directory, fileCount]) => ({
    directory,
    fileCount,
  }));
}

function toCandidateAssetId(relativePath) {
  return relativePath
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderTypescriptCatalog() {
  return `${'import'} catalogGenerated from './catalog.generated.json';

export interface ObservatoryAssetCatalogDirectorySummary {
  directory: string;
  fileCount: number;
}

export interface ObservatoryAssetCatalogEntry {
  animationFrameCrop?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  directory: string;
  extension: string;
  fileName: string;
  id: string;
  path: string;
  sha256: string;
  width?: number;
  height?: number;
}

interface ObservatoryGeneratedCatalog {
  directories: ObservatoryAssetCatalogDirectorySummary[];
  entries: ObservatoryAssetCatalogEntry[];
  generatedAt: string;
  totalFileCount: number;
}

// Keep one generated JSON source of truth instead of shipping a second multi-megabyte
// TypeScript copy of the same catalog in the open-source frontend bundle.
const catalog = catalogGenerated as ObservatoryGeneratedCatalog;

export const observatoryAssetCatalogEntries = catalog.entries;

export const observatoryAssetCatalogSummary = {
  directories: catalog.directories,
  totalFileCount: observatoryAssetCatalogEntries.length,
};
`;
}

function renderTypescriptRegistry(catalog) {
  const imports = catalog.entries
    .map(
      (entry, index) =>
        `${'import'} asset${index} from '${'../../assets/'}${escapeImportPath(entry.path)}';`
    )
    .join('\n');
  const importMap = catalog.entries
    .map((entry, index) => `  ${JSON.stringify(entry.path)}: asset${index},`)
    .join('\n');
  const animationFrameCropMap = catalog.entries
    .filter((entry) => entry.animationFrameCrop)
    .map(
      (entry) =>
        `  ${JSON.stringify(entry.path)}: ${JSON.stringify(entry.animationFrameCrop)},`
    )
    .join('\n');

  return `${'import'} type { StaticImageData } from 'next/image';

${'import'} type {
  ObservatoryAssetDefinition,
  ObservatoryAssetSourceCrop,
} from '${'./assetRegistry'}';
${'import'} { observatoryAssetCatalogEntries, type ObservatoryAssetCatalogEntry } from '${'./assetCatalog'}';
${'import'} type { ${'ObservatoryFurnitureManifestAsset'} } from '${'./furnitureManifest'}';
${'import'} ${'furnitureManifest'} from '${'../../assets/furnitures/furniture-manifest.generated.json'}';
${imports}

type ${'ImportedRasterAsset'} = StaticImageData | string;
type ${'GeneratedFrameGeometry'} = {
  confidence: string;
  frameHeight: number;
  frameWidth: number;
}
type ${'FurnitureManifest'} = {
  assets?: ${'ObservatoryFurnitureManifestAsset'}[];
}

function uri(asset: ${'ImportedRasterAsset'}) {
  return typeof asset === 'string' ? asset : asset.src;
}

const furnitureManifestAssetsByCatalogPath = new Map(
  ((${'furnitureManifest'} as ${'FurnitureManifest'}).assets ?? []).map((asset) => [
    asset.source.path,
    asset,
  ])
)

const generatedAssetImports: Record<string, ${'ImportedRasterAsset'}> = {
${importMap}
};

const generatedAnimationFrameCrops: Record<string, ObservatoryAssetSourceCrop> = {
${animationFrameCropMap}
};

export const observatoryGeneratedAssetRegistryAssets: ObservatoryAssetDefinition[] =
  observatoryAssetCatalogEntries.map(toGeneratedAssetDefinition);

function toGeneratedAssetDefinition(entry: ObservatoryAssetCatalogEntry): ObservatoryAssetDefinition {
  const furnitureAsset = furnitureManifestAssetsByCatalogPath.get(entry.path);

  if (furnitureAsset) {
    return toGeneratedFurnitureAssetDefinition(entry, furnitureAsset);
  }

  const category = categoryForGeneratedCatalogPath(entry.path);
  const frameGeometry = inferGeneratedFrameGeometry(entry);
  const frameWidth = frameGeometry.frameWidth;
  const frameHeight = frameGeometry.frameHeight;
  const isAnimationAtlas = entry.path.startsWith('animations/') && isGeneratedAnimationAtlas(entry);
  const animationFrameCrop = generatedAnimationFrameCrops[entry.path];
  const frameCount = Math.max(
    1,
    Math.floor((entry.width ?? frameWidth) / frameWidth) *
      Math.floor((entry.height ?? frameHeight) / frameHeight),
  );
  const tags = [
    'office-pack',
    'generated',
    \`catalog:\${entry.path.split('/')[0] ?? 'root'}\`,
    ...(entry.path.startsWith('animations/')
      ? [
          \`frame:\${frameWidth}x\${frameHeight}\`,
          frameGeometry.confidence,
          ...(isAnimationAtlas ? ['builder-hidden'] : []),
        ]
      : []),
    ...semanticTagsForGeneratedCatalogPath(entry.path),
  ];

  return {
    id: \`generated:\${entry.id}\`,
    catalogPath: entry.path,
    category,
    label: labelForGeneratedCatalogPath(entry.path),
    source: {
      kind: 'spritesheet',
      uri: uri(generatedAssetImports[entry.path] ?? entry.path),
      frameWidth,
      frameHeight,
    },
    ...(animationFrameCrop ? { previewCrop: animationFrameCrop } : {}),
    frame: category === 'human' ? 1 : 0,
    ...(entry.path.startsWith('animations/') && !isAnimationAtlas && frameCount > 1
      ? {
          animation: {
            key: \`generated:\${entry.id}:loop\`,
            startFrame: 0,
            endFrame: frameCount - 1,
            frameRate: 8,
            repeat: -1,
          },
        }
      : {}),
    width: frameWidth,
    height: frameHeight,
    anchor: category === 'human' ? { x: 0.5, y: 0.5 } : { x: 0, y: 0 },
    ...autotileForGeneratedCatalogPath(entry.path, frameGeometry),
    semanticId: \`generated:\${entry.id}\`,
    tags,
  };
}

function toGeneratedFurnitureAssetDefinition(
  entry: ObservatoryAssetCatalogEntry,
  furnitureAsset: ${'ObservatoryFurnitureManifestAsset'},
): ObservatoryAssetDefinition {
  const collision = collisionForFurnitureAsset(furnitureAsset);

  return {
    id: furnitureAsset.id,
    catalogPath: entry.path,
    category: 'furniture',
    label: furnitureAsset.label,
    source: {
      kind: 'image',
      uri: uri(generatedAssetImports[entry.path] ?? entry.path),
    },
    previewCrop: furnitureAsset.sourceCrop,
    sourceCrop: furnitureAsset.sourceCrop,
    width: furnitureAsset.width,
    height: furnitureAsset.height,
    anchor: { x: 0, y: 0 },
    collision,
    semanticId: \`furniture:\${furnitureAsset.semanticRole}:\${furnitureAsset.id.split(':').at(-1) ?? entry.id}\`,
    tags: [
      'office-pack',
      'manifest-backed',
      'furniture-manifest',
      \`manifest-category:\${furnitureAsset.category}\`,
      \`role:\${furnitureAsset.semanticRole}\`,
      ...furnitureAsset.tags,
    ],
  };
}

function collisionForFurnitureAsset(furnitureAsset: ${'ObservatoryFurnitureManifestAsset'}) {
  const crop = furnitureAsset.sourceCrop ?? {
    height: furnitureAsset.height,
    width: furnitureAsset.width,
    x: 0,
    y: 0,
  };
  const offsetX = Math.floor(crop.x / 48);
  const offsetY = Math.floor(crop.y / 48);
  const width = Math.max(1, Math.ceil((crop.x - offsetX * 48 + crop.width) / 48));
  const height = Math.max(1, Math.ceil((crop.y - offsetY * 48 + crop.height) / 48));

  return {
    width,
    height,
    ...(offsetX > 0 ? { offsetX } : {}),
    ...(offsetY > 0 ? { offsetY } : {}),
  };
}

function inferGeneratedFrameGeometry(entry: ObservatoryAssetCatalogEntry): ${'GeneratedFrameGeometry'} {
  if (entry.path.startsWith('animations/')) {
    return inferGeneratedAnimationFrameGeometry(entry);
  }

  if (entry.path.startsWith('characters/Character_48x48_')) {
    return { frameWidth: 48, frameHeight: 96, confidence: 'pattern' };
  }

  if (entry.path.startsWith('floors/A2 ')) {
    return { frameWidth: 32, frameHeight: 32, confidence: 'rpgmaker-a2-16x12' };
  }

  if (entry.path.startsWith('walls/A4 ')) {
    return { frameWidth: 32, frameHeight: 32, confidence: 'rpgmaker-a4-16x15' };
  }

  if (entry.path.startsWith('furnitures/')) {
    return {
      frameWidth: entry.width ?? 48,
      frameHeight: entry.height ?? 48,
      confidence: 'furniture-source-frame',
    };
  }

  if (entry.path.startsWith('floors/') || entry.path.startsWith('walls/')) {
    return { frameWidth: 48, frameHeight: 48, confidence: 'tilesheet-default' };
  }

  return { frameWidth: 48, frameHeight: 48, confidence: 'filename-default' };
}

function inferGeneratedAnimationFrameGeometry(entry: ObservatoryAssetCatalogEntry): ${'GeneratedFrameGeometry'} {
  const sourceWidth = entry.width ?? 48;
  const sourceHeight = entry.height ?? 48;

  if (isGeneratedAnimationAtlas(entry)) {
    return { frameWidth: 48, frameHeight: 48, confidence: 'rpgmaker-animation-atlas-48x48' };
  }

  return {
    frameWidth: sourceWidth % 48 === 0 ? 48 : sourceWidth,
    frameHeight: sourceHeight,
    confidence: 'rpgmaker-animation-horizontal-strip',
  };
}

function isGeneratedAnimationAtlas(entry: ObservatoryAssetCatalogEntry) {
  const fileName = entry.fileName.toLowerCase();
  const sourceWidth = entry.width ?? 0;
  const sourceHeight = entry.height ?? 0;

  return fileName === 'animated_shopping_carts_48x48.png'
    || (sourceWidth === sourceHeight && sourceWidth >= 480);
}

function autotileForGeneratedCatalogPath(path: string, frameGeometry: ${'GeneratedFrameGeometry'}) {
  if (path.startsWith('floors/A2 ')) {
    return {
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a2-ground' as const,
        set: { x: 0, y: 0, width: 2, height: 3 },
        tileSize: frameGeometry.frameWidth,
      },
    };
  }

  if (path.startsWith('walls/A4 ')) {
    return {
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a4-wall' as const,
        set: { x: 0, y: 0, width: 2, height: 5 },
        tileSize: frameGeometry.frameWidth,
      },
    };
  }

  return {};
}

function categoryForGeneratedCatalogPath(path: string): ObservatoryAssetDefinition['category'] {
  if (path.startsWith('floors/')) {
    return 'floor';
  }
  if (path.startsWith('walls/')) {
    return 'wall';
  }
  if (path.startsWith('furnitures/')) {
    return 'furniture';
  }
  if (path.startsWith('characters/Premade_Character_') || path.startsWith('characters/Character_48x48_')) {
    return 'human';
  }
  return 'decor';
}

function semanticTagsForGeneratedCatalogPath(path: string): string[] {
  const normalized = path.toLowerCase();
  const tags: string[] = [];
  const tagRules: Array<[string, string]> = [
    ['bathroom', 'bathroom'],
    ['bed', 'rest'],
    ['book', 'reading'],
    ['cabinet', 'storage'],
    ['camera', 'security'],
    ['chair', 'seating'],
    ['coffee', 'pantry'],
    ['computer', 'workstation'],
    ['control_room', 'runtime'],
    ['desk', 'workstation'],
    ['door', 'door'],
    ['fridge', 'pantry'],
    ['kitchen', 'pantry'],
    ['laptop', 'workstation'],
    ['monitor', 'screen'],
    ['office', 'office'],
    ['phone', 'communication'],
    ['reception', 'reception'],
    ['screen', 'screen'],
    ['server', 'runtime'],
    ['sink', 'pantry'],
    ['table', 'table'],
    ['tv', 'screen'],
  ];

  for (const [needle, tag] of tagRules) {
    if (normalized.includes(needle)) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

function labelForGeneratedCatalogPath(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  return fileName
    .replace(/\\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim()
    .replace(/\\b\\w/g, (letter) => letter.toUpperCase());
}
`;
}

function escapeImportPath(path) {
  return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function renderRegistryCandidates(catalog) {
  return {
    generatedAt: catalog.generatedAt,
    candidateCount: catalog.entries.length,
    candidates: catalog.entries.map((entry) => {
      const category = categoryForCatalogPath(entry.path);
      const frameGeometry = inferFrameGeometry(entry);
      const frameCount = Math.max(
        1,
        Math.floor(
          (entry.width ?? frameGeometry.frameWidth) / frameGeometry.frameWidth
        ) *
          Math.floor(
            (entry.height ?? frameGeometry.frameHeight) /
              frameGeometry.frameHeight
          )
      );
      const tags = [
        'office-pack',
        'generated',
        `catalog:${entry.directory}`,
        ...semanticTagsForCatalogPath(entry.path),
      ];

      return {
        id: `generated:${entry.id}`,
        catalogPath: entry.path,
        category,
        label: labelForCatalogPath(entry.path),
        source: {
          kind: 'spritesheet',
          sourcePath: entry.path,
          frameWidth: frameGeometry.frameWidth,
          frameHeight: frameGeometry.frameHeight,
        },
        frame: category === 'human' ? 3 : 0,
        ...(entry.path.startsWith('animations/') && frameCount > 1
          ? {
              animation: {
                key: `generated:${entry.id}:loop`,
                startFrame: 0,
                endFrame: frameCount - 1,
                frameRate: 8,
                repeat: -1,
              },
            }
          : {}),
        width: frameGeometry.frameWidth,
        height: frameGeometry.frameHeight,
        anchor: category === 'human' ? { x: 0.5, y: 0.5 } : { x: 0, y: 0 },
        ...autotileForCatalogPath(entry.path, frameGeometry),
        semanticId: `generated:${entry.id}`,
        tags,
        review: {
          status: 'generated',
          priority: reviewPriorityForCatalogPath(entry.path),
          reasons: reviewReasonsForCatalogPath(entry.path, frameGeometry),
          frameGrid: {
            columns: Math.floor(
              (entry.width ?? frameGeometry.frameWidth) /
                frameGeometry.frameWidth
            ),
            rows: Math.floor(
              (entry.height ?? frameGeometry.frameHeight) /
                frameGeometry.frameHeight
            ),
            frameCount,
          },
        },
      };
    }),
  };
}

function inferFrameGeometry(entry) {
  if (entry.path.startsWith('characters/Character_48x48_')) {
    return { frameWidth: 48, frameHeight: 96, confidence: 'pattern' };
  }

  if (entry.path.startsWith('floors/A2 ')) {
    return { frameWidth: 32, frameHeight: 32, confidence: 'rpgmaker-a2-16x12' };
  }

  if (entry.path.startsWith('walls/A4 ')) {
    return { frameWidth: 32, frameHeight: 32, confidence: 'rpgmaker-a4-16x15' };
  }

  if (entry.path.startsWith('furnitures/')) {
    return {
      frameWidth: entry.width ?? 48,
      frameHeight: entry.height ?? 48,
      confidence: 'furniture-source-frame',
    };
  }

  if (entry.path.startsWith('floors/') || entry.path.startsWith('walls/')) {
    return { frameWidth: 48, frameHeight: 48, confidence: 'tilesheet-default' };
  }

  return { frameWidth: 48, frameHeight: 48, confidence: 'filename-default' };
}

function autotileForCatalogPath(path, frameGeometry) {
  if (path.startsWith('floors/A2 ')) {
    return {
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a2-ground',
        set: { x: 0, y: 0, width: 2, height: 3 },
        tileSize: frameGeometry.frameWidth,
      },
    };
  }

  if (path.startsWith('walls/A4 ')) {
    return {
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a4-wall',
        set: { x: 0, y: 0, width: 2, height: 5 },
        tileSize: frameGeometry.frameWidth,
      },
    };
  }

  return {};
}

function semanticTagsForCatalogPath(path) {
  const normalized = path.toLowerCase();
  const tags = [];
  const tagRules = [
    ['bathroom', 'bathroom'],
    ['bed', 'rest'],
    ['book', 'reading'],
    ['cabinet', 'storage'],
    ['camera', 'security'],
    ['chair', 'seating'],
    ['coffee', 'pantry'],
    ['computer', 'workstation'],
    ['control_room', 'runtime'],
    ['desk', 'workstation'],
    ['door', 'door'],
    ['fridge', 'pantry'],
    ['kitchen', 'pantry'],
    ['laptop', 'workstation'],
    ['monitor', 'screen'],
    ['office', 'office'],
    ['phone', 'communication'],
    ['reception', 'reception'],
    ['screen', 'screen'],
    ['server', 'runtime'],
    ['sink', 'pantry'],
    ['table', 'table'],
    ['tv', 'screen'],
  ];

  for (const [needle, tag] of tagRules) {
    if (normalized.includes(needle)) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

function reviewPriorityForCatalogPath(path) {
  const tags = semanticTagsForCatalogPath(path);

  if (
    path.startsWith('characters/') ||
    tags.some((tag) =>
      [
        'runtime',
        'workstation',
        'screen',
        'door',
        'seating',
        'pantry',
      ].includes(tag)
    )
  ) {
    return 'high';
  }

  if (
    path.startsWith('floors/') ||
    path.startsWith('walls/') ||
    path.startsWith('furnitures/')
  ) {
    return 'medium';
  }

  return 'low';
}

function reviewReasonsForCatalogPath(path, frameGeometry) {
  const reasons = [
    `frame:${frameGeometry.frameWidth}x${frameGeometry.frameHeight}:${frameGeometry.confidence}`,
  ];
  const tags = semanticTagsForCatalogPath(path);

  if (tags.length > 0) {
    reasons.push(`semantic:${tags.join(',')}`);
  }

  if (reviewPriorityForCatalogPath(path) === 'high') {
    reasons.push('high-value-office-runtime-asset');
  }

  return reasons;
}

function categoryForCatalogPath(path) {
  if (path.startsWith('floors/')) {
    return 'floor';
  }
  if (path.startsWith('walls/')) {
    return 'wall';
  }
  if (path.startsWith('furnitures/')) {
    return 'furniture';
  }
  if (
    path.startsWith('characters/Premade_Character_') ||
    path.startsWith('characters/Character_48x48_')
  ) {
    return 'human';
  }
  return 'decor';
}

function labelForCatalogPath(path) {
  const fileName = path.split('/').pop() ?? path;
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
