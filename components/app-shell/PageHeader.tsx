import { Fragment, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
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
  eyebrow?: string;
  icon?: ComponentType<{ className?: string }>;
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
  eyebrow,
  icon: Icon,
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
          <Breadcrumb className="mb-3" aria-label="Page context">
            <BreadcrumbList className="gap-2 text-xs text-muted-foreground">
              {breadcrumbs?.length ? (
                breadcrumbs.map((item, index) => (
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
                ))
              ) : (
                <BreadcrumbItem>
                  {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                  <span>{eyebrow ?? 'Workspace'}</span>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          <h1
            className={cn(
              'break-words font-semibold leading-tight tracking-[-0.04em] text-(--agency-shell-text)',
              compact ? 'text-[1.75rem] sm:text-[2.15rem]' : 'text-[1.85rem] sm:text-[2.5rem]'
            )}
          >
            {title}
          </h1>
          {description ? (
            <div
              className={cn(
                'max-w-3xl text-(--agency-shell-muted)',
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
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[50%] lg:justify-end lg:pt-7">
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
      className="sticky top-0 z-10 flex flex-wrap gap-1 rounded-xl border bg-background/95 p-2 backdrop-blur"
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
