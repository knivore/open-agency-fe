import { expect, it } from 'vitest';
import { reduceLayoutHistory } from './layoutHistory';
import type { ObservatoryLayoutDocument } from './layoutTypes';
const layout = (id: number) => ({ schemaVersion: id }) as ObservatoryLayoutDocument;
it('coalesces a drag, restores it, and clears redo after a new edit', () => {
  let state = reduceLayoutHistory(
    { past: [], present: layout(1), future: [] },
    { type: 'commit', layout: layout(2), gesture: 1 }
  );
  state = reduceLayoutHistory(state, { type: 'commit', layout: layout(3), gesture: 1 });
  expect(state.past).toEqual([layout(1)]);
  state = reduceLayoutHistory(state, { type: 'undo' });
  expect(state.present).toEqual(layout(1));
  state = reduceLayoutHistory(state, { type: 'redo' });
  expect(state.present).toEqual(layout(3));
  state = reduceLayoutHistory(state, { type: 'undo' });
  state = reduceLayoutHistory(state, { type: 'commit', layout: layout(4) });
  expect(state.future).toEqual([]);
  expect(reduceLayoutHistory(state, { type: 'replace', layout: layout(5) }).past).toEqual([]);
});
