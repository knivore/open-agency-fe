'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AtSign,
  Check,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  Square,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import { Input } from '@/components/library/shadcn/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/library/shadcn/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/library/shadcn/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/library/shadcn/tooltip';
import { goalsApi } from '@/lib/api/backend/goals';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { GoalDefinition, GoalOperatorSummary } from '@/types/goals';
import type { PersonaDefinition } from '@/types/personas';

const GOAL_PICKER_LIMIT = 20;

interface AssistantContextMenuProps {
  selectedGoalId?: string | null;
  selectedGoalSummary?: GoalOperatorSummary | null;
  personas: PersonaDefinition[];
  personasLoading?: boolean;
  personasError?: boolean;
  disabled?: boolean;
  onGoalSelect: (goal: GoalOperatorSummary | null) => void;
  onPersonaSelect: (persona: PersonaDefinition) => void;
}

function goalLabel(summary: GoalOperatorSummary) {
  return summary.goal.objective || summary.goal.id;
}

function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

export default function AssistantContextMenu({
  selectedGoalId,
  selectedGoalSummary,
  personas,
  personasLoading = false,
  personasError = false,
  disabled = false,
  onGoalSelect,
  onPersonaSelect,
}: AssistantContextMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [draftObjective, setDraftObjective] = useState('');
  const [goalSearch, setGoalSearch] = useState('');

  const goalsQuery = useQuery({
    queryKey: queryKeys.backendGoalOperatorView({ active_only: true }),
    queryFn: () => goalsApi.getOperatorView({ active_only: true }),
    staleTime: 30_000,
  });

  const goals = useMemo(() => goalsQuery.data?.items ?? [], [goalsQuery.data?.items]);
  const filteredGoals = useMemo(() => {
    const query = goalSearch.trim().toLowerCase();
    if (!query) {
      return goals;
    }
    return goals.filter((summary) => {
      const searchable = [
        goalLabel(summary),
        summary.goal.id,
        summary.goal.status,
        summary.status_label,
        String(summary.autonomy ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [goalSearch, goals]);
  const visibleGoals = filteredGoals.slice(0, GOAL_PICKER_LIMIT);
  const hiddenGoalCount = Math.max(filteredGoals.length - visibleGoals.length, 0);
  const shouldShowGoalSearch = goals.length > GOAL_PICKER_LIMIT || goalSearch.trim().length > 0;

  const goalActionMutation = useMutation({
    mutationFn: async ({
      action,
      goal,
      objective,
    }: {
      action: 'edit' | 'pause' | 'resume' | 'stop';
      goal: GoalOperatorSummary;
      objective?: string;
    }) => {
      if (action === 'edit') {
        return goalsApi.updateGoal(goal.goal.id, {
          objective: objective?.trim() || goal.goal.objective,
        });
      }
      if (action === 'pause') {
        return goalsApi.pauseGoal(goal.goal.id);
      }
      if (action === 'resume') {
        return goalsApi.resumeGoal(goal.goal.id);
      }
      return goalsApi.cancelGoal(goal.goal.id, 'Stopped from assistant goal picker.');
    },
    onSuccess: async (goal) => {
      setEditingGoalId(null);
      setDraftObjective('');
      await invalidateGoalQueries();
      if (goal.id === selectedGoalId) {
        if (
          goal.status === 'cancelled' ||
          goal.status === 'completed' ||
          goal.status === 'failed' ||
          goal.status === 'abandoned'
        ) {
          onGoalSelect(null);
          return;
        }
        onGoalSelect(summaryFromGoal(goal));
      }
    },
  });

  const activeActionGoalId = goalActionMutation.variables?.goal.goal.id ?? null;
  const activeAction = goalActionMutation.variables?.action ?? null;
  const canSaveEdit = draftObjective.trim().length > 3 && !goalActionMutation.isPending;

  function selectGoal(goal: GoalOperatorSummary | null) {
    onGoalSelect(goal);
    setOpen(false);
  }

  function selectPersona(persona: PersonaDefinition) {
    onPersonaSelect(persona);
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEditingGoalId(null);
      setDraftObjective('');
      setGoalSearch('');
    }
  }

  async function invalidateGoalQueries() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.backendGoalOperatorView({ active_only: true }),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.backendGoals({ active_only: true }),
    });
  }

  function summaryFromGoal(goal: GoalDefinition): GoalOperatorSummary {
    return {
      goal,
      status_label: goal.status,
      autonomy: String(goal.constraints?.autonomy ?? 'guarded'),
      blocked: false,
      stale: false,
      active_execution_count: 0,
    };
  }

  function startEditingGoal(goal: GoalOperatorSummary) {
    setEditingGoalId(goal.goal.id);
    setDraftObjective(goal.goal.objective);
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 shrink-0 rounded-xl p-0"
                disabled={disabled}
                aria-label="Mention goal or persona"
                title="Mention goal or persona"
              >
                <AtSign className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Mention goal or persona</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-3">
          <Tabs defaultValue="goals">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger type="button" value="goals" className="gap-2">
                <Target className="h-3.5 w-3.5" />
                Goals
              </TabsTrigger>
              <TabsTrigger type="button" value="personas" className="gap-2">
                <UserRound className="h-3.5 w-3.5" />
                Personas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="goals" className="space-y-3">
              {selectedGoalSummary ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <Target className="h-4 w-4 shrink-0 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-emerald-900">
                      {goalLabel(selectedGoalSummary)}
                    </p>
                    <p className="text-xs text-emerald-700">{selectedGoalSummary.autonomy}</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-emerald-700 hover:bg-emerald-100"
                        onClick={() => selectGoal(null)}
                        aria-label="Clear selected goal"
                        title="Clear selected goal"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear selected goal</TooltipContent>
                  </Tooltip>
                </div>
              ) : null}

              {shouldShowGoalSearch ? (
                <Input
                  value={goalSearch}
                  onChange={(event) => setGoalSearch(event.target.value)}
                  placeholder="Filter active goals"
                />
              ) : null}

              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {goalsQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading goals...
                  </div>
                ) : goalsQuery.isError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Goals could not be loaded.
                  </div>
                ) : goals.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No active goals.
                  </div>
                ) : visibleGoals.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No matching active goals.
                  </div>
                ) : (
                  visibleGoals.map((summary) => {
                    const selected = summary.goal.id === selectedGoalId;
                    const isEditing = editingGoalId === summary.goal.id;
                    const isPaused = summary.goal.status === 'paused';
                    const actionPending =
                      activeActionGoalId === summary.goal.id && goalActionMutation.isPending;
                    return (
                      <div
                        key={summary.goal.id}
                        className="rounded-lg border border-transparent px-3 py-2 transition hover:border-primary-100 hover:bg-primary-50"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={draftObjective}
                              onChange={(event) => setDraftObjective(event.target.value)}
                              disabled={goalActionMutation.isPending}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && canSaveEdit) {
                                  event.preventDefault();
                                  goalActionMutation.mutate({
                                    action: 'edit',
                                    goal: summary,
                                    objective: draftObjective,
                                  });
                                }
                                if (event.key === 'Escape' && !goalActionMutation.isPending) {
                                  setEditingGoalId(null);
                                  setDraftObjective('');
                                }
                              }}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={goalActionMutation.isPending}
                                onClick={() => {
                                  setEditingGoalId(null);
                                  setDraftObjective('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canSaveEdit}
                                onClick={() =>
                                  goalActionMutation.mutate({
                                    action: 'edit',
                                    goal: summary,
                                    objective: draftObjective,
                                  })
                                }
                              >
                                {actionPending && activeAction === 'edit' ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="flex w-full items-start gap-2 text-left"
                              onClick={() => selectGoal(summary)}
                            >
                              <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900">
                                  {goalLabel(summary)}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                  <Badge variant="outline" className="px-1.5 py-0">
                                    {summary.goal.status}
                                  </Badge>
                                  <span>{shortId(summary.goal.id)}</span>
                                </span>
                              </span>
                              {selected ? (
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              ) : null}
                            </button>
                            <div className="mt-2 flex flex-wrap justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    disabled={goalActionMutation.isPending}
                                    onClick={() => startEditingGoal(summary)}
                                    aria-label={`Edit goal ${goalLabel(summary)}`}
                                    title="Edit goal"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit goal</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    disabled={goalActionMutation.isPending}
                                    onClick={() =>
                                      goalActionMutation.mutate({
                                        action: isPaused ? 'resume' : 'pause',
                                        goal: summary,
                                      })
                                    }
                                    aria-label={`${isPaused ? 'Resume' : 'Pause'} goal ${goalLabel(summary)}`}
                                    title={isPaused ? 'Resume goal' : 'Pause goal'}
                                  >
                                    {actionPending &&
                                    (activeAction === 'pause' || activeAction === 'resume') ? (
                                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    ) : isPaused ? (
                                      <Play className="h-3.5 w-3.5" />
                                    ) : (
                                      <Pause className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isPaused ? 'Resume goal' : 'Pause goal'}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    disabled={goalActionMutation.isPending}
                                    onClick={() =>
                                      goalActionMutation.mutate({
                                        action: 'stop',
                                        goal: summary,
                                      })
                                    }
                                    aria-label={`Stop goal ${goalLabel(summary)}`}
                                    title="Stop goal"
                                  >
                                    {actionPending && activeAction === 'stop' ? (
                                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Square className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Stop goal</TooltipContent>
                              </Tooltip>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {hiddenGoalCount > 0 ? (
                <p className="text-xs text-slate-500">
                  Showing {GOAL_PICKER_LIMIT} of {filteredGoals.length}. Type to narrow the list.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="personas" className="space-y-2">
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {personasLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading personas...
                  </div>
                ) : personasError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Personas could not be loaded.
                  </div>
                ) : personas.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No published personas.
                  </div>
                ) : (
                  personas.map((persona) => (
                    <button
                      key={persona.id}
                      type="button"
                      className="flex w-full items-start gap-2 rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-primary-100 hover:bg-primary-50"
                      onClick={() => selectPersona(persona)}
                    >
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {persona.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          @{persona.slug}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
