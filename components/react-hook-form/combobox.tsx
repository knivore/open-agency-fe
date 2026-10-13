'use client';
import { useId } from 'react';
import {
  Controller,
  type Control,
  type FieldError,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';
import { Combobox as SearchableSelect, type ComboboxOption } from '../library/shadcn/combobox';
import { FormField } from '../app-shell/FormSection';

type FormComboboxProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  control: Control<T>;
  options: readonly ComboboxOption[];
  error?: FieldError;
  validation?: RegisterOptions<T, FieldPath<T>>;
  placeholder?: string;
  className?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  canDeselect?: boolean;
  id?: string;
  description?: string;
  disabled?: boolean;
};

export default function Combobox<T extends FieldValues>({
  name,
  label,
  control,
  options,
  error,
  validation,
  id,
  description,
  disabled,
  ...props
}: FormComboboxProps<T>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <Controller
      name={name}
      control={control}
      rules={validation}
      disabled={disabled}
      render={({ field, fieldState }) => (
        <FormField
          label={label}
          htmlFor={controlId}
          error={(error ?? fieldState.error)?.message}
          description={description}
          disabled={disabled}
        >
          <SearchableSelect
            {...props}
            id={controlId}
            ref={field.ref}
            onBlur={field.onBlur}
            disabled={disabled}
            options={options}
            value={String(field.value ?? '')}
            onChange={field.onChange}
          />
        </FormField>
      )}
    />
  );
}
