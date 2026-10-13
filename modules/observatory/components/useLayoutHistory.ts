'use client';
import { useCallback, useReducer, useRef } from 'react';
import { reduceLayoutHistory } from '../engine/world/layoutHistory';
import type { ObservatoryLayoutDocument } from '../engine/world/layoutTypes';

export function useLayoutHistory(initialLayout: () => ObservatoryLayoutDocument | null) {
  const [history, dispatch] = useReducer(reduceLayoutHistory, undefined, () => ({
    past: [],
    present: initialLayout(),
    future: [],
  }));
  const gesture = useRef<number | undefined>(undefined);
  const sequence = useRef(0);
  return {
    layout: history.present,
    setLayout: useCallback(
      (layout: ObservatoryLayoutDocument | null) =>
        dispatch({ type: 'commit', layout, gesture: gesture.current }),
      []
    ),
    replaceLayout: useCallback(
      (layout: ObservatoryLayoutDocument | null) => dispatch({ type: 'replace', layout }),
      []
    ),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    beginGesture: () => {
      gesture.current = ++sequence.current;
    },
    endGesture: () => {
      gesture.current = undefined;
    },
  };
}
