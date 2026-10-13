import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ObservatoryRuntimeSurface from './ObservatoryRuntimeSurface';
import publishedLayout from '../layouts/publishedLayout.json';
import {
  OBSERVATORY_AGENT_VISUAL_STATE_EVENT,
  type ObservatoryAgentVisualStateEventDetail,
} from '../engine/rendering/agentVisualState';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('../components/ObservatoryGameCanvas', () => ({ default: () => null }));

describe('Observatory builder background activity', () => {
  const frames: ObservatoryAgentVisualStateEventDetail[] = [];
  const recordFrame = (event: Event) => {
    frames.push((event as CustomEvent<ObservatoryAgentVisualStateEventDetail>).detail);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    frames.length = 0;
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ layout: publishedLayout }),
      })
    );
    window.addEventListener(OBSERVATORY_AGENT_VISUAL_STATE_EVENT, recordFrame);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener(OBSERVATORY_AGENT_VISUAL_STATE_EVENT, recordFrame);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts roaming on load without sample events claiming idle agents', async () => {
    await act(async () => {
      render(<ObservatoryRuntimeSurface mode="builder" />);
    });
    for (let tick = 0; tick < 20; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_600);
      });
    }

    const movingAgents = new Set(
      frames.flatMap((frame) =>
        frame.agents
          .filter((agent) => agent.movementKey?.startsWith('ambient'))
          .map((agent) => agent.agentId)
      )
    );
    expect(movingAgents).toEqual(new Set(['agent:atlas', 'agent:byte', 'agent:clio']));
    const roomIds = new Set(publishedLayout.world.maps[0].rooms.map((room) => room.id));
    expect(
      frames
        .flatMap((frame) => frame.agents)
        .every((agent) => !agent.targetRoomId || roomIds.has(agent.targetRoomId))
    ).toBe(true);
  });

  it('pauses new activity and resumes it without editing the layout', async () => {
    await act(async () => {
      render(<ObservatoryRuntimeSurface mode="builder" />);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pause roaming' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    const pausedFrames = frames.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_400);
    });
    expect(frames).toHaveLength(pausedFrames);

    fireEvent.click(screen.getByRole('button', { name: 'Resume roaming' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    const resumedFrames = frames.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(frames.length).toBeGreaterThan(resumedFrames);
  });
});
