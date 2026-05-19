'use client';

import type { ObservatoryRuntimeLevel } from '@/modules/observatory/runtime/events';
import type { ObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';

import styles from './RuntimeActivityFeed.module.css';

export type ObservatoryFeedLevelFilter = 'all' | ObservatoryRuntimeLevel;

export interface RuntimeActivityFeedProps {
  levelFilter: ObservatoryFeedLevelFilter;
  onClear: () => void;
  onLevelFilterChange: (level: ObservatoryFeedLevelFilter) => void;
  onPausedChange: (paused: boolean) => void;
  paused: boolean;
  readOnly?: boolean;
  state: ObservatoryRuntimeVisualState;
}

const levels: ObservatoryFeedLevelFilter[] = [
  'all',
  'debug',
  'info',
  'warning',
  'error',
  'success',
];

export default function RuntimeActivityFeed({
  levelFilter,
  onClear,
  onLevelFilterChange,
  onPausedChange,
  paused,
  readOnly,
  state,
}: RuntimeActivityFeedProps) {
  const entries = state.activityFeed.filter(
    (entry) => levelFilter === 'all' || entry.level === levelFilter
  );

  return (
    <aside className={styles.feed} aria-label="Observatory runtime activity feed">
      <div className={styles.toolbar}>
        <div>
          <h2 className={styles.title}>Runtime Activity Feed</h2>
          <div className={styles.meta}>
            <span>{state.activityFeed.length} retained</span>
            <span>{state.droppedStaleEventCount} stale dropped</span>
          </div>
        </div>
        <div className={styles.controls}>
          <select
            className={styles.select}
            value={levelFilter}
            onChange={(event) =>
              onLevelFilterChange(event.target.value as ObservatoryFeedLevelFilter)
            }
            aria-label="Filter runtime activity level"
          >
            {levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {readOnly ? null : (
            <>
              <button
                className={styles.button}
                type="button"
                onClick={() => onPausedChange(!paused)}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button className={styles.button} type="button" onClick={onClear}>
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.list}>
        {entries.length === 0 ? (
          <div className={styles.empty}>
            {paused ? 'Feed is paused.' : 'No events match this filter.'}
          </div>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className={`${styles.entry} ${classNameForLevel(entry.level)}`}>
              <div className={styles.meta}>
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span>{entry.level}</span>
                <span>{entry.type}</span>
                <span>{entry.source}</span>
              </div>
              <p className={styles.message}>{entry.message ?? entry.title ?? entry.eventId}</p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function classNameForLevel(level: ObservatoryRuntimeLevel) {
  if (level === 'success') {
    return styles.entrySuccess;
  }
  if (level === 'error') {
    return styles.entryError;
  }
  if (level === 'warning') {
    return styles.entryWarning;
  }
  if (level === 'debug') {
    return styles.entryDebug;
  }
  return '';
}
