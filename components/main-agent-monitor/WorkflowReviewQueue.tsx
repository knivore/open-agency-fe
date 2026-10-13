'use client';
import Link from 'next/link';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {queryKeys} from '@/lib/react-query/queryKeys';
import {appApiClient} from '@/lib/api/clientInstances';

type Job = {
  id: string;
  workflow_id: string;
  execution_id: string;
  status: string;
  created_at: string;
  improvement_status?: string;
  result?: { lesson_status?: string; improvement?: { status?: string } };
  recovery?: { retry_allowed: boolean; next_action: string };
};
export default function WorkflowReviewQueue({
                                              jobs,
                                              refresh,
                                            }: {
  jobs: Job[];
  refresh: () => void;
}) {
  const client = useQueryClient();
  const retry = useMutation({
    mutationFn: (id: string) =>
      appApiClient.post(`/api/main-agent/monitor/reviews/${encodeURIComponent(id)}/retry`, {}),
    onSuccess: () => {
      refresh();
      void client.invalidateQueries({queryKey: queryKeys.backendMainAgentMonitor()});
    },
  });
  const counts = jobs.reduce<Record<string, number>>(
    (result, job) => ({...result, [job.status]: (result[job.status] || 0) + 1}),
    {}
  );
  const recent = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);
  return (
    <section className="space-y-4 rounded-xl border bg-white p-6 dark:bg-slate-950">
      <h2 className="text-xl font-semibold">Workflow learning & repair</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Reviews run after completions, issues and webhook feedback. Changes require approval; a
        repair is verified only after a comparable run.
      </p>
      <p className="text-sm" role="status">
        {Object.entries(counts)
          .map(([status, count]) => `${count} ${status.replaceAll('_', ' ')}`)
          .join(' · ') || 'No reviews yet.'}
      </p>
      {retry.error ? <p role="alert">{retry.error.message}</p> : null}
      <div className="space-y-3">
        {recent.map((job) => (
          <article key={job.id} className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <Link className="underline" href={`/runs/${encodeURIComponent(job.execution_id)}`}>
                Run {job.execution_id.slice(0, 8)}
              </Link>
              <span>
                {(
                  job.improvement_status ||
                  job.result?.improvement?.status ||
                  job.status
                ).replaceAll('_', ' ')}
              </span>
            </div>
            {job.recovery ? <p>{job.recovery.next_action}</p> : null}
            {job.result?.lesson_status === 'requires_memory_confirmation' ? (
              <p>
                Review finished. Its lesson was not saved because memory confirmation is required.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-4">
              <Link
                className="underline"
                href={`/workflows/${encodeURIComponent(job.workflow_id)}?tab=monitoring`}
              >
                Workflow evidence
              </Link>
              {job.recovery?.retry_allowed ? (
                <button
                  className="underline disabled:opacity-50"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(job.id)}
                >
                  Retry investigation
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {jobs.length > 12 ? (
        <p className="text-xs text-neutral-500">
          Showing the 12 most recent reviews. Older findings remain attached to their workflows.
        </p>
      ) : null}
    </section>
  );
}
