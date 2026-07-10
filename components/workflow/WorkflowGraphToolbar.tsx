'use client';

import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Database,
  GitBranch,
  Hammer,
  LayoutGrid,
  LocateFixed,
  Maximize2,
  Pencil,
  Plus,
  Play,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import {
  graphBuiltInToolbarActionIds,
  type GraphToolbarRendererProps,
} from '@/modules/react-flow-graph/GraphCanvas';
import type { GraphToolbarAction } from '@/modules/react-flow-graph/types';
import { workflowGraphActionIds } from '@/lib/workflows/workflowGraphAdapter';
import { AGENTIC_TASK_TEMPLATES } from '@/lib/workflows/capabilityTaskTemplates';
import { Button } from '@/components/library/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/library/shadcn/dropdown-menu';

const taskTemplateToolbarActions: GraphToolbarAction[] = AGENTIC_TASK_TEMPLATES.map((template) => ({
  id: `${workflowGraphActionIds.addTaskTemplate}.${template.id}`,
  label: template.label,
  description: template.addTaskDescription,
  metadata: {
    templateId: template.id,
  },
}));

function isTaskTemplateAction(action: GraphToolbarAction) {
  return action.id.startsWith(`${workflowGraphActionIds.addTaskTemplate}.`);
}

function iconForAction(actionId: string) {
  if (actionId === workflowGraphActionIds.edit) {
    return <Pencil className="h-4 w-4" />;
  }

  if (actionId === workflowGraphActionIds.addTask) {
    return <Plus className="h-4 w-4" />;
  }

  if (actionId === workflowGraphActionIds.addAgent) {
    return <Bot className="h-4 w-4" />;
  }

  if (actionId === workflowGraphActionIds.addTool) {
    return <Hammer className="h-4 w-4" />;
  }

  if (actionId === workflowGraphActionIds.addMemory) {
    return <Database className="h-4 w-4" />;
  }

  if (actionId === workflowGraphActionIds.validate) {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (actionId === workflowGraphActionIds.save) {
    return <Save className="h-4 w-4" />;
  }

  if (actionId === workflowGraphActionIds.run) {
    return <Play className="h-4 w-4" />;
  }

  if (actionId === graphBuiltInToolbarActionIds.autoLayout) {
    return <LayoutGrid className="h-4 w-4" />;
  }

  if (actionId === graphBuiltInToolbarActionIds.fitView) {
    return <Maximize2 className="h-4 w-4" />;
  }

  if (actionId === graphBuiltInToolbarActionIds.focusSelection) {
    return <LocateFixed className="h-4 w-4" />;
  }

  if (actionId === graphBuiltInToolbarActionIds.undo) {
    return <Undo2 className="h-4 w-4" />;
  }

  if (actionId === graphBuiltInToolbarActionIds.redo) {
    return <Redo2 className="h-4 w-4" />;
  }

  return <GitBranch className="h-4 w-4" />;
}

export default function WorkflowGraphToolbar({ actions, onAction }: GraphToolbarRendererProps) {
  if (actions.length === 0) {
    return null;
  }

  const visibleActions = actions.filter((action) => !isTaskTemplateAction(action));

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,23,38,0.96),rgba(8,18,31,0.94))] dark:shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
      {visibleActions.map((action) => (
        <span key={action.id} className="group relative inline-flex">
          {action.id === workflowGraphActionIds.addTask ? (
            <div className="inline-flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={action.disabled}
                className="gap-2 rounded-r-none"
                title={action.description ?? action.label}
                aria-label={
                  action.description ? `${action.label}: ${action.description}` : action.label
                }
                onClick={() => onAction(action)}
              >
                {iconForAction(action.id)}
                <span>{action.label}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={action.disabled}
                    className="-ml-px rounded-l-none px-2"
                    aria-label="Choose task template"
                    title="Choose task template"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel>Task template</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {taskTemplateToolbarActions.map((templateAction) => (
                    <DropdownMenuItem
                      key={templateAction.id}
                      className="items-start"
                      onSelect={() => onAction(templateAction)}
                    >
                      <GitBranch className="mt-0.5 h-4 w-4" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">{templateAction.label}</span>
                        {templateAction.description ? (
                          <span className="text-xs leading-4 text-muted-foreground">
                            {templateAction.description}
                          </span>
                        ) : null}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button
              type="button"
              variant={action.id === workflowGraphActionIds.edit ? 'default' : 'outline'}
              size="sm"
              disabled={action.disabled}
              className="gap-2"
              title={action.description ?? action.label}
              aria-label={
                action.description ? `${action.label}: ${action.description}` : action.label
              }
              onClick={() => onAction(action)}
            >
              {iconForAction(action.id)}
              <span>{action.label}</span>
            </Button>
          )}
          {action.description ? (
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 opacity-0 shadow-lg transition-opacity duration-75 group-focus-within:opacity-100 group-hover:opacity-100 dark:border-white/10 dark:bg-slate-950/94 dark:text-slate-200"
            >
              {action.description}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
