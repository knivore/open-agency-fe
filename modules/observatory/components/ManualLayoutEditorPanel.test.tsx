import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ManualLayoutEditorPanel from './ManualLayoutEditorPanel';
import published from '../layouts/publishedLayout.json';
import { cloneObservatoryLayout } from '../engine/world/layoutEditing';
import type { ObservatoryLayoutDocument } from '../engine/world/layoutTypes';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], layout: published }) })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('selects a room without adding furniture and auto-places the complete desk only on request', async () => {
  const layout = cloneObservatoryLayout(published as ObservatoryLayoutDocument);
  layout.world.maps[0].objects = [];
  layout.world.maps[0].agents = [];
  const onLayoutChange = vi.fn();
  await act(async () => {
    render(<ManualLayoutEditorPanel layout={layout} onLayoutChange={onLayoutChange} />);
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search manifest assets' }), {
    target: { value: 'wide white desk front' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Add to' }), {
    target: { value: 'room:level-1-common-work' },
  });
  expect(onLayoutChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Auto-place in room' }));
  expect(onLayoutChange).toHaveBeenCalledTimes(1);
  const objects = (onLayoutChange.mock.calls[0][0] as ObservatoryLayoutDocument).world.maps[0]
    .objects;
  expect(objects).toHaveLength(2);
  expect(objects[1].runtime).toEqual({ role: 'surface-trim', targetObjectId: objects[0].id });
  expect(objects.every((object) => object.roomId === 'room:level-1-common-work')).toBe(true);
});
