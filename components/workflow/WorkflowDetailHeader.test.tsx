import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowDetailHeader from '@/components/workflow/WorkflowDetailHeader';

vi.mock('@/components/workflow/WorkflowDeleteAction', () => ({
  default: () => null,
}));

function renderHeader({ hasUnsavedChanges = true }: { hasUnsavedChanges?: boolean } = {}) {
  const onCancelEditing = vi.fn();
  render(
    <WorkflowDetailHeader
      workflowId="workflow-1"
      workflowName="Review workflow"
      workflowDescription="A workflow under review."
      isEditing
      hasUnsavedChanges={hasUnsavedChanges}
      isExecuting={false}
      onRefresh={vi.fn()}
      onStartEditing={vi.fn()}
      onCancelEditing={onCancelEditing}
      onExecute={vi.fn()}
      onExportWorkflow={vi.fn()}
    />
  );
  return { onCancelEditing };
}

describe('WorkflowDetailHeader', () => {
  it('uses the accessible confirmation dialog before discarding an editor draft', () => {
    const { onCancelEditing } = renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Edit' }));
    expect(onCancelEditing).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Discard unsaved workflow changes?' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onCancelEditing).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onCancelEditing).toHaveBeenCalledOnce();
  });

  it('closes edit mode immediately when the draft is clean', () => {
    const { onCancelEditing } = renderHeader({ hasUnsavedChanges: false });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Edit' }));
    expect(onCancelEditing).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('heading', { name: 'Discard unsaved workflow changes?' })
    ).not.toBeInTheDocument();
  });
});
