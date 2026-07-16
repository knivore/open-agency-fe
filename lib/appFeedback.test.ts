import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appFeedback } from '@/lib/appFeedback';

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('sonner', () => ({ toast }));

describe('appFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses a consistent position and exposes an optional recovery action', () => {
    const retry = vi.fn();

    appFeedback.error('Unable to save.', {
      description: 'Check the connection and try again.',
      action: { label: 'Retry', onClick: retry },
    });

    expect(toast.error).toHaveBeenCalledWith('Unable to save.', {
      position: 'top-right',
      description: 'Check the connection and try again.',
      duration: 8000,
      action: { label: 'Retry', onClick: retry },
    });
  });
});
