'use client';

import type { TaskDefinition } from '@/types/workflows';
import { Button } from '../library/shadcn/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../library/shadcn/card';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import WorkflowEdgeMetadataEditor from '@/components/workflow-app/WorkflowEdgeMetadataEditor';

interface WorkflowEdgeFocusPanelProps {
  sourceTask: TaskDefinition;
  targetTask: TaskDefinition;
  edgeType: string;
  condition: string;
  metadataJson: string;
  conditionError?: string;
  metadataError?: string;
  isEditing: boolean;
  onClearSelection: () => void;
  onSelectSourceTask: () => void;
  onSelectTargetTask: () => void;
  onEdgeTypeChange: (edgeType: string) => void;
  onConditionChange: (condition: string) => void;
  onMetadataChange: (metadataJson: string) => void;
}

export default function WorkflowEdgeFocusPanel({
  sourceTask,
  targetTask,
  edgeType,
  condition,
  metadataJson,
  conditionError,
  metadataError,
  isEditing,
  onClearSelection,
  onSelectSourceTask,
  onSelectTargetTask,
  onEdgeTypeChange,
  onConditionChange,
  onMetadataChange,
}: WorkflowEdgeFocusPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Selected Edge</CardTitle>
          <CardDescription>
            Direct Graph edge editing for task dependencies.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
          Clear Edge Selection
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSelectSourceTask}>
            Source: {sourceTask.name}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSelectTargetTask}>
            Target: {targetTask.name}
          </Button>
        </div>

        {isEditing ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="selected-edge-type">Edge Type</Label>
              <select
                id="selected-edge-type"
                value={edgeType}
                onChange={(event) => onEdgeTypeChange(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="default">default</option>
                <option value="conditional">conditional</option>
                <option value="success">success</option>
                <option value="failure">failure</option>
              </select>
              <p className="text-xs text-neutral-500">
                `conditional` requires a condition. `success` and `failure` are currently descriptive labels only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="selected-edge-condition">Condition</Label>
              <Input
                id="selected-edge-condition"
                value={condition}
                onChange={(event) => onConditionChange(event.target.value)}
                placeholder="Edge condition"
                className={conditionError ? 'border-red-500' : ''}
              />
              {conditionError ? <p className="text-xs text-red-600">Condition {conditionError}</p> : null}
            </div>
            <div className="space-y-2 md:col-span-3">
              <WorkflowEdgeMetadataEditor
                idPrefix="selected-edge"
                metadataJson={metadataJson}
                metadataError={metadataError}
                onChange={onMetadataChange}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-neutral-700">
            <p>Type: {edgeType}</p>
            <p>Condition: {condition || 'None'}</p>
            <p>Metadata: {metadataJson || 'None'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
