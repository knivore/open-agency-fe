'use client';
import { FormField } from '@/components/app-shell/FormSection';

import { useId, type ComponentType, type ReactNode } from 'react';
import { NativeSelect } from '@/components/library/shadcn/select';
import { Button } from '@/components/library/shadcn/button';
import { cn } from '@/lib/utils';
import WorkspaceSearch from './WorkspaceSearch';

export interface WorkspaceDirectoryEntry {
  id: string;
  label: string;
  description?: string;
  group?: string;
  icon?: ComponentType<{ className?: string }>;
  meta?: ReactNode;
  actionLabel?: string;
  optionLabel?: string;
}

interface WorkspaceDirectoryProps {
  label: string;
  title: string;
  entries: readonly WorkspaceDirectoryEntry[];
  selected?: WorkspaceDirectoryEntry | null;
  onSelect: (id: string) => void;
  search?: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  summary?: ReactNode;
  toolbar?: ReactNode;
  selectionLabel?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

/** Selection and filtering stay feature-owned, including unsaved-change guards. */
export default function WorkspaceDirectory({
  label,
  title,
  entries,
  selected,
  onSelect,
  search,
  summary,
  toolbar,
  selectionLabel = 'Select item',
  emptyMessage = 'No matching items.',
  disabled = false,
  className,
}: WorkspaceDirectoryProps) {
  const selectionId = useId();
  const groups = [...new Set(entries.map((entry) => entry.group ?? ''))];
  const selectedIsFiltered = selected && !entries.some((entry) => entry.id === selected.id);
  return (
    <nav
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-(--agency-radius-panel) border bg-card',
        className
      )}
    >
      <div className="flex flex-col gap-3 border-b p-3">
        <h2 className="px-1 text-sm font-semibold">{title}</h2>
        {search ? <WorkspaceSearch {...search} disabled={disabled} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {summary ? (
            <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
              {summary}
            </p>
          ) : null}
          {toolbar}
        </div>
        <FormField
          label={selectionLabel}
          htmlFor={selectionId}
          className="flex flex-col gap-2 md:hidden"
        >
          <NativeSelect
            id={selectionId}
            value={selected?.id ?? ''}
            disabled={disabled || (!entries.length && !selected)}
            onChange={(event) => {
              if (event.target.value !== selected?.id) onSelect(event.target.value);
            }}
          >
            {!selected ? (
              <option value="">{entries.length ? selectionLabel : emptyMessage}</option>
            ) : null}
            {selectedIsFiltered ? (
              <option value={selected.id}>{selected.label} · Current selection</option>
            ) : null}
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.optionLabel ?? entry.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <div className="hidden max-h-[calc(100dvh-18rem)] flex-col gap-3 overflow-y-auto p-2 md:flex">
        {!entries.length ? (
          <p role="status" className="px-2 py-4 text-xs leading-5 text-muted-foreground">
            {emptyMessage}
          </p>
        ) : null}
        {groups.map((group) => (
          <div key={group} className="flex flex-col gap-1">
            {group ? (
              <h3 className="px-3 pt-2 text-xs font-medium text-muted-foreground">{group}</h3>
            ) : null}
            {entries
              .filter((entry) => (entry.group ?? '') === group)
              .map((entry) => {
                const Icon = entry.icon;
                const active = selected?.id === entry.id;
                return (
                  <Button
                    key={entry.id}
                    type="button"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={entry.actionLabel ?? entry.label}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      if (!active) onSelect(entry.id);
                    }}
                    className={cn(
                      'h-auto min-w-0 items-start justify-start gap-3 whitespace-normal p-3 text-left',
                      active && 'bg-accent text-primary'
                    )}
                  >
                    {Icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden={true} /> : null}
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="break-words text-sm font-semibold">{entry.label}</span>
                      {entry.description ? (
                        <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {entry.description}
                        </span>
                      ) : null}
                      {entry.meta ? (
                        <span className="text-[11px] leading-5 text-muted-foreground">
                          {entry.meta}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                );
              })}
          </div>
        ))}
      </div>
    </nav>
  );
}
