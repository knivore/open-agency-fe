import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiffViewer from '@/components/tools/DiffViewer';
import PolicyVerdictPanel from '@/components/tools/PolicyVerdictPanel';
import ToolContractList from '@/components/tools/ToolContractList';
import ToolContractViewer from '@/components/tools/ToolContractViewer';
import ToolInputForm from '@/components/tools/ToolInputForm';
import ToolRunResult from '@/components/tools/ToolRunResult';
import type { ToolContract, ToolRunResponse } from '@/types/toolContracts';

const sandboxContract: ToolContract = {
  '@context': 'https://agency.local/tool-contracts/v1',
  '@type': 'ToolContract',
  name: 'sandbox-edit',
  version: '1.0',
  description: 'Safely propose code changes.',
  inputs: {
    type: 'object',
    required: ['repo', 'ref'],
    properties: {
      repo: { type: 'string', description: 'Allowed local repository path.' },
      ref: { type: 'string', description: 'Base git ref.' },
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
  verdict: 'warn',
  policyVerdict: {
    score: 25,
    rules: [{ id: 'no-secrets', outcome: 'warn', reason: 'possible generic secret/token text' }],
  },
  patch: 'diff --git a/README.md b/README.md\n+hello\n',
  filesChanged: [{ path: 'README.md', op: 'modify' }],
  errors: [],
  dryRun: true,
  timestamp: '2026-05-10T00:00:00Z',
  signature: 'sha256:test',
};

describe('tool contract components', () => {
  it('renders contract list and selected contract metadata', () => {
    const onSelect = vi.fn();

    render(<ToolContractList contracts={[sandboxContract]} selectedName="sandbox-edit" onSelect={onSelect} />);

    expect(screen.getByText('sandbox-edit')).toBeInTheDocument();
    expect(screen.getByText('Safely propose code changes.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sandbox-edit/i }));
    expect(onSelect).toHaveBeenCalledWith('sandbox-edit');
  });

  it('renders contract input and output schema details', () => {
    render(<ToolContractViewer contract={sandboxContract} />);

    expect(screen.getByText('Input schema')).toBeInTheDocument();
    expect(screen.getByText('Allowed local repository path.')).toBeInTheDocument();
    expect(screen.getByText('Output schema')).toBeInTheDocument();
    expect(screen.getByText(/"name": "sandbox-edit"/)).toBeInTheDocument();
  });

  it('builds sandbox-edit payloads from the form', async () => {
    const onRun = vi.fn().mockResolvedValue(undefined);

    render(<ToolInputForm contract={sandboxContract} isPending={false} onRun={onRun} />);

    fireEvent.change(screen.getByLabelText('Repository'), {
      target: { value: '/Users/kehchinleong/Documents/Personal/Agency/agency-fe' },
    });
    fireEvent.change(screen.getByLabelText('Path'), { target: { value: 'src/config.ts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run dry-run' }));

    await waitFor(() => {
      expect(onRun).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: '/Users/kehchinleong/Documents/Personal/Agency/agency-fe',
          dryRun: true,
          changes: [expect.objectContaining({ path: 'src/config.ts' })],
        }),
      );
    });
  });

  it('renders policy verdict, diff, and run result panels', () => {
    render(
      <>
        <PolicyVerdictPanel verdict={runResult.policyVerdict} />
        <DiffViewer patch={runResult.patch} />
        <ToolRunResult result={runResult} />
      </>,
    );

    expect(screen.getAllByText('no-secrets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('warn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+hello').length).toBeGreaterThan(0);
    expect(screen.getByText('modify: README.md')).toBeInTheDocument();
    expect(screen.getByText(/sha256:test/)).toBeInTheDocument();
  });
});
