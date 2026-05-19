'use client';

import type { ObservatoryRuntimeEntityStatus, ObservatoryRuntimeVisualState } from '@/modules/observatory/runtime/visualState';

import styles from './RuntimeStateSummary.module.css';

export interface RuntimeStateSummaryProps {
  state: ObservatoryRuntimeVisualState;
}

const statusLabels: ObservatoryRuntimeEntityStatus[] = ['working', 'blocked', 'error', 'complete', 'idle', 'unknown'];

export default function RuntimeStateSummary({ state }: RuntimeStateSummaryProps) {
  const agents = Object.values(state.agentsById).sort((left, right) => left.id.localeCompare(right.id));
  const activeTasks = Object.values(state.tasksById)
    .filter((task) => task.status !== 'complete')
    .sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));
  const workflows = Object.values(state.workflowsById).sort((left, right) => right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));

  return (
    <aside className={styles.panel} aria-label="Observatory runtime state summary">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Runtime State</h2>
          <p className={styles.description}>Current reducer output driving movement, room highlights, progress bars, and outcome rings.</p>
        </div>
        <span className={styles.badge}>{state.eventHistory.length} events</span>
      </div>

      <div className={styles.stats} aria-label="Runtime entity counts">
        <SummaryStat label="Agents" value={agents.length} />
        <SummaryStat label="Active Tasks" value={activeTasks.length} />
        <SummaryStat label="Workflows" value={workflows.length} />
      </div>

      <div className={styles.statusRow}>
        {statusLabels.map((status) => (
          <span key={status} className={`${styles.statusPill} ${styles[`status${capitalizeStatus(status)}`]}`}>
            {status}: {agents.filter((agent) => agent.status === status).length}
          </span>
        ))}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Agents</h3>
        {agents.length === 0 ? (
          <p className={styles.empty}>No agent state yet.</p>
        ) : (
          <div className={styles.list}>
            {agents.map((agent) => (
              <article key={agent.id} className={styles.row}>
                <div>
                  <strong>{agent.id}</strong>
                  <span>{agent.taskTitle ?? agent.currentRoomId ?? agent.id}</span>
                </div>
                <ProgressMeter progress={agent.taskProgress} status={agent.status} />
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Rooms</h3>
        {workflows.length === 0 ? (
          <p className={styles.empty}>No workflow room state yet.</p>
        ) : (
          <div className={styles.roomGrid}>
            {workflows.map((workflow) => (
              <span key={workflow.id} className={`${styles.roomToken} ${styles[`status${capitalizeStatus(workflow.status)}`]}`}>
                {workflow.id} {'->'} {workflow.roomId ?? 'unplaced'}
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressMeter({ progress, status }: { progress: number | undefined; status: ObservatoryRuntimeEntityStatus }) {
  const safeProgress = Math.max(0, Math.min(1, progress ?? 0));

  return (
    <div className={styles.progressWrap} aria-label={`${status} ${Math.round(safeProgress * 100)} percent`}>
      <span className={`${styles.progressStatus} ${styles[`status${capitalizeStatus(status)}`]}`}>{status}</span>
      <span className={styles.progressTrack}>
        <span className={styles.progressFill} style={{ width: `${Math.max(4, safeProgress * 100)}%` }} />
      </span>
      <span className={styles.progressValue}>{Math.round(safeProgress * 100)}%</span>
    </div>
  );
}

function capitalizeStatus(status: ObservatoryRuntimeEntityStatus) {
  return `${status[0]?.toUpperCase() ?? ''}${status.slice(1)}`;
}
