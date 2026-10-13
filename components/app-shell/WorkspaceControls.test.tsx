import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceToolbar from './WorkspaceToolbar';
import WorkspaceMetrics from './WorkspaceMetrics';
import InlineEditActions from './InlineEditActions';
import { useDraftDiscardGuard } from '@/hooks/useUnsavedChangesGuard';

describe('shared workspace controls', () => {
  it('delegates filtering and reset without changing a controlled value', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const view = render(
      <WorkspaceToolbar
        search={{ label: 'Find records', value: 'saved', onChange }}
        onReset={onReset}
        summary="3 records"
      />
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'draft' } });
    expect(onChange).toHaveBeenCalledWith('draft');
    expect(screen.getByRole('searchbox')).toHaveValue('saved');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onReset).toHaveBeenCalledOnce();
    view.rerender(
      <WorkspaceToolbar search={{ label: 'Find records', value: 'saved', onChange }} disabled />
    );
    expect(screen.getByRole('searchbox')).toBeDisabled();
  });

  it('makes status summaries optional filter controls and locks edit actions while saving', () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(
      <>
        <WorkspaceMetrics
          items={[
            { label: 'Waiting', value: 2, selected: true, onSelect },
            { label: 'Total', value: 8 },
          ]}
        />
        <InlineEditActions editing busy onEdit={vi.fn()} onSave={vi.fn()} onCancel={onCancel} />
      </>
    );
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Filter: Waiting' }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Filter: Waiting' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('requires an explicit discard decision and blocks competing navigation while busy', () => {
    const onDiscard = vi.fn();
    const onNavigate = vi.fn();
    const leave = vi.fn();
    const { result, rerender } = renderHook(
      ({ busy }) => useDraftDiscardGuard({ dirty: true, busy, onDiscard, onNavigate }),
      { initialProps: { busy: false } }
    );
    act(() => result.current.requestLeave(leave));
    expect(result.current.open).toBe(true);
    expect(leave).not.toHaveBeenCalled();
    act(() => result.current.onOpenChange(false));
    expect(onDiscard).not.toHaveBeenCalled();
    act(() => result.current.requestLeave(leave));
    act(() => result.current.onConfirm());
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(leave).toHaveBeenCalledOnce();
    rerender({ busy: true });
    act(() => result.current.requestLeave(leave));
    expect(leave).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
  });
});
