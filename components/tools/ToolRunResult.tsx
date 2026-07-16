'use client';

import DiffViewer from '@/components/tools/DiffViewer';
import PolicyVerdictPanel from '@/components/tools/PolicyVerdictPanel';
import { Badge } from '@/components/library/shadcn/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import type { ToolRunResponse } from '@/types/toolContracts';

const resultTone = {
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-900',
  deny: 'bg-red-100 text-red-800',
} as const;

export default function ToolRunResult({ result }: { result?: ToolRunResponse | null }) {
  if (!result) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-neutral-500">
          Run a contract dry-run to see policy results, changed files, signatures, and patch output.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            Runtime verdict
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${resultTone[result.verdict]}`}
            >
              {result.verdict}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-xs text-neutral-600">
            <p>Dry run: {result.dryRun ? 'true' : 'false'}</p>
            <p>Timestamp: {result.timestamp}</p>
            <p className="break-all">Signature: {result.signature ?? 'none'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.filesChanged.map((file) => (
              <Badge key={`${file.path}-${file.op}`} variant="outline">
                {file.op}: {file.path}
              </Badge>
            ))}
          </div>
          {result.errors.length ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {result.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}
          <PolicyVerdictPanel verdict={result.policyVerdict} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patch preview</CardTitle>
        </CardHeader>
        <CardContent>
          <DiffViewer patch={result.patch} />
        </CardContent>
      </Card>
    </div>
  );
}
