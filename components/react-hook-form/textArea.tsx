'use client';
import { useId, type ComponentPropsWithoutRef } from 'react';
import type {
  UseFormRegister,
  FieldError,
  FieldPath,
  FieldValues,
  RegisterOptions,
} from 'react-hook-form';
import { Textarea } from '../library/shadcn/textarea';
import { FormField } from '../app-shell/FormSection';

type TextAreaProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: FieldError;
  validation?: RegisterOptions<T, FieldPath<T>>;
  description?: string;
} & Omit<ComponentPropsWithoutRef<typeof Textarea>, 'name'>;

export default function TextArea<T extends FieldValues>({
  name,
  label,
  register,
  error,
  validation,
  description,
  id,
  onChange,
  onBlur,
  ...props
}: TextAreaProps<T>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const field = register(name, validation);
  return (
    <FormField
      label={label}
      htmlFor={controlId}
      error={error?.message}
      description={description}
      disabled={props.disabled}
    >
      <Textarea
        {...field}
        {...props}
        id={controlId}
        onChange={(event) => {
          void field.onChange(event);
          onChange?.(event);
        }}
        onBlur={(event) => {
          void field.onBlur(event);
          onBlur?.(event);
        }}
      />
    </FormField>
  );
}
