'use client';

import { Badge } from '@/components/library/shadcn/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import type { JsonSchema, ToolContract } from '@/types/toolContracts';

function schemaType(schema: JsonSchema) {
  return Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type || 'unknown';
}

function riskLabelsFor(contract: ToolContract) {
  return contract.riskLabels ?? contract.risk_labels ?? [];
}

export default function ToolContractViewer({ contract }: { contract?: ToolContract | null }) {
  if (!contract) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-(--agency-shell-muted)">
          Select a contract to inspect its schemas.
        </CardContent>
      </Card>
    );
  }

  const inputProperties = contract.inputs.properties ?? {};
  const outputProperties = contract.outputs.properties ?? {};
  const requiredInputs = new Set(contract.inputs.required ?? []);
  const riskLabels = riskLabelsFor(contract);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {riskLabels.length ? (
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Risk labels</CardTitle>
            <CardDescription>
              Declared capabilities and local execution risk for this tool.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {riskLabels.map((label) => (
                <Badge key={label} variant="outline" className="font-mono text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input schema</CardTitle>
          <CardDescription>
            Fields agents must provide before policy and sandbox execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Object.entries(inputProperties).map(([name, schema]) => (
            <div
              key={name}
              className="rounded-xl border border-(--agency-shell-border) bg-muted/30 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-semibold text-(--agency-shell-text)">{name}</p>
                <Badge variant="outline">{schemaType(schema)}</Badge>
                {requiredInputs.has(name) ? <Badge>required</Badge> : null}
              </div>
              {schema.description ? (
                <p className="mt-2 text-sm text-(--agency-shell-muted)">{schema.description}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Output schema</CardTitle>
          <CardDescription>
            Structured response available to agents, UI, logs, and future execution stores.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Object.entries(outputProperties).map(([name, schema]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-xl border border-(--agency-shell-border) bg-background p-3"
            >
              <span className="font-mono text-sm text-(--agency-shell-text)">{name}</span>
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
          <pre className="max-h-90 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {JSON.stringify(contract, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
