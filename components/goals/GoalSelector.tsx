'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, X } from 'lucide-react';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import { goalsApi } from '@/lib/api/backend/goals';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { GoalAutonomyMode, GoalOperatorSummary } from '@/types/goals';

interface GoalSelectorProps {
  selectedGoalId?: string | null;
  onGoalChange: (goalId: string | null, goal?: GoalOperatorSummary | null) => void;
  compact?: boolean;
  createDefaultAutonomy?: GoalAutonomyMode;
}

const noGoalValue = '__no_goal__';

function goalLabel(summary: GoalOperatorSummary) {
  return summary.goal.objective || summary.goal.id;
}

export function goalMentionHandle(summary: GoalOperatorSummary) {
  return summary.goal.id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export default function GoalSelector({
  selectedGoalId,
  onGoalChange,
  compact = false,
  createDefaultAutonomy = 'guarded',
}: GoalSelectorProps) {
  const queryClient = useQueryClient();
  const [draftObjective, setDraftObjective] = useState('');

  const goalsQuery = useQuery({
    queryKey: queryKeys.backendGoalOperatorView({ active_only: true }),
    queryFn: () => goalsApi.getOperatorView({ active_only: true }),
    staleTime: 30_000,
  });

  const goals = useMemo(
    () =>
      (goalsQuery.data?.items ?? []).toSorted((left, right) =>
        goalLabel(left).localeCompare(goalLabel(right))
      ),
    [goalsQuery.data?.items]
  );
  const selectedGoal = goals.find((item) => item.goal.id === selectedGoalId) ?? null;

  const createGoalMutation = useMutation({
    mutationFn: () =>
      goalsApi.createGoal({
        objective: draftObjective.trim(),
        status: 'active',
        priority: 'normal',
        constraints: { autonomy: createDefaultAutonomy },
        success_criteria: [
          {
            type: 'operator_defined',
            description: 'Operator will refine success criteria during goal execution.',
          },
        ],
        metadata: { source: 'frontend_goal_selector' },
      }),
    onSuccess: async (goal) => {
      setDraftObjective('');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendGoalOperatorView({ active_only: true }),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendGoals({ active_only: true }),
      });
      onGoalChange(goal.id, {
        goal,
        status_label: goal.status,
        autonomy: String(goal.constraints?.autonomy ?? createDefaultAutonomy),
        blocked: false,
        stale: false,
        active_execution_count: 0,
      });
    },
  });

  const canCreate = draftObjective.trim().length > 3 && !createGoalMutation.isPending;

  return (
    <div
      className={
        compact
          ? 'flex flex-col gap-2'
          : 'flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3'
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Target className="size-4 shrink-0 text-muted-foreground" />
          <Select
            value={selectedGoalId ?? noGoalValue}
            onValueChange={(value) => {
              if (value === noGoalValue) {
                onGoalChange(null, null);
                return;
              }
              onGoalChange(value, goals.find((item) => item.goal.id === value) ?? null);
            }}
          >
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue
                placeholder={goalsQuery.isLoading ? 'Loading goals...' : 'No goal selected'}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={noGoalValue}>No goal</SelectItem>
              {goals.map((summary) => (
                <SelectItem key={summary.goal.id} value={summary.goal.id}>
                  {goalLabel(summary)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedGoal ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => onGoalChange(null, null)}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draftObjective}
          onChange={(event) => setDraftObjective(event.target.value)}
          placeholder="Create a new goal"
          disabled={createGoalMutation.isPending}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={!canCreate}
          onClick={() => createGoalMutation.mutate()}
        >
          {createGoalMutation.isPending ? 'Creating...' : 'Create'}
        </Button>
      </div>
      {goalsQuery.isError ? (
        <p className="text-xs text-red-600">Goals could not be loaded.</p>
      ) : null}
    </div>
  );
}
