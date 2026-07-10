'use client';

import type { ObservatoryNormalizedOfficeEvent } from '@/modules/observatory/runtime/events';
import {
  clampObservatoryReplayCursor,
  createObservatoryReplayFrame,
} from '@/modules/observatory/runtime/replayTimeline';

import styles from './RuntimeReplayControls.module.css';

export interface RuntimeReplayControlsProps {
  cursor: number;
  disabled?: boolean;
  events: ObservatoryNormalizedOfficeEvent[];
  onCursorChange: (cursor: number) => void;
  onReplayLatest: () => void;
}

export default function RuntimeReplayControls({
  cursor,
  disabled,
  events,
  onCursorChange,
  onReplayLatest,
}: RuntimeReplayControlsProps) {
  const frame = createObservatoryReplayFrame(events, cursor);
  const safeCursor = clampObservatoryReplayCursor(cursor, frame.totalEvents);
  const eventNumber = safeCursor >= 0 ? safeCursor + 1 : 0;
  const activeEvent = frame.event;

  return (
    <section className={styles.panel} aria-label="Observatory replay time travel controls">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Replay Timeline</h2>
          <p className={styles.description}>
            Scrub normalized runtime history and rebuild visual state at any event.
          </p>
        </div>
        <span className={styles.badge}>
          {eventNumber}/{frame.totalEvents}
        </span>
      </div>

      <div className={styles.timeline}>
        <input
          aria-label="Replay timeline cursor"
          className={styles.range}
          disabled={disabled || frame.totalEvents === 0}
          max={Math.max(0, frame.totalEvents - 1)}
          min={0}
          onChange={(event) => onCursorChange(Number(event.currentTarget.value))}
          type="range"
          value={Math.max(0, safeCursor)}
        />
        <div className={styles.eventMeta}>
          <span>{activeEvent ? activeEvent.id : 'No replayable events'}</span>
          <span>
            {activeEvent
              ? `${activeEvent.type} from ${activeEvent.source}`
              : 'Push or replay events to populate history.'}
          </span>
          <span>{activeEvent?.timestamp ?? 'empty timeline'}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.button}
          disabled={disabled || !frame.hasPrevious}
          onClick={() => onCursorChange(0)}
          type="button"
        >
          First
        </button>
        <button
          className={styles.button}
          disabled={disabled || !frame.hasPrevious}
          onClick={() => onCursorChange(safeCursor - 1)}
          type="button"
        >
          Prev
        </button>
        <button
          className={styles.button}
          disabled={disabled || !frame.hasNext}
          onClick={() => onCursorChange(safeCursor + 1)}
          type="button"
        >
          Next
        </button>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={disabled || frame.totalEvents === 0}
          onClick={onReplayLatest}
          type="button"
        >
          Latest
        </button>
      </div>
    </section>
  );
}
