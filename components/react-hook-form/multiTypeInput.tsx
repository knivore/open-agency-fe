'use client';
import { useId, useState, type ComponentPropsWithoutRef } from 'react';
import type {
  FieldError,
  FieldPath,
  FieldValues,
  RegisterOptions,
  UseFormRegister,
} from 'react-hook-form';
import { Input } from '../library/shadcn/input';
import { FormField } from '../app-shell/FormSection';
import { cn } from '@/lib/utils';

type TextInputProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: FieldError;
  validation?: RegisterOptions<T, FieldPath<T>>;
  isChecked?: boolean;
  description?: string;
} & Omit<ComponentPropsWithoutRef<typeof Input>, 'name'>;

export default function MultiTypeInput<T extends FieldValues>({
  name,
  label,
  register,
  error,
  validation,
  description,
  id,
  type = 'text',
  className,
  isChecked,
  defaultChecked,
  checked,
  defaultValue,
  value,
  min,
  max,
  onChange,
  onBlur,
  ...props
}: TextInputProps<T>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [rangeValue, setRangeValue] = useState(() => String(defaultValue ?? min ?? 0));
  const field = register(name, validation);
  return (
    <FormField
      label={label}
      htmlFor={controlId}
      error={error?.message}
      description={description}
      disabled={props.disabled}
    >
      <Input
        {...field}
        {...props}
        id={controlId}
        type={type}
        value={value}
        defaultValue={defaultValue}
        checked={checked}
        defaultChecked={checked === undefined ? (defaultChecked ?? isChecked) : undefined}
        min={min ?? (type === 'range' ? 0 : undefined)}
        max={max ?? (type === 'range' ? 100 : undefined)}
        className={cn(type === 'checkbox' && 'size-4 p-0', className)}
        onChange={(event) => {
          // Never replace RHF's handler when composing a range or caller callback.
          void field.onChange(event);
          onChange?.(event);
          if (type === 'range') setRangeValue(event.target.value);
        }}
        onBlur={(event) => {
          void field.onBlur(event);
          onBlur?.(event);
        }}
      />
      {type === 'range' ? (
        <output htmlFor={controlId} className="text-xs text-muted-foreground">
          {value ?? rangeValue}
        </output>
      ) : null}
    </FormField>
  );
}
