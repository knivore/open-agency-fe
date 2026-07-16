import { useState } from 'react';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { Checkbox } from '@/components/library/shadcn/checkbox';
import { Input } from '@/components/library/shadcn/input';
import { Textarea } from '@/components/library/shadcn/textarea';
import type { ToolContract } from '@/types/toolContracts';

const SAMPLE_PATCH = `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,1 +1,1 @@
-hello
+hello world
`;

type SandboxForm = {
  repo: string;
  ref: string;
  path: string;
  patch: string;
  dryRun: boolean;
};

function sandboxPayload(form: SandboxForm) {
  return {
    repo: form.repo,
    ref: form.ref,
    dryRun: form.dryRun,
    changes: [
      {
        path: form.path,
        patch: form.patch,
      },
    ],
  };
}

export default function ToolInputForm({
  contract,
  isPending,
  onRun,
}: {
  contract?: ToolContract | null;
  isPending: boolean;
  onRun: (payload: unknown) => Promise<void>;
}) {
  const [sandboxForm, setSandboxForm] = useState<SandboxForm>({
    repo: '/workspace/open-agency',
    ref: 'main',
    path: 'README.md',
    patch: SAMPLE_PATCH,
    dryRun: true,
  });
  const [jsonPayload, setJsonPayload] = useState('{}');
  const [error, setError] = useState<string | null>(null);

  if (!contract) {
    return null;
  }

  const runSandbox = async () => {
    setError(null);
    await onRun(sandboxPayload(sandboxForm));
  };

  const runJson = async () => {
    setError(null);
    try {
      await onRun(JSON.parse(jsonPayload) as unknown);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Payload must be valid JSON.');
    }
  };

  if (contract.name !== 'sandbox-edit') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run contract</CardTitle>
          <CardDescription>
            Provide a JSON payload matching the contract input schema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="min-h-55 font-mono text-xs"
            value={jsonPayload}
            onChange={(event) => setJsonPayload(event.target.value)}
            disabled={isPending}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="button" onClick={runJson} disabled={isPending}>
            {isPending ? 'Running...' : 'Run tool'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sandbox edit dry-run</CardTitle>
        <CardDescription>
          Validate a patch through the contract validator, policy engine, and git dry-run sandbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="sandbox-repo"
              className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
            >
              Repository
            </label>
            <Input
              id="sandbox-repo"
              value={sandboxForm.repo}
              onChange={(event) =>
                setSandboxForm((current) => ({ ...current, repo: event.target.value }))
              }
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="sandbox-ref"
              className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
            >
              Base ref
            </label>
            <Input
              id="sandbox-ref"
              value={sandboxForm.ref}
              onChange={(event) =>
                setSandboxForm((current) => ({ ...current, ref: event.target.value }))
              }
              disabled={isPending}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="sandbox-path"
            className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
          >
            Path
          </label>
          <Input
            id="sandbox-path"
            value={sandboxForm.path}
            onChange={(event) =>
              setSandboxForm((current) => ({ ...current, path: event.target.value }))
            }
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="sandbox-patch"
            className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500"
          >
            Unified diff
          </label>
          <Textarea
            id="sandbox-patch"
            className="min-h-60 font-mono text-xs"
            value={sandboxForm.patch}
            onChange={(event) =>
              setSandboxForm((current) => ({ ...current, patch: event.target.value }))
            }
            disabled={isPending}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <Checkbox
            checked={sandboxForm.dryRun}
            onCheckedChange={(checked) =>
              setSandboxForm((current) => ({ ...current, dryRun: checked === true }))
            }
            disabled={isPending}
          />
          Dry-run only
        </label>
        <Button
          type="button"
          className="bg-slate-950 text-white hover:bg-slate-800"
          onClick={runSandbox}
          disabled={isPending}
        >
          {isPending ? 'Running policy sandbox...' : 'Run dry-run'}
        </Button>
      </CardContent>
    </Card>
  );
}
