import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ObservatoryLayoutDocument } from '../engine/world/layoutTypes';
import type { ObservatoryLayoutLibraryEntry } from '../engine/world/layoutLibrary';
import { validateObservatoryLayout } from '../engine/world/layoutValidation';

export function observatoryLayoutDataDirectory() {
  // The development container mounts source read-only. Its .next volume is
  // writable; deployments should point this setting at a persistent data volume.
  return path.resolve(
    process.env.AGENCY_OBSERVATORY_DATA_DIR || path.join(process.cwd(), '.next', 'observatory-data')
  );
}

function safeId(value: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,159}$/u.test(value)) throw new Error('Invalid layout file ID.');
  return value;
}
async function optionalRead(file: string) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
async function jsonFiles(directory: string) {
  try {
    return (await readdir(directory)).filter((file) => file.endsWith('.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
async function atomicWrite(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    // Readers see either complete revision, even if a save is interrupted.
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
function parseLayout(source: string, file: string) {
  const validation = validateObservatoryLayout(JSON.parse(source));
  if (!validation.layout) throw new Error(`Layout ${file} failed validation.`);
  return validation.layout;
}

export function createObservatoryLayoutStore(
  dataDirectory = observatoryLayoutDataDirectory(),
  seedDirectory = path.join(process.cwd(), 'modules', 'observatory', 'layouts')
) {
  const library = path.join(dataDirectory, 'library');
  const deleted = path.join(dataDirectory, 'deleted');
  return {
    async readLibrary(): Promise<ObservatoryLayoutLibraryEntry[]> {
      const entries = new Map<string, ObservatoryLayoutLibraryEntry>();
      for (const directory of [path.join(seedDirectory, 'library'), library]) {
        for (const fileName of await jsonFiles(directory)) {
          const fileId = fileName.slice(0, -5);
          if (await optionalRead(path.join(deleted, `${fileId}.json`))) continue;
          const source = await optionalRead(path.join(directory, fileName));
          if (source)
            entries.set(fileId, { fileId, fileName, layout: parseLayout(source, fileName) });
        }
      }
      return [...entries.values()].sort(
        (a, b) =>
          (Date.parse(b.layout.metadata?.updatedAt ?? '') || 0) -
          (Date.parse(a.layout.metadata?.updatedAt ?? '') || 0)
      );
    },
    async save(fileId: string, layout: ObservatoryLayoutDocument) {
      await atomicWrite(path.join(library, `${safeId(fileId)}.json`), layout);
      await unlink(path.join(deleted, `${fileId}.json`)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    },
    async remove(fileId: string) {
      safeId(fileId);
      const entry = (await this.readLibrary()).find((candidate) => candidate.fileId === fileId);
      if (!entry) throw new Error('Saved layout not found.');
      // Preserve a recoverable snapshot, including read-only bundled layouts.
      await atomicWrite(path.join(deleted, `${fileId}.json`), entry.layout);
    },
    async restore(fileId: string) {
      const source = await optionalRead(path.join(deleted, `${safeId(fileId)}.json`));
      if (!source) throw new Error('Removed layout not found.');
      await this.save(fileId, parseLayout(source, fileId));
    },
    async readPublished() {
      const saved = await optionalRead(path.join(dataDirectory, 'publishedLayout.json'));
      const source =
        saved ?? (await readFile(path.join(seedDirectory, 'publishedLayout.json'), 'utf8'));
      return {
        layout: parseLayout(source, 'publishedLayout.json'),
        source: saved ? 'server' : 'bundled',
      };
    },
    async publish(layout: ObservatoryLayoutDocument) {
      await atomicWrite(path.join(dataDirectory, 'publishedLayout.json'), layout);
    },
  };
}
