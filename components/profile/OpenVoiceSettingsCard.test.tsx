import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OpenVoiceSettingsCard from '@/components/profile/OpenVoiceSettingsCard';

const { profileApi } = vi.hoisted(() => ({
  profileApi: {
    getOpenVoiceStatus: vi.fn(),
    updateOpenVoiceSettings: vi.fn(),
    installOpenVoiceCheckpoints: vi.fn(),
    testOpenVoice: vi.fn(),
  },
}));

vi.mock('@/lib/api/backend/profile', () => ({ profileApi }));

const readyStatus = {
  optional: true as const,
  ready: true,
  supports_cloning: true,
  runtime: { installed: true, root: '/opt/openvoice', revision: '74a1d147b17a8c3' },
  checkpoints: { directory: '/data/checkpoints', installed: true, missing_files: [] },
  settings: { default_voice: 'friendly', language: 'English' as const },
  available_voices: ['friendly', 'cheerful'],
};

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OpenVoiceSettingsCard />
    </QueryClientProvider>
  );
}

describe('OpenVoiceSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileApi.getOpenVoiceStatus.mockResolvedValue(readyStatus);
    profileApi.updateOpenVoiceSettings.mockImplementation(async (voice: string) => ({
      ...readyStatus,
      settings: { ...readyStatus.settings, default_voice: voice },
    }));
  });

  it('shows optional readiness and the configured voice', async () => {
    renderCard();

    expect(await screen.findByText('OpenVoice')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Open Agency-wide')).toBeInTheDocument();
    expect(screen.getByText('Open Agency default built-in voice')).toBeInTheDocument();
    expect(screen.getByText('Friendly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate test sample' })).toBeEnabled();
  });

  it('shows neutral checking copy while runtime status loads', () => {
    profileApi.getOpenVoiceStatus.mockReturnValue(new Promise(() => undefined));

    renderCard();

    expect(screen.getByText('Checking runtime')).toBeInTheDocument();
    expect(screen.getByText('Checking model files')).toBeInTheDocument();
    expect(screen.getByText(/Voice cloning: checking/i)).toBeInTheDocument();
    expect(screen.queryByText('Backend rebuild required')).not.toBeInTheDocument();
  });

  it('verifies the optional model files', async () => {
    profileApi.installOpenVoiceCheckpoints.mockResolvedValue(readyStatus);
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'Verify / repair files' }));

    await waitFor(() => {
      expect(profileApi.installOpenVoiceCheckpoints).toHaveBeenCalledWith(false);
    });
  });
});
