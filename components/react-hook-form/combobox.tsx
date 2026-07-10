import { ComponentPropsWithoutRef } from 'react';
import {
  Control,
  FieldError,
  RegisterOptions,
  Controller,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

import { Label } from '../library/shadcn/label';
import { Combobox as ShadcnCombobox } from '../library/shadcn/combobox';
import { cn } from '@/lib/utils';

type ComboboxOption = {
  value: string;
  label: string;
};

type FormComboboxProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
  label: string;
  control: Control<TFieldValues>;
  options: ComboboxOption[];
  error?: FieldError;
  validation?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
} & Omit<ComponentPropsWithoutRef<typeof ShadcnCombobox>, 'value' | 'onChange' | 'options'>;

export default function Combobox<TFieldValues extends FieldValues>({
  name,
  label,
  control,
  options,
  error,
  validation,
  className = '',
  ...props
}: FormComboboxProps<TFieldValues>) {
  return (
    <div className="flex flex-col gap-2" data-invalid={error ? true : undefined}>
      <Label className="text-sm font-medium text-(--agency-shell-text)">{label}</Label>
      <Controller
        name={name}
        control={control}
        rules={validation}
        render={({ field }) => (
          <ShadcnCombobox
            value={field.value}
            onChange={field.onChange}
            options={options}
            aria-invalid={error ? true : undefined}
            className={cn(error && 'border-destructive ring-destructive/20', className)}
            {...props}
          />
        )}
      />
      {error ? <p className="text-sm text-(--agency-danger-text)">{error.message}</p> : null}
    </div>
  );
}
