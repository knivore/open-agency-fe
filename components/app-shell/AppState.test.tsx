import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppState, { AppInlineState } from '@/components/app-shell/AppState';

describe('AppState', () => {
  it('announces loading states without presenting a retry action', () => {
    render(<AppState variant="loading" title="Loading runs" description="Reading the backend." />);

    expect(screen.getByRole('status')).toHaveAttribute('data-app-state', 'loading');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('announces errors and retries through the supplied action', () => {
    const onRetry = vi.fn();
    render(
      <AppState
        variant="error"
        title="Runs unavailable"
        description="The backend request failed."
        onAction={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('supports permission and partial-failure states with explicit guidance', () => {
    const { rerender } = render(
      <AppState
        variant="permission"
        title="Permission required"
        description="Grant access before continuing."
      />
    );
    expect(screen.getByText('Permission required')).toBeInTheDocument();

    rerender(
      <AppState
        variant="partial"
        title="Some data is unavailable"
        description="Healthy sections remain usable."
      />
    );
    expect(screen.getByText('Some data is unavailable')).toBeInTheDocument();
  });

  it('provides a compact reusable state for lists and embedded panels', () => {
    const onRetry = vi.fn();
    render(
      <AppInlineState
        variant="error"
        title="Documents unavailable"
        description="The list could not be loaded."
        onAction={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveAttribute('data-app-inline-state', 'error');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
