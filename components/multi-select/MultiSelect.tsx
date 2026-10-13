'use client';

import { forwardRef, useState, type ComponentPropsWithoutRef, type ComponentType } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/library/shadcn/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/library/shadcn/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/library/shadcn/popover';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ComponentType<{ className?: string }>;
}

export interface MultiSelectProps extends Omit<
  ComponentPropsWithoutRef<typeof Button>,
  'value' | 'defaultValue' | 'onChange' | 'children' | 'asChild'
> {
  options: readonly MultiSelectOption[];
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  maxCount?: number;
  modalPopover?: boolean;
}

export const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      options,
      value,
      defaultValue = [],
      onValueChange,
      placeholder = 'Select options',
      searchPlaceholder = 'Search options...',
      noResultsText = 'No results found.',
      maxCount = 3,
      modalPopover = false,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const [uncontrolled, setUncontrolled] = useState(() => [...defaultValue]);
    const [open, setOpen] = useState(false);
    const selected = value ?? uncontrolled;
    const selectedSet = new Set(selected);
    const available = options.filter((option) => !option.disabled);
    const labels = selected.map((id) => options.find((option) => option.value === id)?.label ?? id);
    const visibleCount = Math.max(1, maxCount);
    function update(next: string[]) {
      if (disabled) return;
      if (value === undefined) setUncontrolled(next);
      onValueChange(next);
    }
    return (
      <Popover open={open && !disabled} onOpenChange={setOpen} modal={modalPopover}>
        <PopoverTrigger asChild>
          <Button
            {...props}
            ref={ref}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open && !disabled}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn('w-full min-w-0 justify-between', className)}
          >
            <span className="truncate">
              {labels.length ? labels.slice(0, visibleCount).join(', ') : placeholder}
              {labels.length > visibleCount ? ' + ' + (labels.length - visibleCount) + ' more' : ''}
            </span>
            <ChevronsUpDown data-icon="inline-end" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{noResultsText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    disabled={option.disabled}
                    onSelect={() =>
                      update(
                        selectedSet.has(option.value)
                          ? selected.filter((id) => id !== option.value)
                          : [...selected, option.value]
                      )
                    }
                  >
                    <Check
                      className={cn(
                        'size-4',
                        selectedSet.has(option.value) ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden="true"
                    />
                    {option.icon ? <option.icon className="size-4" /> : null}
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="flex flex-wrap gap-2 border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || available.every((option) => selectedSet.has(option.value))}
              onClick={() => {
                // Catalog filtering must not silently drop unavailable selections.
                update([...new Set([...selected, ...available.map((option) => option.value)])]);
              }}
            >
              Select available
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || !selected.length}
              onClick={() => update([])}
            >
              Clear selection
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);
MultiSelect.displayName = 'MultiSelect';
