import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ToolContractsWorkspace from '@/components/tools/ToolContractsWorkspace';
import type { ToolContract, ToolRunResponse } from '@/types/toolContracts';

const toolsApi = vi.hoisted(() => ({
  listToolContracts: vi.fn(),
  getToolContract: vi.fn(),
  runTool: vi.fn(),
}));

vi.mock('@/lib/api/backend', () => ({
  toolsApi,
}));

const sandboxContract: ToolContract = {
  name: 'sandbox-edit',
  version: '1.0',
  description: 'Safely propose code changes.',
  inputs: {
    type: 'object',
    required: ['repo', 'ref'],
    properties: {
      repo: { type: 'string', description: 'Allowed local repository path.' },
      ref: { type: 'string', description: 'Base git ref.' },
      changes: { type: 'array', description: 'Unified diffs.' },
      dryRun: { type: 'boolean', description: 'Preview only.' },
    },
  },
  outputs: {
    type: 'object',
    properties: {
      verdict: { type: 'string' },
      patch: { type: ['string', 'null'] },
    },
  },
};

const runResult: ToolRunResponse = {
  verdict: 'ok',
  policyVerdict: {
    score: 0,
    rules: [{ id: 'repo-allowlist', outcome: 'ok', reason: 'repo is allowlisted' }],
  },
  patch: 'diff --git a/README.md b/README.md\n+hello\n',
  filesChanged: [{ path: 'README.md', op: 'modify' }],
  errors: [],
  dryRun: true,
  timestamp: '2026-05-10T00:00:00Z',
  signature: 'sha256:workspace',
};

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToolContractsWorkspace />
    </QueryClientProvider>,
  );
}

describe('ToolContractsWorkspace', () => {
  it('loads contracts and runs selected tool through backend API client', async () => {
    toolsApi.listToolContracts.mockResolvedValue({ items: [sandboxContract] });
    toolsApi.getToolContract.mockResolvedValue(sandboxContract);
    toolsApi.runTool.mockResolvedValue(runResult);

    renderWorkspace();

    expect(await screen.findByText('sandbox-edit')).toBeInTheDocument();
    expect(await screen.findByText('Input schema')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run dry-run' }));

    await waitFor(() => {
      expect(toolsApi.runTool).toHaveBeenCalledWith(
        'sandbox-edit',
        expect.objectContaining({
          dryRun: true,
          changes: [expect.objectContaining({ path: 'README.md' })],
        }),
      );
    });
    expect(await screen.findByText(/sha256:workspace/)).toBeInTheDocument();
    expect(screen.getByText('repo-allowlist')).toBeInTheDocument();
  });
});
