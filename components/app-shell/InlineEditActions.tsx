'use client';

import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/library/shadcn/button';

/** Reports intent only; validation, draft guards, and mutations remain feature-owned. */
export default function InlineEditActions({
  editing,
  busy = false,
  disabled = false,
  onEdit,
  onSave,
  onCancel,
  editLabel = 'Edit',
  saveLabel = 'Save changes',
}: {
  editing: boolean;
  busy?: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  editLabel?: string;
  saveLabel?: string;
}) {
  return editing ? (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
        <X data-icon="inline-start" />
        Cancel
      </Button>
      <Button type="button" disabled={busy || disabled} onClick={onSave}>
        <Save data-icon="inline-start" />
        {busy ? 'Saving…' : saveLabel}
      </Button>
    </div>
  ) : (
    <Button type="button" variant="outline" onClick={onEdit} disabled={busy}>
      <Pencil data-icon="inline-start" />
      {editLabel}
    </Button>
  );
}
