'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BotMessageSquare, Clock3, CornerDownLeft, Search, Workflow } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/library/shadcn/command';
import { workflowsApi } from '@/lib/api/backend/workflows';
import { requestAssistantOpen } from '@/lib/assistant/events';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { rememberWorkspaceItem, useWorkspaceHistory } from '@/lib/workspaceHistory';
import { cn } from '@/lib/utils';

export interface CommandPaletteRoute {
  name: string;
  path: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function CommandPalette({ routes }: { routes: CommandPaletteRoute[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const recentItems = useWorkspaceHistory();
  const workflowsQuery = useQuery({
    queryKey: queryKeys.backendWorkflowList(),
    queryFn: () => workflowsApi.listWorkflows(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigate = (path: string, label: string, description?: string) => {
    rememberWorkspaceItem({ path, label, description });
    setOpen(false);
    router.push(path);
  };

  const workflows = workflowsQuery.data?.items ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search Open Agency"
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border border-(--agency-control-border) bg-(--agency-control-bg) px-2.5 text-sm text-(--agency-shell-muted) shadow-(--agency-outline-shadow) outline-none transition-colors',
          'hover:bg-(--agency-control-bg-hover) hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring sm:min-w-48 sm:justify-between xl:min-w-58'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Search className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Search Open Agency</span>
        </span>
        <kbd className="hidden rounded border border-(--agency-shell-border) bg-background px-1.5 py-0.5 font-sans text-[0.65rem] sm:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, workflows, and actions…" />
        <CommandList>
          <CommandEmpty>
            {workflowsQuery.isLoading ? 'Loading workspace…' : 'No matching page or workflow.'}
          </CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem
              value="ask assistant main agent help"
              onSelect={() => {
                setOpen(false);
                requestAssistantOpen();
              }}
            >
              <BotMessageSquare aria-hidden="true" />
              <span>Ask the Main Agent</span>
              <CommandShortcut>Assistant</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {recentItems.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Recent">
                {recentItems.map((item) => (
                  <CommandItem
                    key={item.path}
                    value={`recent ${item.label} ${item.description ?? ''} ${item.path}`}
                    onSelect={() => navigate(item.path, item.label, item.description)}
                  >
                    <Clock3 aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <CornerDownLeft className="text-muted-foreground" aria-hidden="true" />
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          <CommandSeparator />
          <CommandGroup heading="Pages">
            {routes.map((route) => {
              const Icon = route.icon;
              return (
                <CommandItem
                  key={route.path}
                  value={`${route.name} ${route.description} ${route.path}`}
                  onSelect={() => navigate(route.path, route.name, route.description)}
                >
                  <Icon aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{route.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {route.description}
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>

          {workflows.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Workflows">
                {workflows.map((workflow) => {
                  const path = `/workflows/${workflow.id}`;
                  return (
                    <CommandItem
                      key={workflow.id}
                      value={`${workflow.name} ${workflow.description ?? ''} ${workflow.id}`}
                      onSelect={() =>
                        navigate(path, workflow.name, workflow.description ?? 'Workflow')
                      }
                    >
                      <Workflow aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{workflow.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {workflow.description || workflow.id}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
