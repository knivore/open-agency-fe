import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppToaster from '@/components/app-shell/AppToaster';

const { toasterProps } = vi.hoisted(() => ({
  toasterProps: vi.fn(),
}));

vi.mock('@/app/providers', () => ({
  useAgencyTheme: () => ({ theme: 'dark' }),
}));

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => {
    toasterProps(props);
    return <div data-testid="agency-toaster" />;
  },
}));

describe('AppToaster', () => {
  it('follows the Open Agency theme and exposes consistent accessible defaults', () => {
    render(<AppToaster />);

    expect(screen.getByTestId('agency-toaster')).toBeInTheDocument();
    expect(toasterProps).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'dark',
        position: 'top-right',
        closeButton: true,
        containerAriaLabel: 'Open Agency notifications',
        visibleToasts: 4,
      })
    );
  });
});
