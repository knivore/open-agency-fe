import { ComponentPropsWithoutRef } from 'react';
import {
  UseFormRegister,
  FieldError,
  FieldPath,
  FieldValues,
  RegisterOptions,
} from 'react-hook-form';

import { Textarea } from '../library/shadcn/textarea';
import { Label } from '../library/shadcn/label';
import { cn } from '@/lib/utils';

type TextAreaProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
  label: string;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  validation?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
} & Omit<ComponentPropsWithoutRef<typeof Textarea>, 'name'>;

export default function TextArea<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  error,
  validation,
  className = '',
  ...props
}: TextAreaProps<TFieldValues>) {
  return (
    <div className="flex flex-col gap-2" data-invalid={error ? true : undefined}>
      <Label className="text-sm font-medium text-(--agency-shell-text)">{label}</Label>
      <Textarea
        aria-invalid={error ? true : undefined}
        className={cn(error && 'border-destructive ring-destructive/20', className)}
        {...register(name, validation)}
        {...props}
      />
      {error ? <p className="text-sm text-(--agency-danger-text)">{error.message}</p> : null}
    </div>
  );
}
