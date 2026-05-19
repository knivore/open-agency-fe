import * as React from 'react';
import { Control, FieldError, RegisterOptions, Controller } from 'react-hook-form';
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../library/shadcn/select';
import { Label } from '../library/shadcn/label';

type Option = {
  value: string;
  label: string;
};

type FormSelectProps = {
  name: string;
  label: string;
  control: Control<any>;
  options: Option[];
  error?: FieldError;
  validation?: RegisterOptions;
  placeholder?: string;
  className?: string;
};

export default function Select({
  name,
  label,
  control,
  options,
  error,
  validation,
  placeholder = 'Select an option',
  className = 'w-[180px]',
}: FormSelectProps) {
  return (
    <div className="space-y-2">
      <Label className="block text-sm font-medium text-gray-700">{label}</Label>
      <Controller
        name={name}
        control={control}
        rules={validation}
        render={({ field }) => (
          <ShadcnSelect value={field.value} onValueChange={field.onChange}>
            <SelectTrigger className={`${className} ${error ? 'border-red-500 ring-red-500' : ''}`}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </ShadcnSelect>
        )}
      />
      {error && <p className="text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
