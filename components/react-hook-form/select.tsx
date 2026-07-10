import {
  Control,
  FieldError,
  FieldPath,
  FieldValues,
  RegisterOptions,
  Controller,
} from 'react-hook-form';
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../library/shadcn/select';
import { Label } from '../library/shadcn/label';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
};

type FormSelectProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
  label: string;
  control: Control<TFieldValues>;
  options: Option[];
  error?: FieldError;
  validation?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
  placeholder?: string;
  className?: string;
};

export default function Select<TFieldValues extends FieldValues>({
  name,
  label,
  control,
  options,
  error,
  validation,
  placeholder = 'Select an option',
  className = 'w-45',
}: FormSelectProps<TFieldValues>) {
  return (
    <div className="flex flex-col gap-2" data-invalid={error ? true : undefined}>
      <Label className="text-sm font-medium text-(--agency-shell-text)">{label}</Label>
      <Controller
        name={name}
        control={control}
        rules={validation}
        render={({ field }) => (
          <ShadcnSelect value={field.value} onValueChange={field.onChange}>
            <SelectTrigger
              aria-invalid={error ? true : undefined}
              className={cn(className, error && 'border-destructive ring-destructive/20')}
            >
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
      {error ? <p className="text-sm text-(--agency-danger-text)">{error.message}</p> : null}
    </div>
  );
}
