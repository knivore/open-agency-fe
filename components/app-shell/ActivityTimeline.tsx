import type { ReactNode } from 'react';
import AppState from './AppState';

export interface ActivityTimelineItem {
  id: string;
  title: ReactNode;
  timestamp?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
}

export default function ActivityTimeline({
  items,
  empty = 'No activity recorded.',
}: {
  items: readonly ActivityTimelineItem[];
  empty?: string;
}) {
  if (!items.length)
    return (
      <AppState
        variant="empty"
        title={empty}
        description="Activity will appear here when recorded."
        compact
      />
    );
  return (
    <ol className="flex flex-col border-l pl-5">
      {items.map((item) => (
        <li
          key={item.id}
          className="relative flex min-w-0 flex-col gap-2 border-b py-4 last:border-0"
        >
          <span
            className="absolute -left-[1.6rem] top-5 size-2.5 rounded-full bg-primary"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 text-sm font-medium">{item.title}</div>
            {item.timestamp ? (
              <span className="shrink-0 text-xs text-muted-foreground">{item.timestamp}</span>
            ) : null}
          </div>
          {item.meta}
          {item.description ? (
            <div className="break-words text-sm leading-6 text-muted-foreground">
              {item.description}
            </div>
          ) : null}
          {item.detail}
        </li>
      ))}
    </ol>
  );
}
