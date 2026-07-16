import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  renderWorkspace,
  setupIntegrationsWorkspaceTest,
} from './IntegrationsWorkspace.test-utils';

describe('IntegrationsWorkspace LLM models', () => {
  setupIntegrationsWorkspaceTest();

  it('groups LLM model presets under their provider connection', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    expect(screen.getByText('Primary Profile')).toBeInTheDocument();
    expect(screen.getByText('gpt-4.1')).toBeInTheDocument();
    expect(screen.getByText('https://api.openai.com/v1')).toBeInTheDocument();
    expect(screen.getByText('1 preset')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage models/i })).toHaveAttribute('href', '/models');
    expect(screen.queryByRole('button', { name: /Save Config/i })).not.toBeInTheDocument();
  });
});
