import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowVersionHistory } from './WorkflowGovernancePanel';

const api = vi.hoisted(() => ({ listWorkflowVersions: vi.fn() }));
vi.mock('@/lib/api/backend/workflows', () => ({ workflowsApi: api }));

describe('saved workflow revisions', () => {
  it('loads on expansion and inspects history without replacing or saving a definition', async () => {
    api.listWorkflowVersions.mockResolvedValue({
      items: [
        {
          workflow_id: 'workflow-1',
          revision: 3,
          version: '1.2.0',
          is_current: true,
          definition: { name: 'Saved research workflow', description: 'Reviewed definition' },
        },
      ],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <WorkflowVersionHistory workflowId="workflow-1" />
      </QueryClientProvider>
    );
    expect(api.listWorkflowVersions).not.toHaveBeenCalled();
    const disclosure = screen.getByText('Saved revisions').closest('details')!;
    disclosure.open = true;
    fireEvent(disclosure, new Event('toggle'));
    await waitFor(() => expect(api.listWorkflowVersions).toHaveBeenCalledWith('workflow-1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect revision 3' }));
    expect(
      screen.getByRole('heading', { name: 'Revision 3: Saved research workflow' })
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /restore|publish|save changes/i })
    ).not.toBeInTheDocument();
  });
});
