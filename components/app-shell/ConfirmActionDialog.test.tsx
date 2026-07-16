import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmActionDialog from '@/components/app-shell/ConfirmActionDialog';
import { Button } from '@/components/library/shadcn/button';

describe('ConfirmActionDialog', () => {
  it('requires explicit confirmation before running a destructive action', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionDialog
        title="Cancel this run?"
        description="This stops future execution work."
        confirmLabel="Cancel run"
        destructive
        onConfirm={onConfirm}
        trigger={<Button type="button">Cancel</Button>}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('supports context-specific cancellation language', () => {
    render(
      <ConfirmActionDialog
        title="Discard edits?"
        description="Your changes have not been saved."
        cancelLabel="Continue editing"
        confirmLabel="Discard"
        destructive
        onConfirm={vi.fn()}
        trigger={<Button type="button">Close editor</Button>}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    expect(screen.getByRole('button', { name: 'Continue editing' })).toBeInTheDocument();
  });
});
