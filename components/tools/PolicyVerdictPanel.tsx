'use client';

import { Badge } from '@/components/library/shadcn/badge';
import type { PolicyVerdict } from '@/types/toolContracts';

const verdictTone = {
  ok: 'border-(--agency-success-border) bg-(--agency-success-bg) text-(--agency-success-text)',
  warn: 'border-(--agency-warning-border) bg-(--agency-warning-bg) text-(--agency-warning-text)',
  deny: 'border-(--agency-danger-border) bg-(--agency-danger-bg) text-(--agency-danger-text)',
} as const;

export default function PolicyVerdictPanel({ verdict }: { verdict?: PolicyVerdict | null }) {
  if (!verdict) {
    return <p className="text-sm text-(--agency-shell-muted)">No policy verdict returned.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-(--agency-shell-text)">Policy score</p>
        <Badge variant="outline">{verdict.score}</Badge>
      </div>
      <div className="space-y-2">
        {verdict.rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-xl border border-(--agency-shell-border) bg-background p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-(--agency-shell-text)">{rule.id}</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${verdictTone[rule.outcome]}`}
              >
                {rule.outcome}
              </span>
            </div>
            {rule.reason ? (
              <p className="mt-2 text-xs text-(--agency-shell-muted)">{rule.reason}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
