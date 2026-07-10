import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SmartHomeSetupPage from '@/modules/smart-home/app/SmartHomeSetupPage';

const getIntegrationModuleAvailability = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/moduleAvailability', () => ({
  getIntegrationModuleAvailability,
}));

describe('SmartHomeSetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the page readable but disables setup actions when Smart Home is unavailable', async () => {
    getIntegrationModuleAvailability.mockResolvedValue({
      smartHomeAvailable: false,
      smartHomeReason: 'Smart Home module package is not installed.',
    });

    render(await SmartHomeSetupPage());

    expect(screen.getByText('Set up Smart Home')).toBeInTheDocument();
    expect(screen.getByText('Smart Home is not enabled on this backend.')).toBeInTheDocument();
    expect(screen.getByText('Smart Home module package is not installed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Setup unavailable/i })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /Start setup/i })).not.toBeInTheDocument();
  });

  it('keeps setup links active when Smart Home is available', async () => {
    getIntegrationModuleAvailability.mockResolvedValue({
      smartHomeAvailable: true,
    });

    render(await SmartHomeSetupPage());

    expect(screen.getByRole('link', { name: /Start setup/i })).toBeInTheDocument();
    expect(
      screen.queryByText('Smart Home is not enabled on this backend.')
    ).not.toBeInTheDocument();
  });
});
