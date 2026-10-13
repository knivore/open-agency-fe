import type { ObservatoryLayoutDocument } from './layoutTypes';

export interface LayoutHistory {
  past: Array<ObservatoryLayoutDocument | null>;
  present: ObservatoryLayoutDocument | null;
  future: Array<ObservatoryLayoutDocument | null>;
  gesture?: number;
}
export type LayoutHistoryAction =
  | { type: 'commit' | 'replace'; layout: ObservatoryLayoutDocument | null; gesture?: number }
  | { type: 'undo' }
  | { type: 'redo' };
export function reduceLayoutHistory(
  state: LayoutHistory,
  action: LayoutHistoryAction
): LayoutHistory {
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
    };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  if (action.type === 'replace') return { past: [], present: action.layout, future: [] };
  if (JSON.stringify(state.present) === JSON.stringify(action.layout)) return state;
  // Pointer gestures can produce many tile or slider updates. Preserve one
  // pre-gesture snapshot so Undo reverses the complete user action.
  const coalesced = action.gesture !== undefined && action.gesture === state.gesture;
  return {
    past: coalesced ? state.past : [...state.past, state.present].slice(-50),
    present: action.layout,
    future: [],
    gesture: action.gesture,
  };
}
