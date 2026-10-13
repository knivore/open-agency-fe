import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {ApprovalCard} from './MainAgentMonitorWorkspace';
import type {ApprovalRequest} from '@/types/conversations';

const approval = {
  id: 'review-1',
  summary: 'Review the proposed workflow change.',
  diff_summary: 'Changes remain subject to approval.',
  status: 'pending',
  approval_type: 'workflow_update',
  created_at: '2026-10-13T01:00:00Z',
  metadata: {},
  proposed_payload: {},
} as ApprovalRequest;

describe('monitor approval review', () => {
  it('requires opening the request and an explicit decision before invoking the existing action', () => {
    const onDecision = vi.fn();
    render(<ApprovalCard approval={approval} isMutating={false} onDecision={onDecision}/>);
    expect(screen.getByRole('button', {name: 'Approve'})).not.toBeVisible();
    fireEvent.click(screen.getByText('Review request'));
    expect(screen.getByText('Changes remain subject to approval.')).toBeVisible();
    expect(onDecision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}));
    expect(onDecision).toHaveBeenCalledExactlyOnceWith('review-1', 'approve');
  });
  it('keeps reject explicit and disables decisions while a request is in progress', () => {
    const onDecision = vi.fn();
    const view = render(
      <ApprovalCard approval={approval} isMutating={false} onDecision={onDecision}/>
    );
    fireEvent.click(screen.getByText('Review request'));
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}));
    expect(onDecision).toHaveBeenCalledExactlyOnceWith('review-1', 'reject');
    view.rerender(<ApprovalCard approval={approval} isMutating onDecision={onDecision}/>);
    expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Reject'})).toBeDisabled();
  });
});
