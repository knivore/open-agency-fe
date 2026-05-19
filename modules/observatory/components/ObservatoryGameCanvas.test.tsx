import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ObservatoryGameCanvas from '@/modules/observatory/components/ObservatoryGameCanvas';
import { createObservatoryGame } from '@/modules/observatory/engine/OfficeGame';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

vi.mock('@/modules/observatory/engine/OfficeGame', () => ({
  createObservatoryGame: vi.fn(),
}));

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

describe('ObservatoryGameCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('updates canvas selection without rebuilding the Phaser scene', async () => {
    const gameHandle = {
      destroy: vi.fn(),
      game: {},
      getSelectionOverlayState: vi.fn(),
      resize: vi.fn(),
      update: vi.fn(),
      updateSelection: vi.fn(),
    };
    vi.mocked(createObservatoryGame).mockResolvedValue(gameHandle as never);

    const { rerender } = render(
      <ObservatoryGameCanvas
        layout={sampleLayout as ObservatoryLayoutDocument}
        selectedAgentId={null}
        selectedObjectId={null}
      />
    );

    await waitFor(() => expect(createObservatoryGame).toHaveBeenCalledTimes(1));

    rerender(
      <ObservatoryGameCanvas
        layout={sampleLayout as ObservatoryLayoutDocument}
        selectedAgentId="agent:atlas"
        selectedObjectId={null}
      />
    );

    await waitFor(() =>
      expect(gameHandle.updateSelection).toHaveBeenLastCalledWith({
        selectedAgentId: 'agent:atlas',
        selectedObjectId: null,
      })
    );
    expect(gameHandle.update).not.toHaveBeenCalled();

    rerender(
      <ObservatoryGameCanvas
        layout={sampleLayout as ObservatoryLayoutDocument}
        selectedAgentId={null}
        selectedObjectId="object:desk"
      />
    );

    await waitFor(() =>
      expect(gameHandle.updateSelection).toHaveBeenLastCalledWith({
        selectedAgentId: null,
        selectedObjectId: 'object:desk',
      })
    );
    expect(gameHandle.update).not.toHaveBeenCalled();

    rerender(
      <ObservatoryGameCanvas
        layout={sampleLayout as ObservatoryLayoutDocument}
        selectedAgentId={null}
        selectedObjectId={null}
      />
    );

    await waitFor(() =>
      expect(gameHandle.updateSelection).toHaveBeenLastCalledWith({
        selectedAgentId: null,
        selectedObjectId: null,
      })
    );
    expect(gameHandle.update).not.toHaveBeenCalled();
  });
});
