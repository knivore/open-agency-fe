#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(scriptDir, '..');
const furnitureRoot = path.join(moduleRoot, 'assets', 'furnitures');
const reviewDir = path.join(furnitureRoot, '_review');
const reviewMapPath = path.join(furnitureRoot, 'furniture-review-map.json');
const generatedManifestPath = path.join(furnitureRoot, 'furniture-manifest.generated.json');

const shouldGenerateContactSheets = process.argv.includes('--contact-sheets');
const shouldApplyRenames = process.argv.includes('--apply-renames');
const folderFilter = new Set(parseCliValues('--folder'));
const reviewMap = await readOptionalJson(reviewMapPath, { reviews: [], schemaVersion: 1 });
let sharpModule;

const folders = await scanFurnitureFolders();
const assets = await scanFurnitureAssets(folders);

if (shouldApplyRenames) {
  await applyReviewedRenames(assets);
}

const refreshedFolders = shouldApplyRenames ? await scanFurnitureFolders() : folders;
const refreshedAssets = shouldApplyRenames ? await scanFurnitureAssets(refreshedFolders) : assets;

if (shouldGenerateContactSheets) {
  await generateContactSheets(refreshedAssets);
}

const manifest = createFurnitureManifest(refreshedAssets);
await writeFile(generatedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFolderManifests(manifest);

console.log(`Generated furniture manifest for ${manifest.assets.length} assets across ${manifest.folders.length} folders`);

async function scanFurnitureFolders() {
  const dirents = await readdir(furnitureRoot, { withFileTypes: true });

  return dirents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('.') && name !== '_review' && name !== 'sliced')
    .filter((name) => folderFilter.size === 0 || folderFilter.has(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function scanFurnitureAssets(folders) {
  const assets = [];

  for (const folder of folders) {
    const folderPath = path.join(furnitureRoot, folder);
    const files = (await readdir(folderPath, { withFileTypes: true }))
      .filter((dirent) => dirent.isFile() && dirent.name.toLowerCase().endsWith('.png'))
      .map((dirent) => dirent.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const file of files) {
      const absolutePath = path.join(folderPath, file);
      const relativePath = `${folder}/${file}`;
      const png = await readPngMetadata(absolutePath);
      const review = findReviewForPath(relativePath);
      const pack = inferPack(folder);

      assets.push({
        absolutePath,
        category: review?.category ?? inferCategory(folder, file),
        fileName: file,
        folder,
        height: png.height,
        label: review?.label ?? labelFromFileName(file),
        pack,
        relativePath,
        review,
        semanticRole: review?.semanticRole ?? inferSemanticRole(folder, file),
        sha256: png.sha256,
        sourceCrop: png.sourceCrop,
        tags: uniqueStrings([
          'furniture-pack',
          `pack:${pack.id}`,
          ...(review?.tags ?? inferTags(folder, file)),
        ]),
        width: png.width,
      });
    }
  }

  return assets;
}

async function readPngMetadata(filePath) {
  const file = await readFile(filePath);

  if (file.length < 24 || file.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${filePath} is not a readable PNG`);
  }

  const sourceCrop = await readPngAlphaTrim(file);

  return {
    height: file.readUInt32BE(20),
    sha256: createHash('sha256').update(file).digest('hex'),
    sourceCrop,
    width: file.readUInt32BE(16),
  };
}

async function readPngAlphaTrim(file) {
  const png = decodeRgbaPng(file);
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];

      if (alpha === 0) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      height: png.height,
      width: png.width,
      x: 0,
      y: 0,
    };
  }

  return {
    height: maxY - minY + 1,
    width: maxX - minX + 1,
    x: minX,
    y: minY,
  };
}

function decodeRgbaPng(file) {
  if (file.length < 33 || file.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('Expected PNG data');
  }

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const bitDepth = file[24];
  const colorType = file[25];
  const compression = file[26];
  const filter = file[27];
  const interlace = file[28];

  if (bitDepth !== 8 || colorType !== 6 || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const idatChunks = [];
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
    } else if (type === 'IEND') {
      break;
    }

    cursor = dataEnd + 4;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel;
  const output = Buffer.alloc(width * height * bytesPerPixel);
  const previous = Buffer.alloc(scanlineLength);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset];
    inputOffset += 1;
    const current = Buffer.from(inflated.subarray(inputOffset, inputOffset + scanlineLength));
    inputOffset += scanlineLength;

    unfilterScanline(current, previous, bytesPerPixel, filterType);
    current.copy(output, y * scanlineLength);
    current.copy(previous);
  }

  return { data: output, height, width };
}

function unfilterScanline(current, previous, bytesPerPixel, filterType) {
  for (let index = 0; index < current.length; index += 1) {
    const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] ?? 0 : 0;

    if (filterType === 1) {
      current[index] = (current[index] + left) & 0xff;
    } else if (filterType === 2) {
      current[index] = (current[index] + up) & 0xff;
    } else if (filterType === 3) {
      current[index] = (current[index] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filterType === 4) {
      current[index] = (current[index] + paethPredictor(left, up, upLeft)) & 0xff;
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

function createFurnitureManifest(assets) {
  const folderMap = new Map();

  for (const asset of assets) {
    const folder = folderMap.get(asset.folder) ?? {
      assetCount: 0,
      id: asset.pack.id,
      name: asset.pack.label,
      path: asset.folder,
      tags: asset.pack.tags,
    };

    folder.assetCount += 1;
    folderMap.set(asset.folder, folder);
  }

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    tileSize: 48,
    folders: [...folderMap.values()],
    assets: assets.map((asset) => ({
      id: `furniture:${asset.pack.id}:${slugify(path.basename(asset.fileName, '.png'))}`,
      category: asset.category,
      fileName: asset.fileName,
      footprintH: Math.max(1, Math.ceil(asset.height / 48)),
      footprintW: Math.max(1, Math.ceil(asset.width / 48)),
      height: asset.height,
      label: asset.label,
      packId: asset.pack.id,
      packName: asset.pack.label,
      path: asset.relativePath,
      semanticRole: asset.semanticRole,
      sha256: asset.sha256,
      source: {
        kind: 'image',
        path: `furnitures/${asset.relativePath}`,
      },
      sourceCrop: asset.sourceCrop,
      tags: asset.tags,
      visibleHeight: asset.sourceCrop.height,
      visibleWidth: asset.sourceCrop.width,
      width: asset.width,
    })),
  };
}

async function writeFolderManifests(manifest) {
  const assetsByFolder = new Map();

  for (const asset of manifest.assets) {
    const folder = asset.path.split('/')[0];
    const assets = assetsByFolder.get(folder) ?? [];
    assets.push(asset);
    assetsByFolder.set(folder, assets);
  }

  for (const folder of manifest.folders) {
    await writeFile(
      path.join(furnitureRoot, folder.path, 'manifest.generated.json'),
      `${JSON.stringify({
        generatedAt: manifest.generatedAt,
        schemaVersion: manifest.schemaVersion,
        folder,
        assets: assetsByFolder.get(folder.path) ?? [],
      }, null, 2)}\n`,
    );
  }
}

async function generateContactSheets(assets) {
  await rm(reviewDir, { force: true, recursive: true });
  await mkdir(reviewDir, { recursive: true });

  const batches = [];
  const assetsByFolder = new Map();

  for (const asset of assets) {
    const folderAssets = assetsByFolder.get(asset.folder) ?? [];
    folderAssets.push(asset);
    assetsByFolder.set(asset.folder, folderAssets);
  }

  for (const [folder, folderAssets] of assetsByFolder) {
    const pageSize = 120;

    for (let pageStart = 0; pageStart < folderAssets.length; pageStart += pageSize) {
      const pageAssets = folderAssets.slice(pageStart, pageStart + pageSize);
      const pageNumber = pageStart / pageSize + 1;
      const fileName = `${slugify(folder)}.page-${String(pageNumber).padStart(3, '0')}.png`;
      await writeContactSheet(path.join(reviewDir, fileName), pageAssets);
      batches.push({
        file: `_review/${fileName}`,
        folder,
        page: pageNumber,
        assets: pageAssets.map((asset) => ({
          assetKey: assetKey(asset),
          fileName: asset.fileName,
          path: asset.relativePath,
        })),
      });
    }
  }

  await writeFile(
    path.join(reviewDir, 'vlm-furniture-naming-prompt.md'),
    `${createVlmNamingPrompt()}\n`,
  );
  await writeFile(
    path.join(reviewDir, 'review-batches.generated.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      batchCount: batches.length,
      batches,
    }, null, 2)}\n`,
  );
}

async function writeContactSheet(outputPath, assets) {
  const sharp = await loadSharp();
  const columns = 10;
  const previewSize = 72;
  const labelHeight = 34;
  const padding = 8;
  const tileWidth = previewSize + padding * 2;
  const tileHeight = previewSize + labelHeight + padding * 2;
  const rows = Math.ceil(assets.length / columns);
  const width = columns * tileWidth;
  const height = rows * tileHeight;
  const composites = [];

  for (const [index, asset] of assets.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * tileWidth + padding;
    const top = row * tileHeight + padding;

    composites.push({
      input: await sharp(asset.absolutePath)
        .resize({
          width: previewSize,
          height: previewSize,
          fit: 'contain',
          background: { alpha: 0, b: 0, g: 0, r: 0 },
        })
        .png()
        .toBuffer(),
      left,
      top,
    });
    composites.push({
      input: Buffer.from(
        `<svg width="${previewSize}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#111827"/>
          <text x="4" y="13" fill="#e5e7eb" font-size="10" font-family="monospace">${escapeXml(assetKey(asset))}</text>
          <text x="4" y="27" fill="#94a3b8" font-size="9" font-family="monospace">${escapeXml(shortFileIndex(asset.fileName))}</text>
        </svg>`,
      ),
      left,
      top: top + previewSize,
    });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#020617',
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function loadSharp() {
  if (!sharpModule) {
    sharpModule = (await import('sharp')).default;
  }

  return sharpModule;
}

async function applyReviewedRenames(assets) {
  const updates = [];

  for (const review of reviewMap.reviews ?? []) {
    const sourcePath = review.sourcePath ?? review.originalPath;
    const reviewedFileName = review.reviewedFileName;

    if (!sourcePath || !reviewedFileName) {
      continue;
    }

    const asset = assets.find((candidate) => candidate.relativePath === sourcePath);

    if (!asset) {
      continue;
    }

    const safeFileName = await createUniqueReviewedFileName(asset, ensurePngFileName(reviewedFileName));
    const targetPath = path.join(furnitureRoot, asset.folder, safeFileName);

    if (asset.absolutePath === targetPath) {
      continue;
    }

    await rename(asset.absolutePath, targetPath);
    updates.push({
      from: asset.relativePath,
      to: `${asset.folder}/${safeFileName}`,
    });

    review.originalPath = review.originalPath ?? asset.relativePath;
    review.sourcePath = `${asset.folder}/${safeFileName}`;
    review.reviewedFileName = safeFileName;
  }

  if (updates.length > 0) {
    await writeFile(reviewMapPath, `${JSON.stringify(reviewMap, null, 2)}\n`);
  }
}

async function createUniqueReviewedFileName(asset, fileName) {
  const parsed = path.parse(fileName);
  let candidate = fileName;
  let suffix = 2;

  while (true) {
    const targetPath = path.join(furnitureRoot, asset.folder, candidate);

    if (targetPath === asset.absolutePath || !(await fileExists(targetPath))) {
      return candidate;
    }

    candidate = `${parsed.name}-${suffix}${parsed.ext}`;
    suffix += 1;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function findReviewForPath(relativePath) {
  return (reviewMap.reviews ?? []).find((review) => {
    return review.sourcePath === relativePath || review.originalPath === relativePath;
  });
}

function createVlmNamingPrompt() {
  return `# Observatory Furniture Naming Review

You are naming 48x48 furniture/decor sprites for a canvas asset manifest.
Return JSON only:

\`\`\`json
{
  "reviews": [
    {
      "sourcePath": "1_Modern_Office_Singles_48x48/Modern_Office_Singles_48x48_1.png",
      "reviewedFileName": "office-desk-front.png",
      "label": "Office Desk Front",
      "category": "desk",
      "semanticRole": "desk",
      "tags": ["office", "desk", "front"]
    }
  ]
}
\`\`\`

Rules:
- Use the assetKey printed on the contact sheet to match entries in review-batches.generated.json.
- Prefer accurate, boring names over creative names.
- If uncertain, use a generic name such as "storage-unit", "decor-object", "wall-prop", or "table".
- File names must be lowercase kebab-case and end with .png.
- Do not invent properties that are not visible.
`;
}

function inferPack(folder) {
  const withoutPrefix = folder.replace(/^\d+_/, '');
  const label = titleCase(withoutPrefix.replace(/_?Singles?_48x48/gi, '').replace(/_48x48/gi, ''));

  return {
    id: slugify(folder),
    label,
    tags: uniqueStrings(['48x48', ...label.toLowerCase().split(/\s+/).filter(Boolean)]),
  };
}

function inferCategory(folder, fileName) {
  const text = `${folder} ${fileName}`.toLowerCase();

  if (/(desk|table|counter|workstation)/.test(text)) {
    return 'desk';
  }

  if (/(chair|sofa|bench|seat)/.test(text)) {
    return 'seating';
  }

  if (/(shelf|storage|cabinet|book|drawer|locker)/.test(text)) {
    return 'storage';
  }

  if (/(kitchen|fridge|sink|stove|coffee|pantry)/.test(text)) {
    return 'pantry';
  }

  if (/(office|conference|classroom|library)/.test(text)) {
    return 'office';
  }

  return 'decor';
}

function inferSemanticRole(folder, fileName) {
  const text = `${folder} ${fileName}`.toLowerCase();
  const roleRules = [
    ['bookshelf', /(bookshelf|book)/],
    ['chair', /(chair|seat)/],
    ['computer', /(computer|pc)/],
    ['desk', /desk/],
    ['monitor', /(monitor|screen)/],
    ['plant', /plant/],
    ['sofa', /sofa/],
    ['table', /table/],
    ['storage', /(storage|cabinet|drawer|locker|shelf)/],
  ];

  for (const [role, pattern] of roleRules) {
    if (pattern.test(text)) {
      return role;
    }
  }

  return inferCategory(folder, fileName);
}

function inferTags(folder, fileName) {
  return uniqueStrings([
    ...inferPack(folder).tags,
    inferCategory(folder, fileName),
    inferSemanticRole(folder, fileName),
  ]);
}

function labelFromFileName(fileName) {
  return titleCase(fileName.replace(/\.[^.]+$/, '').replace(/_\d+$/, ''));
}

function assetKey(asset) {
  return `${slugify(asset.folder)}:${shortFileIndex(asset.fileName)}`;
}

function shortFileIndex(fileName) {
  return fileName.match(/(\d+)\.png$/)?.[1] ?? path.basename(fileName, '.png');
}

function titleCase(value) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function ensurePngFileName(value) {
  return `${slugify(value.replace(/\.png$/i, ''))}.png`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function readOptionalJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
}

function parseCliValues(flag) {
  const values = [];

  for (const [index, arg] of process.argv.entries()) {
    if (arg === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      continue;
    }

    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }

  return values.flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));
}
