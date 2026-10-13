'use client';

import { useId, useState } from 'react';
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
import { FormField, FormFieldGroup } from '@/components/app-shell/FormSection';
import type { ToolContract } from '@/types/toolContracts';

const SAMPLE_PATCH =
  'diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1,1 +1,1 @@\n-hello\n+hello world\n';

export type SandboxForm = {
  repo: string;
  ref: string;
  path: string;
  patch: string;
  dryRun: boolean;
};
export interface ToolInputFormProps {
  contract?: ToolContract | null;
  isPending: boolean;
  onRun: (payload: unknown) => Promise<void>;
  initialSandbox?: Partial<SandboxForm>;
  initialPayload?: unknown;
  idPrefix?: string;
  submitLabel?: string;
}

export default function ToolInputForm({
  contract,
  isPending,
  onRun,
  initialSandbox,
  initialPayload = {},
  idPrefix,
  submitLabel,
}: ToolInputFormProps) {
  const generatedId = useId();
  const fieldId = idPrefix ?? generatedId;
  const [sandboxForm, setSandboxForm] = useState<SandboxForm>(() => ({
    repo: '/workspace/open-agency',
    ref: 'main',
    path: 'README.md',
    patch: SAMPLE_PATCH,
    dryRun: true,
    ...initialSandbox,
  }));
  const [jsonPayload, setJsonPayload] = useState(
    () => JSON.stringify(initialPayload, null, 2) ?? '{}'
  );
  const [error, setError] = useState<string | null>(null);
  if (!contract) return null;

  async function run(payload: () => unknown) {
    setError(null);
    try {
      await onRun(payload());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The tool request failed.');
    }
  }

  if (contract.name !== 'sandbox-edit')
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run contract</CardTitle>
          <CardDescription>
            Provide a JSON payload matching the contract input schema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FormField label="Input payload" htmlFor={fieldId + '-payload'} error={error}>
            <Textarea
              id={fieldId + '-payload'}
              className="min-h-55 font-mono text-xs"
              value={jsonPayload}
              onChange={(event) => setJsonPayload(event.target.value)}
              disabled={isPending}
            />
          </FormField>
          <Button
            type="button"
            onClick={() => run(() => JSON.parse(jsonPayload) as unknown)}
            disabled={isPending}
          >
            {isPending ? 'Running...' : (submitLabel ?? 'Run tool')}
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sandbox edit dry-run</CardTitle>
        <CardDescription>
          Validate a patch through the contract validator, policy engine, and git dry-run sandbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormFieldGroup columns={2}>
          <FormField label="Repository" htmlFor={fieldId + '-repo'}>
            <Input
              id={fieldId + '-repo'}
              value={sandboxForm.repo}
              disabled={isPending}
              onChange={(event) =>
                setSandboxForm((current) => ({ ...current, repo: event.target.value }))
              }
            />
          </FormField>
          <FormField label="Base ref" htmlFor={fieldId + '-ref'}>
            <Input
              id={fieldId + '-ref'}
              value={sandboxForm.ref}
              disabled={isPending}
              onChange={(event) =>
                setSandboxForm((current) => ({ ...current, ref: event.target.value }))
              }
            />
          </FormField>
        </FormFieldGroup>
        <FormField label="Path" htmlFor={fieldId + '-path'}>
          <Input
            id={fieldId + '-path'}
            value={sandboxForm.path}
            disabled={isPending}
            onChange={(event) =>
              setSandboxForm((current) => ({ ...current, path: event.target.value }))
            }
          />
        </FormField>
        <FormField label="Unified diff" htmlFor={fieldId + '-patch'}>
          <Textarea
            id={fieldId + '-patch'}
            className="min-h-60 font-mono text-xs"
            value={sandboxForm.patch}
            disabled={isPending}
            onChange={(event) =>
              setSandboxForm((current) => ({ ...current, patch: event.target.value }))
            }
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm" htmlFor={fieldId + '-dry-run'}>
          <Checkbox
            id={fieldId + '-dry-run'}
            checked={sandboxForm.dryRun}
            disabled={isPending}
            onCheckedChange={(checked) =>
              setSandboxForm((current) => ({ ...current, dryRun: checked === true }))
            }
          />
          Dry-run only
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(() => ({
              repo: sandboxForm.repo,
              ref: sandboxForm.ref,
              dryRun: sandboxForm.dryRun,
              changes: [{ path: sandboxForm.path, patch: sandboxForm.patch }],
            }))
          }
        >
          {isPending ? 'Running policy sandbox...' : (submitLabel ?? 'Run dry-run')}
        </Button>
      </CardContent>
    </Card>
  );
}
