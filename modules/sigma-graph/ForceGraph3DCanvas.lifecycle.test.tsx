import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ForceGraph3DCanvas from './ForceGraph3DCanvas';
import type { SigmaGraphDocument } from './types';

const graphHarness = vi.hoisted(() => ({
  cameraPosition: vi.fn(),
  initialized: false,
  pauseAnimation: vi.fn(),
  pausedAfterCleanup: false,
  resumedBeforeInitialization: false,
  resumeAnimation: vi.fn(),
}));

vi.mock('next/dynamic', async () => {
  const React = await import('react');
  const controls = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    target: { set: vi.fn() },
    update: vi.fn(),
  };
  const scene = {
    add: vi.fn(),
    fog: null,
    remove: vi.fn(),
    traverse: vi.fn(),
  };
  const methods = {
    camera: () => ({ position: { x: 0, y: 0, z: 260 } }),
    cameraPosition: graphHarness.cameraPosition,
    controls: () => controls,
    d3Force: (name: string) => {
      if (name === 'charge') {
        return { distanceMax: vi.fn(), strength: vi.fn() };
      }
      if (name === 'link') {
        return { distance: vi.fn(), strength: vi.fn() };
      }
      return undefined;
    },
    d3ReheatSimulation: vi.fn(),
    lights: vi.fn(),
    pauseAnimation: () => {
      if (!graphHarness.initialized) {
        graphHarness.pausedAfterCleanup = true;
        throw new TypeError("Cannot read properties of undefined (reading 'bindFramebuffer')");
      }
      graphHarness.pauseAnimation();
    },
    refresh: vi.fn(),
    resumeAnimation: () => {
      if (!graphHarness.initialized) {
        graphHarness.resumedBeforeInitialization = true;
        throw new TypeError("Cannot read properties of undefined (reading 'tick')");
      }
      graphHarness.resumeAnimation();
    },
    scene: () => scene,
  };

  const MockForceGraph = React.forwardRef<typeof methods, Record<string, unknown>>(
    function MockForceGraph(_props, ref) {
      React.useImperativeHandle(ref, () => methods, []);
      React.useLayoutEffect(() => {
        graphHarness.initialized = true;
        return () => {
          graphHarness.initialized = false;
        };
      }, []);

      return React.createElement('div', { 'data-testid': 'force-graph-3d-mock' });
    }
  );

  return {
    default: () => MockForceGraph,
  };
});

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

const selectedDocument: SigmaGraphDocument = {
  schemaVersion: 'sigma.graph.document.v1',
  id: 'selected-graph',
  title: 'Selected graph',
  metadata: {},
  nodes: [
    {
      id: 'memory-1',
      type: 'Memory',
      label: 'Selected memory',
      size: 12,
      data: { id: 'memory-1' },
    },
  ],
  edges: [],
};

describe('ForceGraph3DCanvas lifecycle', () => {
  beforeEach(() => {
    graphHarness.initialized = false;
    graphHarness.pausedAfterCleanup = false;
    graphHarness.resumedBeforeInitialization = false;
    graphHarness.cameraPosition.mockClear();
    graphHarness.pauseAnimation.mockClear();
    graphHarness.resumeAnimation.mockClear();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reuses one initialized renderer across repeated visibility toggles', async () => {
    let unmount = () => {};
    let rerender: ReturnType<typeof render>['rerender'] = () => {};
    expect(() => {
      const rendered = render(
        <ForceGraph3DCanvas
          active
          document={selectedDocument}
          selection={{ nodeIds: ['memory-1'], edgeIds: [] }}
        />
      );
      unmount = rendered.unmount;
      rerender = rendered.rerender;
    }).not.toThrow();

    await waitFor(() => {
      expect(graphHarness.cameraPosition).toHaveBeenCalled();
      expect(graphHarness.resumeAnimation).toHaveBeenCalledTimes(1);
    });
    expect(graphHarness.resumedBeforeInitialization).toBe(false);

    rerender(
      <ForceGraph3DCanvas
        active={false}
        document={selectedDocument}
        selection={{ nodeIds: ['memory-1'], edgeIds: [] }}
      />
    );
    await waitFor(() => {
      expect(graphHarness.pauseAnimation).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ForceGraph3DCanvas
        active
        document={selectedDocument}
        selection={{ nodeIds: ['memory-1'], edgeIds: [] }}
      />
    );
    await waitFor(() => {
      expect(graphHarness.resumeAnimation).toHaveBeenCalledTimes(2);
    });

    rerender(
      <ForceGraph3DCanvas
        active={false}
        document={selectedDocument}
        selection={{ nodeIds: ['memory-1'], edgeIds: [] }}
      />
    );
    await waitFor(() => {
      expect(graphHarness.pauseAnimation).toHaveBeenCalledTimes(2);
    });

    rerender(
      <ForceGraph3DCanvas
        active
        document={selectedDocument}
        selection={{ nodeIds: ['memory-1'], edgeIds: [] }}
      />
    );
    await waitFor(() => {
      expect(graphHarness.resumeAnimation).toHaveBeenCalledTimes(3);
    });

    expect(() => unmount()).not.toThrow();
    expect(graphHarness.pauseAnimation).toHaveBeenCalledTimes(3);
    expect(graphHarness.pausedAfterCleanup).toBe(false);
  });
});
