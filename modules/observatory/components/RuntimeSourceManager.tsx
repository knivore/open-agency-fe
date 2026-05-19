'use client';

import type { ObservatoryEventValidationIssue } from '@/modules/observatory/runtime/events';
import type { ObservatoryRuntimeSourceStatus } from '@/modules/observatory/integrations/sourceRegistry';

import styles from './RuntimeSourceManager.module.css';

export interface RuntimeSourceManagerProps {
  acceptedEventCount: number;
  disabled?: boolean;
  issues: ObservatoryEventValidationIssue[];
  onPushSampleEvent: () => void;
  sourceStatuses: ObservatoryRuntimeSourceStatus[];
}

export default function RuntimeSourceManager({
  acceptedEventCount,
  disabled,
  issues,
  onPushSampleEvent,
  sourceStatuses,
}: RuntimeSourceManagerProps) {
  return (
    <section className={styles.panel} aria-label="Observatory runtime source manager">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Source Manager</h2>
          <p className={styles.description}>Local direct-to-FE bridge, local SDK client, and same-origin postMessage receiver.</p>
        </div>
        <span className={styles.badge}>local</span>
      </div>
      <div className={styles.sourceList}>
        {sourceStatuses.map((source) => (
          <div className={styles.sourceRow} key={source.id}>
            <div>
              <div className={styles.sourceTitle}>{source.label}</div>
              {source.description ? <div className={styles.description}>{source.description}</div> : null}
            </div>
            <span className={source.enabled && source.acceptsCurrentOrigin ? styles.sourceOk : styles.sourceBlocked}>
              {source.enabled && source.acceptsCurrentOrigin ? 'allowed' : 'blocked'}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={onPushSampleEvent} disabled={disabled}>
          Push next sample event
        </button>
        <span className={styles.description}>{acceptedEventCount} accepted events</span>
      </div>
      {issues.length > 0 ? (
        <div className={styles.issue}>{issues.map((issue) => `${issue.path}: ${issue.reason}`).join('\n')}</div>
      ) : null}
    </section>
  );
}
