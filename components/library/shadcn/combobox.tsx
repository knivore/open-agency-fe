'use client';

import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxProps extends Omit<
  ComponentPropsWithoutRef<typeof Button>,
  'value' | 'onChange' | 'children'
> {
  options: readonly ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  canDeselect?: boolean;
}

export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Select an option...',
      searchPlaceholder = 'Search...',
      noResultsText = 'No results found.',
      canDeselect = false,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value);
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Popover open={open && !disabled} onOpenChange={setOpen}>
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
              className={cn('min-w-0 flex-1 justify-between', className)}
            >
              <span className="truncate">{selected?.label || value || placeholder}</span>
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
                      onSelect={() => {
                        onChange(canDeselect && option.value === value ? '' : option.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'size-4',
                          option.value === value ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden="true"
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {canDeselect && value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Clear selection"
            onClick={() => onChange('')}
          >
            <X data-icon="inline-start" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    );
  }
);
Combobox.displayName = 'Combobox';
