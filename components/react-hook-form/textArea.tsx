import { ComponentPropsWithoutRef } from 'react';
import { UseFormRegister, FieldError, RegisterOptions } from 'react-hook-form';

import { Textarea } from '../library/shadcn/textarea';
import { Label } from '../library/shadcn/label';

type TextAreaProps = {
  name: string;
  label: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  validation?: RegisterOptions;
} & Omit<ComponentPropsWithoutRef<typeof Textarea>, 'name'>;

export default function TextArea({
  name,
  label,
  register,
  error,
  validation,
  className = '',
  ...props
}: TextAreaProps) {
  return (
    <div>
      <Label className="block text-sm font-medium text-gray-700">{label}</Label>
      <Textarea
        className={`mt-1 block w-full p-2 border rounded-lg ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...register(name, validation)}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
