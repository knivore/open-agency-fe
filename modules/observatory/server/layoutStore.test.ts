import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import published from '../layouts/publishedLayout.json';
import type { ObservatoryLayoutDocument } from '../engine/world/layoutTypes';
import { createObservatoryLayoutStore } from './layoutStore';

it('saves, deploys, reloads and recovers layouts without modifying bundled source', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'observatory-store-'));
  try {
    expect(path.resolve(temporary).startsWith(path.resolve(tmpdir()) + path.sep)).toBe(true);
    const seed = path.join(temporary, 'source');
    const data = path.join(temporary, 'data');
    await mkdir(path.join(seed, 'library'), { recursive: true });
    const original = JSON.stringify(published);
    await writeFile(path.join(seed, 'publishedLayout.json'), original);
    await writeFile(path.join(seed, 'library', 'default.json'), original);
    const store = createObservatoryLayoutStore(data, seed);
    expect((await store.readPublished()).source).toBe('bundled');
    const layout = {
      ...published,
      metadata: { ...published.metadata, name: 'Saved office' },
    } as ObservatoryLayoutDocument;
    await store.save('default', layout);
    await store.publish(layout);
    const reopened = createObservatoryLayoutStore(data, seed);
    expect((await reopened.readLibrary())[0].layout.metadata?.name).toBe('Saved office');
    expect((await reopened.readPublished()).layout.metadata?.name).toBe('Saved office');
    await reopened.remove('default');
    expect(await reopened.readLibrary()).toHaveLength(0);
    await reopened.restore('default');
    expect(await reopened.readLibrary()).toHaveLength(1);
    expect(await readFile(path.join(seed, 'publishedLayout.json'), 'utf8')).toBe(original);
    expect(await readFile(path.join(seed, 'library', 'default.json'), 'utf8')).toBe(original);
    await expect(store.save('../escape', layout)).rejects.toThrow('Invalid layout file ID');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
