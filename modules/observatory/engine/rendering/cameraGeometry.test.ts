import { describe, expect, it } from 'vitest';
import { clampObservatoryCameraScroll, observatoryCameraViewOrigin } from './cameraGeometry';

describe('Phaser camera and DOM placement alignment', () => {
  it.each([0.5, 1, 2])('keeps the visible floor origin aligned at %sx zoom', (zoom) => {
    const camera = { width: 800, height: 600, scrollX: -1000, scrollY: -1000, zoom };
    const scroll = clampObservatoryCameraScroll(camera, { x: 0, y: 0, width: 2000, height: 1800 });
    expect(
      observatoryCameraViewOrigin({ ...camera, scrollX: scroll.x, scrollY: scroll.y })
    ).toEqual({ x: 0, y: 0 });
  });
  it('keeps the right and bottom edges visible when zooming and restoring a camera', () => {
    const camera = { width: 800, height: 600, scrollX: 10000, scrollY: 10000, zoom: 2 };
    const scroll = clampObservatoryCameraScroll(camera, {
      x: -20,
      y: -30,
      width: 1240,
      height: 960,
    });
    const origin = observatoryCameraViewOrigin({ ...camera, scrollX: scroll.x, scrollY: scroll.y });
    expect(origin.x + camera.width / camera.zoom).toBe(1220);
    expect(origin.y + camera.height / camera.zoom).toBe(930);
  });
});
