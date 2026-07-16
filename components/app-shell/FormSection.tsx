'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { ChevronDown, CircleCheck, CircleHelp, CircleX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  advanced?: boolean;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  advancedLabel?: string;
}

export function FormSection({
  title,
  description,
  icon,
  children,
  advanced = false,
  defaultOpen = false,
  className,
  contentClassName,
  advancedLabel = 'Optional settings',
}: FormSectionProps) {
  const content = (
    <div
      className={cn(
        'border-t border-(--agency-shell-border) bg-(--agency-shell-panel-strong)/35 p-4 sm:p-5',
        contentClassName
      )}
    >
      {children}
    </div>
  );

  if (advanced) {
    return (
      <details
        className={cn(
          'group overflow-hidden rounded-xl border border-(--agency-shell-border) bg-(--agency-shell-panel)',
          className
        )}
        open={defaultOpen}
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          {icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--agency-row-hover) text-(--agency-shell-muted)">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-(--agency-shell-text)">{title}</span>
            {description ? (
              <span className="mt-0.5 block text-xs leading-5 text-(--agency-shell-muted)">
                {description}
              </span>
            ) : null}
          </span>
          <span className="hidden text-xs font-medium text-(--agency-shell-muted) sm:inline">
            {advancedLabel}
          </span>
          <ChevronDown className="size-4 shrink-0 text-(--agency-shell-muted) transition-transform group-open:rotate-180" />
        </summary>
        {content}
      </details>
    );
  }

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-(--agency-shell-border) bg-(--agency-shell-panel)',
        className
      )}
      aria-labelledby={`form-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
        {icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--agency-row-hover) text-(--agency-shell-muted)">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3
            id={`form-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            className="text-sm font-semibold text-(--agency-shell-text)"
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-(--agency-shell-muted)">{description}</p>
          ) : null}
        </div>
      </div>
      {content}
    </section>
  );
}

const formFieldGroupColumns = {
  1: '',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
} as const;

interface FormFieldGroupProps extends HTMLAttributes<HTMLDivElement> {
  columns?: keyof typeof formFieldGroupColumns;
}

export function FormFieldGroup({ columns = 1, className, ...props }: FormFieldGroupProps) {
  return (
    <div
      className={cn('grid gap-4', formFieldGroupColumns[columns], className)}
      data-slot="form-field-group"
      {...props}
    />
  );
}

interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string | null;
  success?: string | null;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  description,
  error,
  success,
  required = false,
  optional = false,
  disabled = false,
  children,
  className,
  ...props
}: FormFieldProps) {
  const feedbackId = `${htmlFor}-feedback`;

  return (
    <div
      className={cn('group flex min-w-0 flex-col gap-2', className)}
      data-invalid={error ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-slot="form-field"
      {...props}
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label
          className="text-sm font-medium text-(--agency-shell-text) group-data-[disabled]:opacity-60"
          htmlFor={htmlFor}
        >
          {label}
        </label>
        {required ? (
          <span className="text-[11px] font-medium text-(--agency-shell-muted)">Required</span>
        ) : optional ? (
          <span className="text-[11px] text-(--agency-shell-muted)">Optional</span>
        ) : null}
      </div>
      {children}
      <FieldFeedback
        id={feedbackId}
        error={error}
        success={success}
        help={error || success ? null : description}
        className="mt-0"
      />
    </div>
  );
}

interface FieldFeedbackProps {
  id?: string;
  error?: string | null;
  success?: string | null;
  help?: string | null;
  className?: string;
}

export function FieldFeedback({ id, error, success, help, className }: FieldFeedbackProps) {
  const message = error ?? success ?? help;
  if (!message) return null;

  const Icon = error ? CircleX : success ? CircleCheck : CircleHelp;

  return (
    <p
      id={id}
      role={error ? 'alert' : undefined}
      className={cn(
        'mt-1.5 flex items-start gap-1.5 text-xs leading-5',
        error
          ? 'text-rose-700 dark:text-rose-200'
          : success
            ? 'text-emerald-700 dark:text-emerald-200'
            : 'text-(--agency-shell-muted)',
        className
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
