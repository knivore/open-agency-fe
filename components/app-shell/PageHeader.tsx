import { Fragment, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/library/shadcn/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/library/shadcn/breadcrumb';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  breadcrumbs?: readonly { label: ReactNode; href?: string }[];
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
  description?: ReactNode;
  meta?: ReactNode;
  tone?:
    | 'agent'
    | 'assistant'
    | 'graph'
    | 'help'
    | 'integration'
    | 'memory'
    | 'model'
    | 'monitor'
    | 'operator'
    | 'persona'
    | 'profile'
    | 'run'
    | 'workflow';
  title: ReactNode;
}

export default function PageHeader({
  breadcrumbs,
  actions,
  className,
  compact = false,
  description,
  meta,
  tone = 'workflow',
  title,
}: PageHeaderProps) {
  return (
    <div
      data-tone={tone}
      className={cn(
        'agency-page-header relative flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          {breadcrumbs?.length ? (
            <Breadcrumb className="mb-3" aria-label="Page context">
              <BreadcrumbList className="gap-2 text-xs text-muted-foreground">
                {breadcrumbs.map((item, index) => (
                  <Fragment key={index}>
                    {index > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem>
                      {item.href ? (
                        <BreadcrumbLink asChild>
                          <Link href={item.href}>{item.label}</Link>
                        </BreadcrumbLink>
                      ) : index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <span>{item.label}</span>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          ) : null}
          <h1
            className={cn(
              'break-words font-semibold leading-tight tracking-[-0.025em] text-(--agency-shell-text)',
              compact ? 'text-[1.75rem] sm:text-[2rem]' : 'text-[1.85rem] sm:text-[2rem]'
            )}
          >
            {title}
          </h1>
          {description ? (
            <div
              className={cn(
                'max-w-[72ch] text-(--agency-shell-muted)',
                compact
                  ? 'mt-1 text-sm leading-5 sm:text-[0.95rem]'
                  : 'mt-1.5 text-[0.95rem] leading-6 sm:text-base'
              )}
            >
              {description}
            </div>
          ) : null}
          {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[50%] lg:justify-end lg:pt-0.5">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Native section links keep long settings forms mounted and preserve their drafts. */
export function WorkspaceSectionNav({
  sections,
  label = 'Page sections',
}: {
  sections: readonly { id: string; label: string }[];
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="sticky top-0 z-10 flex flex-wrap gap-1 rounded-xl border bg-card p-2"
    >
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

/** Steps report navigation intent; feature callbacks retain their draft guards. */
export function WorkspaceGuide({
  label,
  steps,
}: {
  label: string;
  steps: readonly {
    id: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    current?: boolean;
    href?: string;
    onSelect?: () => void;
  }[];
}) {
  return (
    <nav aria-label={label} className="rounded-lg border bg-card p-2 sm:px-3">
      <ol className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const content = (
            <>
              <Icon data-icon="inline-start" aria-hidden="true" />
              <span>{step.label}</span>
            </>
          );
          return (
            <li key={step.id} className="flex min-w-0 items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                asChild={Boolean(step.href)}
                onClick={step.onSelect}
                aria-current={step.current ? 'step' : undefined}
                className={cn(
                  'w-full justify-start sm:w-auto',
                  step.current && 'bg-accent text-primary'
                )}
              >
                {step.href ? <a href={step.href}>{content}</a> : content}
              </Button>
              {index < steps.length - 1 ? (
                <ChevronRight
                  className="hidden size-4 shrink-0 text-muted-foreground sm:block"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
