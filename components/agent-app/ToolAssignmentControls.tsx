'use client';

import { ScrollArea } from '@/components/library/shadcn/scroll-area';

import { NativeSelect } from '@/components/library/shadcn/select';
import { useDeferredValue, useId, useMemo, useState } from 'react';
import type { ToolDefinition } from '@/types/tools';
import { toolDisplayName } from '@/lib/tools/displayName';
import {
  groupCapabilityTools,
  matchesToolSearch,
  toolAccess,
  type ToolAccess,
  toolAccessLabels,
  toolOperationChoices,
  updateToolSelection,
} from '@/lib/tools/capabilityCatalog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../library/shadcn/accordion';
import { Badge } from '../library/shadcn/badge';
import { Button } from '../library/shadcn/button';
import { Input } from '../library/shadcn/input';
import { FormField, FormFieldGroup } from '../app-shell/FormSection';
import { Check } from 'lucide-react';

export default function ToolAssignmentControls({
  disabled,
  onChange,
  toolIds,
  tools,
  isMainAgent = false,
  readOnly = false,
}: {
  disabled: boolean;
  onChange: (ids: string[]) => void;
  toolIds: string[];
  tools: ToolDefinition[];
  isMainAgent?: boolean;
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState('');
  const fieldId = useId();
  const [access, setAccess] = useState<ToolAccess | 'all'>('all');
  const [assignedOnly, setAssignedOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);
  // Read-only harness browsing includes every catalog operation. This derived
  // presentation set never replaces the explicit IDs used by save callbacks.
  const selected = useMemo(
    () =>
      new Set(readOnly && isMainAgent ? [...toolIds, ...tools.map((tool) => tool.id)] : toolIds),
    [toolIds, tools, readOnly, isMainAgent]
  );
  const groups = useMemo(
    () =>
      groupCapabilityTools(
        tools.filter(
          (tool) =>
            (!readOnly || isMainAgent || selected.has(tool.id)) &&
            matchesToolSearch(tool, deferredQuery) &&
            (access === 'all' || toolAccess(tool) === access) &&
            (!assignedOnly || selected.has(tool.id))
        )
      ),
    [tools, deferredQuery, access, assignedOnly, selected, readOnly, isMainAgent]
  );
  const visibleIds = groups.flatMap((group) => group.tools.map((tool) => tool.id));
  const unavailableIds = toolIds.filter((id) => !tools.some((tool) => tool.id === id));
  const ToolRow = readOnly ? 'div' : 'label';

  return (
    <section aria-label="Agent capabilities" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {readOnly
            ? isMainAgent
              ? 'Available capabilities'
              : 'Assigned tools'
            : 'Tool assignment'}{' '}
          <Badge variant="secondary">
            {readOnly && isMainAgent ? `${tools.length} available` : `${toolIds.length} assigned`}
          </Badge>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || toolIds.length === 0}
            onClick={() => onChange([])}
          >
            No tools
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-(--agency-shell-muted)">
        {readOnly
          ? isMainAgent
            ? 'All enabled capabilities remain owned by the main agent. Ownership checks and approval rules still apply.'
            : 'Review this specialist’s explicitly assigned operations. Choose Edit agent to change access.'
          : isMainAgent
            ? 'The main agent orchestrates the agency. Built-in access is managed by harness policy; additional tools can be selected here.'
            : 'Give this specialist the capabilities its role needs. Selections are saved as explicit tools; new operations are not added automatically.'}
      </p>
      <FormFieldGroup columns={2}>
        <FormField label="Search capabilities" htmlFor={`${fieldId}-search`}>
          <Input
            id={`${fieldId}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a capability, operation, or parameter…"
          />
        </FormField>
        <FormField label="Access level" htmlFor={`${fieldId}-access`}>
          <NativeSelect
            id={`${fieldId}-access`}
            value={access}
            onChange={(event) => setAccess(event.target.value as typeof access)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All access levels</option>
            {Object.entries(toolAccessLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </FormFieldGroup>
      <div className="flex flex-wrap items-center gap-3">
        {!readOnly ? (
          <label className="flex items-center gap-2 text-sm">
            <Input
              type="checkbox"
              checked={assignedOnly}
              onChange={(event) => setAssignedOnly(event.target.checked)}
            />
            Assigned only
          </label>
        ) : null}
        <span role="status" className="text-xs text-(--agency-shell-muted)">
          {visibleIds.length} matching tools
        </span>
        {!readOnly ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                disabled || visibleIds.length === 0 || visibleIds.every((id) => selected.has(id))
              }
              onClick={() => onChange(updateToolSelection(toolIds, visibleIds, true))}
            >
              Select matching ({visibleIds.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || !visibleIds.some((id) => selected.has(id))}
              onClick={() => onChange(updateToolSelection(toolIds, visibleIds, false))}
            >
              Clear matching
            </Button>
          </>
        ) : null}
      </div>
      {unavailableIds.length > 0 ? (
        <details className="text-sm">
          <summary>{unavailableIds.length} unavailable assigned tools</summary>
          <p className="my-2 text-xs text-(--agency-shell-muted)">
            These assignments remain attached even when their catalog entries are unavailable.
          </p>
          {unavailableIds.map((id) => (
            <ToolRow key={id} className="flex items-center gap-2 py-1">
              {!readOnly ? (
                <Input
                  type="checkbox"
                  checked
                  disabled={disabled}
                  onChange={() => onChange(toolIds.filter((candidate) => candidate !== id))}
                />
              ) : (
                <Check className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="break-all">{id}</span>
            </ToolRow>
          ))}
        </details>
      ) : null}
      <Accordion type="multiple" className="space-y-2">
        {groups.map((group) => (
          <AccordionItem key={group.id} value={group.id} className="rounded-lg border px-3">
            <AccordionTrigger className="text-left hover:no-underline">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  {group.label}
                  <Badge variant="outline">
                    {readOnly
                      ? `${group.tools.length} operations`
                      : `${group.tools.filter((tool) => selected.has(tool.id)).length} / ${group.tools.length}`}
                  </Badge>
                </span>
                <span className="mt-1 block text-xs font-normal text-(--agency-shell-muted)">
                  {group.description}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              {!readOnly ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || group.tools.every((tool) => selected.has(tool.id))}
                    onClick={() =>
                      onChange(
                        updateToolSelection(
                          toolIds,
                          group.tools.map((tool) => tool.id),
                          true
                        )
                      )
                    }
                  >
                    Select group
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || !group.tools.some((tool) => selected.has(tool.id))}
                    onClick={() =>
                      onChange(
                        updateToolSelection(
                          toolIds,
                          group.tools.map((tool) => tool.id),
                          false
                        )
                      )
                    }
                  >
                    Clear group
                  </Button>
                </div>
              ) : null}
              <ScrollArea className="max-h-80" viewportClassName="max-h-80">
                <fieldset className="space-y-2">
                  <legend className="sr-only">{group.label} operations</legend>
                  {group.tools.map((tool) => {
                    const actions = toolOperationChoices(tool);
                    return (
                      <ToolRow
                        key={tool.id}
                        className="flex items-start gap-3 rounded-md border p-3"
                      >
                        {!readOnly ? (
                          <Input
                            type="checkbox"
                            className="mt-1"
                            checked={selected.has(tool.id)}
                            disabled={disabled}
                            onChange={(event) =>
                              onChange(
                                updateToolSelection(toolIds, [tool.id], event.target.checked)
                              )
                            }
                          />
                        ) : (
                          <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{toolDisplayName(tool)}</span>
                            <Badge variant="outline">{toolAccessLabels[toolAccess(tool)]}</Badge>
                          </span>
                          <span className="mt-1 block break-all text-xs text-(--agency-shell-muted)">
                            {tool.id}
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs text-(--agency-shell-muted)" title={tool.description}>
                            {tool.description}
                          </span>
                          {actions.length ? (
                            <span
                              className="mt-2 block break-words text-xs text-muted-foreground"
                              title={actions.join(', ')}
                            >
                              Actions: {actions.join(', ')}
                            </span>
                          ) : null}
                        </span>
                      </ToolRow>
                    );
                  })}
                </fieldset>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {groups.length === 0 ? (
        <p role="status" className="text-sm text-(--agency-shell-muted)">
          No capabilities match. Adjust your search or access level.
        </p>
      ) : null}
    </section>
  );
}
