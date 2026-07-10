import React, { ComponentPropsWithoutRef, useState } from 'react';
import { Input } from '../library/shadcn/input';
import { Label } from '../library/shadcn/label';
import {
  FieldError,
  FieldPath,
  FieldValues,
  RegisterOptions,
  UseFormRegister,
} from 'react-hook-form';
import { cn } from '@/lib/utils';

type TextInputProps<TFieldValues extends FieldValues> = {
  name: FieldPath<TFieldValues>;
  label: string;
  register: UseFormRegister<TFieldValues>;
  error?: FieldError;
  validation?: RegisterOptions<TFieldValues, FieldPath<TFieldValues>>;
  isChecked?: boolean;
} & Omit<ComponentPropsWithoutRef<typeof Input>, 'name'>;

export default function MultiTypeInput<TFieldValues extends FieldValues>({
  name,
  label,
  register,
  error,
  validation,
  className = '',
  type = 'text',
  min = 0,
  max = 100,
  isChecked,
  defaultValue,
  ...props
}: TextInputProps<TFieldValues>) {
  const [sliderValue, setSliderValue] = useState(defaultValue || min || '0'); // Track slider value

  // Handle slider value change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSliderValue(value); // Update local state
  };

  // Calculate the position of the slider value display
  const sliderPercentage =
    ((Number(sliderValue) - Number(min)) / (Number(max) - Number(min))) * 100 + 1;

  return (
    <div className="flex flex-col gap-2" data-invalid={error ? true : undefined}>
      <Label className="text-sm font-medium text-(--agency-shell-text)">{label}</Label>

      {/* Slider Container */}
      {type === 'range' && (
        <div className="flex items-center justify-between text-xs text-(--agency-shell-muted)">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}

      {/* MixInput */}
      <div className="relative">
        {type === 'checkbox' ? (
          // Checkbox input
          <Input
            type="checkbox"
            aria-invalid={error ? true : undefined}
            className={cn(
              'size-4 rounded border',
              error && 'border-destructive ring-destructive/20',
              className
            )}
            {...register(name, validation)}
            defaultChecked={isChecked}
          />
        ) : (
          // Other input Types
          <Input
            type={type}
            aria-invalid={error ? true : undefined}
            className={cn(error && 'border-destructive ring-destructive/20', className)}
            {...register(name, validation)}
            {...props}
            defaultValue={defaultValue}
            onChange={type === 'range' ? handleSliderChange : undefined}
            min={min}
            max={max}
          />
        )}

        {/* Current Value Display for Slider */}
        {type === 'range' && (
          <div
            className="absolute -bottom-7 -translate-x-1/2 rounded-md border border-(--agency-shell-border) bg-(--agency-shell-panel-strong) px-2 py-1 text-sm text-(--agency-shell-text) shadow-md"
            style={{
              left: `${sliderPercentage > 99 ? 99 : sliderPercentage}%`,
            }}
          >
            {sliderValue}
          </div>
        )}
      </div>
      {error ? <p className="text-sm text-(--agency-danger-text)">{error.message}</p> : null}
    </div>
  );
}
