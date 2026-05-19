'use client';

import { Badge } from '@/components/library/shadcn/badge';
import type { PolicyVerdict } from '@/types/toolContracts';

const verdictTone = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  deny: 'border-red-200 bg-red-50 text-red-700',
} as const;

export default function PolicyVerdictPanel({ verdict }: { verdict?: PolicyVerdict | null }) {
  if (!verdict) {
    return <p className="text-sm text-neutral-500">No policy verdict returned.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-900">Policy score</p>
        <Badge variant="outline">{verdict.score}</Badge>
      </div>
      <div className="space-y-2">
        {verdict.rules.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-neutral-700">{rule.id}</p>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${verdictTone[rule.outcome]}`}>
                {rule.outcome}
              </span>
            </div>
            {rule.reason ? <p className="mt-2 text-xs text-neutral-500">{rule.reason}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
