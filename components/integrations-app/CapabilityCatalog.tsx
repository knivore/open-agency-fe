'use client';
import { FormField } from '@/components/app-shell/FormSection';

import { NativeSelect } from '@/components/library/shadcn/select';
import { type ReactNode, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Boxes,
  Database,
  FileText,
  Globe,
  Layers,
  Search,
  SlidersHorizontal,
  Target,
  Workflow,
} from 'lucide-react';
import type { IntegrationProvider } from '@/types/integrations';
import type { ToolDefinition } from '@/types/tools';
import { cn } from '@/lib/utils';
import {
  capabilityFamilies,
  matchesToolSearch,
  toolAccess,
  type ToolAccess,
  toolAccessLabels,
  toolCapabilityFamily,
  toolOperationChoices,
} from '@/lib/tools/capabilityCatalog';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Checkbox } from '../library/shadcn/checkbox';
import { Input } from '../library/shadcn/input';
import { AppDialog } from '../app-shell/AppOverlay';

const PAGE_SIZE = 12;
const infrastructureFamily = {
  id: 'infrastructure',
  label: 'MCP servers & runtime',
  description: 'Connected tool servers and runtime adapters.',
};
const families = [...capabilityFamilies, infrastructureFamily];
const familyNavigationLabels: Record<string, string> = {
  workflow: 'Workflows',
  goal: 'Goals',
  execution: 'Runs & observability',
  agent: 'Agents',
  tool: 'Tools',
  browser: 'Browser & apps',
  memory: 'Memory',
  connector: 'Connections',
  documents: 'Files & documents',
  infrastructure: 'MCP & runtime',
};
const familyIcons: Record<string, typeof Layers> = {
  workflow: Workflow,
  goal: Target,
  execution: Activity,
  agent: Bot,
  browser: Globe,
  memory: Database,
  documents: FileText,
  infrastructure: Boxes,
};

export function capabilityProviderTool(provider: IntegrationProvider): ToolDefinition {
  return (provider.raw ?? {
    id: provider.id,
    name: provider.name,
    description: provider.description ?? '',
  }) as unknown as ToolDefinition;
}

function providerFamily(provider: IntegrationProvider) {
  return provider.kind === 'tool'
    ? toolCapabilityFamily(capabilityProviderTool(provider))
    : infrastructureFamily;
}

function initialParam(key: string) {
  return typeof window === 'undefined'
    ? ''
    : (new URLSearchParams(window.location.search).get(key) ?? '');
}

function persistParam(key: string, value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

export interface CapabilityAssignmentControls {
  selectedIds: ReadonlySet<string>;
  canEdit: boolean;
  canAssign: (provider: IntegrationProvider) => boolean;
  onToggle: (id: string, checked: boolean) => void;
  panel: ReactNode;
}

export interface CapabilityCatalogProps {
  providers: IntegrationProvider[];
  actions: ReactNode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  renderDetails: (provider: IntegrationProvider) => ReactNode;
  assignment?: CapabilityAssignmentControls;
}

export default function CapabilityCatalog({
  providers,
  actions,
  selectedId,
  onSelect,
  renderDetails,
  assignment,
}: CapabilityCatalogProps) {
  const [query, setQuery] = useState(() => initialParam('integration-search-custom'));
  const [family, setFamily] = useState(() => {
    const value = initialParam('capability-family');
    return families.some((entry) => entry.id === value) ? value : 'all';
  });
  const [access, setAccess] = useState<ToolAccess | 'all'>(() => {
    const value = initialParam('capability-access');
    return Object.hasOwn(toolAccessLabels, value) ? (value as ToolAccess) : 'all';
  });
  const [kind, setKind] = useState(() => {
    const value = initialParam('integration-filter-custom');
    return ['tool', 'mcp_server', 'runtime_adapter'].includes(value) ? value : 'all';
  });
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(() => access !== 'all' || kind !== 'all');
  const operationsRef = useRef<HTMLDivElement>(null);
  const inspectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deferredQuery = useDeferredValue(query);
  // Families are navigation, never grants. Only explicit operation IDs are editable.
  const unique = useMemo(
    () => [
      ...new Map(
        providers.map((provider) => [provider.kind + ':' + provider.id, provider])
      ).values(),
    ],
    [providers]
  );
  const availableFamilies = useMemo(
    () =>
      families
        .map((entry) => ({
          ...entry,
          count: unique.filter((provider) => providerFamily(provider).id === entry.id).length,
        }))
        .filter((entry) => entry.count),
    [unique]
  );
  const matching = useMemo(
    () =>
      unique
        .filter((provider) => {
          if (family !== 'all' && providerFamily(provider).id !== family) return false;
          if (kind !== 'all' && provider.kind !== kind) return false;
          if (
            access !== 'all' &&
            (provider.kind !== 'tool' || toolAccess(capabilityProviderTool(provider)) !== access)
          )
            return false;
          return provider.kind === 'tool'
            ? matchesToolSearch(capabilityProviderTool(provider), deferredQuery)
            : deferredQuery
                .trim()
                .toLowerCase()
                .split(/\s+/)
                .every((term) =>
                  [provider.name, provider.id, provider.description]
                    .join(' ')
                    .toLowerCase()
                    .includes(term)
                );
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [unique, family, kind, access, deferredQuery]
  );
  const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedProvider = unique.find((provider) => provider.id === selectedId);
  const toolCount = unique.filter((provider) => provider.kind === 'tool').length;

  function change(key: string, value: string, setter: (value: string) => void) {
    setter(value);
    persistParam(key, value === 'all' ? '' : value);
    setPage(1);
  }

  function reset() {
    setQuery('');
    setFamily('all');
    setAccess('all');
    setKind('all');
    setPage(1);
    [
      'integration-search-custom',
      'capability-family',
      'capability-access',
      'integration-filter-custom',
    ].forEach((key) => persistParam(key, ''));
  }

  function goToPage(next: number) {
    setPage(next);
    operationsRef.current?.scrollIntoView?.({ block: 'nearest' });
  }

  return (
    <section aria-label="Capability Studio" className="flex flex-col gap-4">
      <div className="sr-only">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{toolCount} tool operations</span>
          <span aria-hidden="true">·</span>
          <span>{availableFamilies.length} families</span>
          {unique.length > toolCount ? (
            <span>· {unique.length - toolCount} servers & adapters</span>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      <div
        className={cn(
          'grid min-w-0 gap-4 md:grid-cols-[13rem_minmax(0,1fr)]',
          assignment && 'xl:grid-cols-[13rem_minmax(0,1fr)_20rem]'
        )}
      >
        <nav
          aria-label="Capability families"
          className="hidden min-w-0 self-start rounded-xl border bg-card p-3 md:block"
        >
          <h2 className="px-2 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Capability families
          </h2>
          <div className="flex max-h-[calc(100vh-19rem)] flex-col gap-1 overflow-y-auto">
            <button
              type="button"
              aria-current={family === 'all' ? 'true' : undefined}
              onClick={reset}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                family === 'all' && 'bg-accent font-semibold text-primary'
              )}
            >
              <Layers className="size-4 shrink-0" aria-hidden="true" /> All operations
            </button>
            {availableFamilies.map((entry) => {
              const Icon = familyIcons[entry.id] ?? Layers;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={'Browse ' + entry.label}
                  aria-current={family === entry.id ? 'true' : undefined}
                  onClick={() => change('capability-family', entry.id, setFamily)}
                  className={cn(
                    'flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    family === entry.id && 'bg-accent font-semibold text-primary'
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1" title={entry.description}>
                    {familyNavigationLabels[entry.id] ?? entry.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{entry.count}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <div
          id="capability-operations"
          ref={operationsRef}
          className="flex min-w-0 flex-col self-start overflow-hidden rounded-xl border bg-card"
        >
          <div className="flex flex-col gap-3 border-b p-4">
            <h2 className="sr-only">Find a capability</h2>
            <label className="sr-only" htmlFor="capability-search">
              Search capabilities
            </label>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="capability-search"
                  value={query}
                  onChange={(event) =>
                    change('integration-search-custom', event.target.value, setQuery)
                  }
                  placeholder="Search operations, actions, or parameters…"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                aria-expanded={filtersOpen}
                aria-controls="capability-filters"
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Filters</span>
                {access !== 'all' || kind !== 'all' ? (
                  <span className="size-2 rounded-full bg-primary" aria-label="Active filters" />
                ) : null}
              </Button>
            </div>
            <FormField label="Capability family" htmlFor="capability-family" className="md:hidden">
              <NativeSelect
                id="capability-family"
                className="h-9 min-w-0 max-w-full rounded-md border bg-background px-2 text-sm md:hidden"
                value={family}
                onChange={(event) => change('capability-family', event.target.value, setFamily)}
              >
                <option value="all">All families</option>
                {availableFamilies.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {filtersOpen ? (
              <div id="capability-filters" className="flex flex-wrap items-center gap-2">
                <label htmlFor="capability-access" className="sr-only">
                  Access level
                </label>
                <NativeSelect
                  id="capability-access"
                  className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm"
                  value={access}
                  onChange={(event) =>
                    change('capability-access', event.target.value, (value) =>
                      setAccess(value as typeof access)
                    )
                  }
                >
                  <option value="all">All access levels</option>
                  {Object.entries(toolAccessLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label="Capability source"
                  className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm"
                  value={kind}
                  onChange={(event) =>
                    change('integration-filter-custom', event.target.value, setKind)
                  }
                >
                  <option value="all">All sources</option>
                  <option value="tool">Tool operations</option>
                  <option value="mcp_server">MCP servers</option>
                  <option value="runtime_adapter">Runtime adapters</option>
                </NativeSelect>
                {family !== 'all' || query || access !== 'all' || kind !== 'all' ? (
                  <Button size="sm" variant="ghost" onClick={reset}>
                    Family overview
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <fieldset className="min-w-0">
            <legend className="sr-only">
              Operations available for explicit specialist assignment
            </legend>
            <div className="max-h-[38rem] overflow-y-auto divide-y">
              {visible.map((provider) => {
                const checked =
                  provider.kind === 'tool' && Boolean(assignment?.selectedIds.has(provider.id));
                const assignable =
                  provider.kind === 'tool' && Boolean(assignment?.canAssign(provider));
                const accessLevel =
                  provider.kind === 'tool' ? toolAccess(capabilityProviderTool(provider)) : null;
                return (
                  <div
                    key={provider.kind + ':' + provider.id}
                    className={cn(
                      'flex min-w-0 items-start gap-3 px-4 py-4 sm:items-center',
                      checked && 'bg-accent/60'
                    )}
                  >
                    {assignment ? (
                      <Checkbox
                        aria-label={'Assign ' + provider.name}
                        className="mt-1 shrink-0 rounded-[4px] sm:mt-0"
                        checked={checked}
                        disabled={!assignment.canEdit || !assignable}
                        onCheckedChange={(value) =>
                          assignment.onToggle(provider.id, value === true)
                        }
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h3 className="text-sm font-semibold leading-5">{provider.name}</h3>
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {provider.description}
                      </p>
                      {provider.kind === 'tool' &&
                      toolOperationChoices(capabilityProviderTool(provider)).length ? (
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={toolOperationChoices(capabilityProviderTool(provider)).join(', ')}
                        >
                          Actions:{' '}
                          {toolOperationChoices(capabilityProviderTool(provider)).join(', ')}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 sm:hidden">
                        {accessLevel ? (
                          <Badge variant={accessLevel === 'read' ? 'default' : 'outline'}>
                            {toolAccessLabels[accessLevel]}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Connection</Badge>
                        )}
                      </div>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      {accessLevel ? (
                        <Badge variant={accessLevel === 'read' ? 'default' : 'outline'}>
                          {toolAccessLabels[accessLevel]}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Connection</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={'Inspect ' + provider.name}
                      onClick={(event) => {
                        inspectTriggerRef.current = event.currentTarget;
                        onSelect(provider.id);
                      }}
                    >
                      Inspect
                    </Button>
                  </div>
                );
              })}
              {!matching.length ? (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-sm text-muted-foreground">
                  <p role="status">
                    {unique.length
                      ? 'No capabilities match your filters.'
                      : 'No capabilities are available yet.'}
                  </p>
                  {unique.length ? (
                    <Button variant="outline" onClick={reset}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </fieldset>
          <nav
            aria-label="Capability pages"
            className="flex flex-wrap items-center justify-between gap-2 border-t p-3"
          >
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <p aria-live="polite">
                {matching.length} unique capabilities · Showing{' '}
                {matching.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
                {Math.min(currentPage * PAGE_SIZE, matching.length)}
              </p>
              {pageCount > 1 ? (
                <p>
                  Page {currentPage} of {pageCount}
                </p>
              ) : null}
            </div>
            {pageCount > 1 ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= pageCount}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </nav>
        </div>
        {assignment ? (
          <aside
            id="capability-agent-access"
            aria-label="Agent access"
            className="min-w-0 md:col-start-2 xl:col-start-auto"
          >
            {assignment.panel}
          </aside>
        ) : null}
      </div>
      <AppDialog
        open={Boolean(selectedProvider)}
        onOpenChange={(open) => {
          if (!open) onSelect(null);
        }}
        title={selectedProvider?.name ?? 'Capability details'}
        description="Inspect this operation and its existing contract."
        size="lg"
        onCloseAutoFocus={(event) => {
          if (inspectTriggerRef.current?.isConnected) {
            event.preventDefault();
            inspectTriggerRef.current.focus();
          }
        }}
      >
        {selectedProvider ? renderDetails(selectedProvider) : null}
      </AppDialog>
    </section>
  );
}
