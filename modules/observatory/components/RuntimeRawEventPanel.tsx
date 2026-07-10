'use client';

import { useState } from 'react';

import type {
  ObservatoryEventValidationIssue,
  ObservatoryExternalRuntimeEvent,
} from '@/modules/observatory/runtime/events';

import styles from './RuntimeRawEventPanel.module.css';

export interface RuntimeRawEventPanelProps {
  disabled?: boolean;
  issues: ObservatoryEventValidationIssue[];
  onPushRawEvent: (rawEvent: unknown) => void;
  sampleEvent: ObservatoryExternalRuntimeEvent;
}

function formatEvent(event: ObservatoryExternalRuntimeEvent) {
  return JSON.stringify(event, null, 2);
}

export default function RuntimeRawEventPanel({
  disabled,
  issues,
  onPushRawEvent,
  sampleEvent,
}: RuntimeRawEventPanelProps) {
  const [draft, setDraft] = useState(() => formatEvent(sampleEvent));
  const [parseError, setParseError] = useState('');

  const pushDraft = () => {
    try {
      const parsed = JSON.parse(draft) as unknown;
      setParseError('');
      onPushRawEvent(parsed);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Invalid JSON payload.');
    }
  };

  return (
    <section className={styles.panel} aria-label="Observatory raw runtime event">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Raw Event Injector</h2>
          <p className={styles.description}>
            Paste one runtime event JSON object and push it directly into the preview reducer.
          </p>
        </div>
        <span className={styles.badge}>json</span>
      </div>
      <textarea
        className={styles.textarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
        disabled={disabled}
      />
      <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={pushDraft} disabled={disabled}>
          Push raw event
        </button>
        <button
          className={`${styles.button} ${styles.buttonSecondary}`}
          type="button"
          onClick={() => {
            setDraft(formatEvent(sampleEvent));
            setParseError('');
          }}
          disabled={disabled}
        >
          Reset example
        </button>
      </div>
      {parseError ? <div className={styles.issue}>JSON parse error: {parseError}</div> : null}
      {issues.length > 0 ? (
        <div className={styles.issue}>
          {issues.map((issue) => `${issue.path}: ${issue.reason}`).join('\n')}
        </div>
      ) : null}
    </section>
  );
}
