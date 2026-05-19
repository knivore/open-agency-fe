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
    <div>
      <Label className="block text-sm font-medium text-gray-700">{label}</Label>
      <Controller
        name={name}
        control={control}
        rules={validation}
        render={({ field }) => (
          <ShadcnCombobox
            value={field.value}
            onChange={field.onChange}
            options={options}
            className={`mt-1 ${error ? 'border-red-500' : ''} ${className}`}
            {...props}
          />
        )}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
