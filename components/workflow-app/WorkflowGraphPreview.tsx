'use client';

import { backendWorkflowToGraph } from '@/lib/workflows/graphMapping';
import type { Workflow } from '@/types/workflows';
import { Badge } from '../library/shadcn/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';

export default function WorkflowGraphPreview({ workflow }: { workflow: Workflow }) {
  const graph = backendWorkflowToGraph(workflow);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Graph</CardTitle>
        <CardDescription>
          Backend schema mapped into frontend graph nodes and edges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-900">Nodes</p>
            {graph.nodes.length === 0 ? (
              <p className="text-sm text-neutral-500">No graph nodes available.</p>
            ) : (
              graph.nodes.map((node) => (
                <div key={node.id} className="rounded-lg border border-neutral-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-neutral-900">{node.data.label}</p>
                    <Badge variant="outline">{node.type}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-neutral-500">{node.data.subtitle || node.id}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-900">Edges</p>
            {graph.edges.length === 0 ? (
              <p className="text-sm text-neutral-500">No graph edges available.</p>
            ) : (
              graph.edges.map((edge) => (
                <div key={edge.id} className="rounded-lg border border-neutral-200 p-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-900">
                    <span className="font-medium">{edge.source}</span>
                    <span className="text-neutral-400">→</span>
                    <span className="font-medium">{edge.target}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{edge.type}</Badge>
                    {edge.label ? <Badge variant="secondary">{edge.label}</Badge> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
