'use client';

import { Badge } from '@/components/library/shadcn/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/library/shadcn/card';
import type { JsonSchema, ToolContract } from '@/types/toolContracts';

function schemaType(schema: JsonSchema) {
  return Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type || 'unknown';
}

export default function ToolContractViewer({ contract }: { contract?: ToolContract | null }) {
  if (!contract) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-neutral-500">Select a contract to inspect its schemas.</CardContent>
      </Card>
    );
  }

  const inputProperties = contract.inputs.properties ?? {};
  const outputProperties = contract.outputs.properties ?? {};
  const requiredInputs = new Set(contract.inputs.required ?? []);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input schema</CardTitle>
          <CardDescription>Fields agents must provide before policy and sandbox execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(inputProperties).map(([name, schema]) => (
            <div key={name} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-semibold text-neutral-900">{name}</p>
                <Badge variant="outline">{schemaType(schema)}</Badge>
                {requiredInputs.has(name) ? <Badge>required</Badge> : null}
              </div>
              {schema.description ? <p className="mt-2 text-sm text-neutral-600">{schema.description}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Output schema</CardTitle>
          <CardDescription>Structured response available to agents, UI, logs, and future execution stores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(outputProperties).map(([name, schema]) => (
            <div key={name} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3">
              <span className="font-mono text-sm text-neutral-800">{name}</span>
              <Badge variant="outline">{schemaType(schema)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Raw contract</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[360px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {JSON.stringify(contract, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
