#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoLayoutPath = path.join(moduleRoot, 'layouts', 'publishedLayout.json');
const schemaVersion = 1;
const idPattern = /^[a-z0-9][a-z0-9:-]*$/;
const roomKinds = new Set(['workspace', 'runtime', 'commons']);
const agentStatuses = new Set(['idle', 'working', 'blocked', 'complete', 'error']);

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const inputPath = args.find((argument) => !argument.startsWith('-'));

  if (!inputPath || inputPath === '--help' || inputPath === '-h') {
    console.log('Usage: node modules/observatory/scripts/save-layout-to-repo.mjs [--check] <exported-layout.json>');
    console.log(`Writes validated layout JSON to ${path.relative(process.cwd(), repoLayoutPath)}`);
    return;
  }

  const source = await readFile(path.resolve(inputPath), 'utf8');
  const layout = JSON.parse(source);
  const issues = validateLayout(layout);

  if (issues.length > 0) {
    console.error(`Layout validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }

  const publishedLayout = markPublished(layout);

  if (checkOnly) {
    console.log(`Validated Observatory layout: ${path.relative(process.cwd(), path.resolve(inputPath))}`);
    return;
  }

  await writeFile(repoLayoutPath, `${JSON.stringify(publishedLayout, null, 2)}\n`, 'utf8');
  console.log(`Saved repo-backed Observatory layout: ${path.relative(process.cwd(), repoLayoutPath)}`);
}

function markPublished(layout) {
  const timestamp = new Date().toISOString();
  const metadata = layout.metadata && isRecord(layout.metadata) ? layout.metadata : {};

  return {
    ...layout,
    metadata: {
      ...metadata,
      id: metadata.id ?? layout.world.id,
      name: metadata.name ?? layout.world.name,
      publishedAt: metadata.publishedAt ?? timestamp,
      publishedBy: metadata.publishedBy ?? 'repo-script',
      status: 'published',
      updatedAt: timestamp,
      version: positiveInteger(metadata.version) ? metadata.version : 1,
    },
  };
}

function validateLayout(layout) {
  const issues = [];

  if (!isRecord(layout)) {
    return ['layout must be an object'];
  }

  if (layout.schemaVersion !== schemaVersion) {
    issues.push(`schemaVersion must be ${schemaVersion}`);
  }

  if (!isRecord(layout.world)) {
    issues.push('world must be an object');
    return issues;
  }

  if (!id(layout.world.id)) {
    issues.push('world.id must be a lowercase identifier');
  }

  if (!nonEmptyString(layout.world.name)) {
    issues.push('world.name must be a non-empty string');
  }

  if (!isRecord(layout.world.grid) || !positiveInteger(layout.world.grid.tileSize) || !gridSize(layout.world.grid.size)) {
    issues.push('world.grid must include positive tileSize and size');
  }

  if (!Array.isArray(layout.world.maps) || layout.world.maps.length === 0) {
    issues.push('world.maps must be a non-empty array');
    return issues;
  }

  layout.world.maps.forEach((map, mapIndex) => validateMap(map, `world.maps[${mapIndex}]`, issues));
  return issues;
}

function validateMap(map, pathPrefix, issues) {
  if (!isRecord(map)) {
    issues.push(`${pathPrefix} must be an object`);
    return;
  }

  if (!id(map.id)) {
    issues.push(`${pathPrefix}.id must be a lowercase identifier`);
  }

  if (!nonEmptyString(map.name)) {
    issues.push(`${pathPrefix}.name must be a non-empty string`);
  }

  if (!gridSize(map.size)) {
    issues.push(`${pathPrefix}.size must be a positive grid size`);
  }

  if (!id(map.defaultFloorAssetId)) {
    issues.push(`${pathPrefix}.defaultFloorAssetId must be a lowercase asset identifier`);
  }

  if (!Array.isArray(map.rooms)) {
    issues.push(`${pathPrefix}.rooms must be an array`);
    return;
  }

  const roomIds = new Set();
  map.rooms.forEach((room, roomIndex) => {
    if (!isRecord(room)) {
      issues.push(`${pathPrefix}.rooms[${roomIndex}] must be an object`);
      return;
    }

    if (!id(room.id)) {
      issues.push(`${pathPrefix}.rooms[${roomIndex}].id must be a lowercase identifier`);
    } else {
      roomIds.add(room.id);
    }

    if (!nonEmptyString(room.name)) {
      issues.push(`${pathPrefix}.rooms[${roomIndex}].name must be a non-empty string`);
    }

    if (!roomKinds.has(room.kind)) {
      issues.push(`${pathPrefix}.rooms[${roomIndex}].kind must be workspace, runtime, or commons`);
    }

    if (!gridRect(room.bounds)) {
      issues.push(`${pathPrefix}.rooms[${roomIndex}].bounds must be a valid grid rect`);
    }
  });

  validateObjects(map.objects, roomIds, `${pathPrefix}.objects`, issues);
  validateAgents(map.agents, roomIds, `${pathPrefix}.agents`, issues);
}

function validateObjects(objects, roomIds, pathPrefix, issues) {
  if (!Array.isArray(objects)) {
    issues.push(`${pathPrefix} must be an array`);
    return;
  }

  objects.forEach((object, index) => {
    if (!isRecord(object)) {
      issues.push(`${pathPrefix}[${index}] must be an object`);
      return;
    }

    if (!id(object.id)) {
      issues.push(`${pathPrefix}[${index}].id must be a lowercase identifier`);
    }

    if (!id(object.assetId)) {
      issues.push(`${pathPrefix}[${index}].assetId must be a lowercase asset identifier`);
    }

    if (object.roomId !== undefined && !roomIds.has(object.roomId)) {
      issues.push(`${pathPrefix}[${index}].roomId must reference an existing room`);
    }

    if (!gridPoint(object.position)) {
      issues.push(`${pathPrefix}[${index}].position must be a valid grid point`);
    }

    if (object.size !== undefined && !gridSize(object.size)) {
      issues.push(`${pathPrefix}[${index}].size must be a valid grid size`);
    }
  });
}

function validateAgents(agents, roomIds, pathPrefix, issues) {
  if (!Array.isArray(agents)) {
    issues.push(`${pathPrefix} must be an array`);
    return;
  }

  agents.forEach((agent, index) => {
    if (!isRecord(agent)) {
      issues.push(`${pathPrefix}[${index}] must be an object`);
      return;
    }

    if (!id(agent.id)) {
      issues.push(`${pathPrefix}[${index}].id must be a lowercase identifier`);
    }

    if (!nonEmptyString(agent.name)) {
      issues.push(`${pathPrefix}[${index}].name must be a non-empty string`);
    }

    if (!id(agent.assetId)) {
      issues.push(`${pathPrefix}[${index}].assetId must be a lowercase asset identifier`);
    }

    if (agent.roomId !== undefined && !roomIds.has(agent.roomId)) {
      issues.push(`${pathPrefix}[${index}].roomId must reference an existing room`);
    }

    if (!gridPoint(agent.position)) {
      issues.push(`${pathPrefix}[${index}].position must be a valid grid point`);
    }

    if (!agentStatuses.has(agent.status)) {
      issues.push(`${pathPrefix}[${index}].status must be idle, working, blocked, complete, or error`);
    }
  });
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function id(value) {
  return nonEmptyString(value) && idPattern.test(value);
}

function positiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function gridPoint(value) {
  return isRecord(value) && nonNegativeInteger(value.x) && nonNegativeInteger(value.y);
}

function gridSize(value) {
  return isRecord(value) && positiveInteger(value.width) && positiveInteger(value.height);
}

function gridRect(value) {
  return gridPoint(value) && gridSize(value);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
