'use client';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '../shadcn/button';
import { Check, ChevronsUpDown, X, LucideIcon } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../shadcn/command';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover';

type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  canDeselect?: boolean;
};

type IconConfig = {
  Icon: LucideIcon;
  action?: (e: React.MouseEvent) => void;
  label: string;
};

const ComboboxItem = ({
  option,
  isSelected,
  onSelect,
}: {
  option: ComboboxOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
}) => (
  <CommandItem key={option.value} value={option.value} onSelect={onSelect}>
    <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
    {option.label}
  </CommandItem>
);

function getIconConfig(
  hasValue: boolean,
  canDeselect: boolean,
  onClear: (e: React.MouseEvent) => void
): IconConfig {
  if (hasValue && canDeselect) {
    return {
      Icon: X,
      action: onClear,
      label: 'Clear selection',
    };
  }

  return {
    Icon: ChevronsUpDown,
    action: undefined,
    label: 'Toggle menu',
  };
}

export function Combobox({
  options,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  noResultsText = 'No results found.',
  value,
  onChange,
  className,
  canDeselect = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedLabel = options.find((opt) => opt.value === value)?.label;

  const handleSelect = (currentValue: string) => {
    if (currentValue === value && canDeselect) {
      onChange('');
    } else if (currentValue !== value) {
      onChange(currentValue);
    }
    setOpen(false);
    setSearchQuery(''); // Clear search when selection is made
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const { Icon, action, label } = getIconConfig(!!value, canDeselect, handleClear);

  // Filter options based on search query (matching both label and value)
  const filteredOptions = options.filter((option) => {
    const query = searchQuery.toLowerCase();
    return option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <Icon
            className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            onClick={action}
            aria-label={label}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList
            className="overflow-auto"
            onWheel={(e) => {
              e.stopPropagation();
            }}
          >
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <ComboboxItem
                  key={option.value}
                  option={option}
                  isSelected={value === option.value}
                  onSelect={() => handleSelect(option.value)}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
