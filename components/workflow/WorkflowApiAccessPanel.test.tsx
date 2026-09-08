import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowApiAccessPanel from '@/components/workflow/WorkflowApiAccessPanel';

describe('WorkflowApiAccessPanel', () => {
  it('provides a workflow-specific API example and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<WorkflowApiAccessPanel workflowId="weekly briefing" />);

    expect(screen.getByText('Trigger via API')).toBeInTheDocument();
    expect(screen.getByText(/workflows:run/)).toBeInTheDocument();
    expect(screen.getByText(/executions:read/)).toBeInTheDocument();
    expect(screen.getAllByText(/weekly%20briefing/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Copy JavaScript' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('/workflows/weekly%20briefing/executions')
    );
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
