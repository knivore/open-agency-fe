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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../library/shadcn/select';
import { FormField } from '../app-shell/FormSection';

type FormSelectProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  control: Control<T>;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  error?: FieldError;
  validation?: RegisterOptions<T, FieldPath<T>>;
  placeholder?: string;
  className?: string;
  id?: string;
  description?: string;
  disabled?: boolean;
};

export default function FormSelect<T extends FieldValues>({
  name,
  label,
  control,
  options,
  error,
  validation,
  placeholder = 'Select an option',
  className,
  id,
  description,
  disabled,
}: FormSelectProps<T>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <Controller
      name={name}
      control={control}
      rules={validation}
      disabled={disabled}
      render={({ field, fieldState }) => {
        const message = (error ?? fieldState.error)?.message;
        return (
          <FormField
            label={label}
            htmlFor={controlId}
            error={message}
            description={description}
            disabled={disabled}
          >
            <Select
              name={field.name}
              value={String(field.value ?? '')}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger
                id={controlId}
                ref={field.ref}
                onBlur={field.onBlur}
                className={className}
                aria-invalid={message ? true : undefined}
                aria-describedby={message || description ? controlId + '-feedback' : undefined}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormField>
        );
      }}
    />
  );
}
