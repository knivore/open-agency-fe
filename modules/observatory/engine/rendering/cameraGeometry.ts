interface CameraGeometry {
  width: number;
  height: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
}

// Phaser scroll is measured before its center-origin zoom transform. DOM
// previews need the actual top-left world coordinate, not the raw scroll.
export function observatoryCameraViewOrigin(camera: CameraGeometry) {
  return {
    x: camera.scrollX + (camera.width - camera.width / camera.zoom) / 2,
    y: camera.scrollY + (camera.height - camera.height / camera.zoom) / 2,
  };
}

export function clampObservatoryCameraScroll(
  camera: CameraGeometry,
  bounds: { x: number; y: number; width: number; height: number }
) {
  const visibleWidth = camera.width / camera.zoom;
  const visibleHeight = camera.height / camera.zoom;
  const minX = bounds.x + (visibleWidth - camera.width) / 2;
  const minY = bounds.y + (visibleHeight - camera.height) / 2;
  return {
    x: Math.min(Math.max(camera.scrollX, minX), Math.max(minX, minX + bounds.width - visibleWidth)),
    y: Math.min(
      Math.max(camera.scrollY, minY),
      Math.max(minY, minY + bounds.height - visibleHeight)
    ),
  };
}
