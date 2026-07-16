'use client';

import { Bookmark, BookmarkPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/library/shadcn/button';
import type { RunsStatusFilter } from '@/components/runs/hooks/useRunsWorkspace';
import {
  createSavedRunView,
  removeSavedRunView,
  saveRunView,
  useSavedRunViews,
} from '@/lib/runs/savedViews';

export default function RunsSavedViews({
  search,
  status,
  onApply,
}: {
  search: string;
  status: RunsStatusFilter;
  onApply: (view: { search: string; status: RunsStatusFilter }) => void;
}) {
  const savedViews = useSavedRunViews();
  const hasActiveFilter = search.trim().length > 0 || status !== 'all';

  const handleSave = () => {
    const created = createSavedRunView(search, status);
    const saved = saveRunView(created);
    toast.success(saved.id === created.id ? 'Run view saved.' : 'This run view is already saved.', {
      position: 'top-right',
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Saved run views">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasActiveFilter}
        onClick={handleSave}
      >
        <BookmarkPlus data-icon="inline-start" aria-hidden="true" />
        Save view
      </Button>
      {savedViews.length > 0 ? (
        <span className="text-xs font-medium uppercase tracking-wide text-(--agency-shell-muted)">
          Saved
        </span>
      ) : null}
      {savedViews.map((view) => (
        <span
          key={view.id}
          className="inline-flex items-center rounded-lg border border-(--agency-shell-border) bg-(--agency-control-bg)"
        >
          <button
            type="button"
            className="inline-flex h-8 max-w-64 items-center gap-1.5 rounded-l-lg px-2.5 text-xs font-medium outline-none hover:bg-(--agency-control-bg-hover) focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onApply(view)}
            title={`Apply ${view.label}`}
          >
            <Bookmark className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{view.label}</span>
          </button>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-r-lg border-l border-(--agency-shell-border) text-(--agency-shell-muted) outline-none hover:bg-(--agency-control-bg-hover) hover:text-(--agency-shell-text) focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Remove saved view ${view.label}`}
            onClick={() => removeSavedRunView(view.id)}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}
