import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import type { ObservatoryObject, ObservatoryObjectRenderOptions } from './layoutTypes';

export function observatoryAssetSourceSize(asset?: ObservatoryAssetDefinition) {
  return {
    width: asset?.width ?? asset?.source.frameWidth ?? 48,
    height: asset?.height ?? asset?.source.frameHeight ?? 48,
  };
}

export function observatoryAssetPlacement(asset: ObservatoryAssetDefinition, tileSize = 48) {
  const source = observatoryAssetSourceSize(asset);
  const crop = asset.source.kind === 'image' ? (asset.sourceCrop ?? asset.previewCrop) : undefined;
  const visible = crop ?? source;
  const text = `${asset.label} ${asset.semanticId ?? ''} ${(asset.tags ?? []).join(' ')}`;
  const floorFurniture =
    /desk.front|service.counter|service.desk|workbench|cabinet|server.rack|water.cooler|chair|table|partition/i.test(
      text
    );
  const surfaceDetail =
    !floorFurniture &&
    /lamp|keyboard|mouse|handset|phone|paper|bottle|laptop|monitor|screen|whiteboard|poster|chart|circuit/i.test(
      text
    );
  // Alpha padding is an export detail, not floor space. Keep the image at its
  // native aspect ratio and cancel its padding when anchoring to the grid.
  const render: ObservatoryObjectRenderOptions = {
    sizePx: source,
    ...(crop ? { sourceCrop: crop, offsetPx: { x: -crop.x, y: -crop.y } } : {}),
    depth: surfaceDetail ? 26 : 18,
  };
  if (asset?.tags?.includes('pantry-fixture')) {
    // Tall cabinet faces rise above their floor cell. Reserving their full image
    // height as floor depth closes the serving aisle when dropped from the palette.
    return {
      blocksMovement: true,
      size: { width: asset.collision?.width ?? 1, height: asset.collision?.height ?? 1 },
      render: { ...render, offsetPx: { x: 0, y: tileSize - source.height } },
    };
  }
  return {
    blocksMovement: !surfaceDetail,
    size: {
      width: Math.max(1, Math.ceil(visible.width / tileSize)),
      height: Math.max(1, Math.ceil(visible.height / tileSize)),
    },
    render,
  };
}

export function scaleObservatoryObject(
  object: ObservatoryObject,
  asset: ObservatoryAssetDefinition | undefined,
  scale: number,
  tileSize = 48
) {
  const source = observatoryAssetSourceSize(asset);
  const crop = object.render?.sourceCrop;
  const oldWidth = object.render?.sizePx?.width ?? source.width;
  const oldHeight = object.render?.sizePx?.height ?? source.height;
  const offset = object.render?.offsetPx ?? { x: 0, y: 0 };
  const visible = crop ?? source;
  return {
    size: {
      width: Math.max(1, Math.ceil((visible.width * scale) / tileSize)),
      height: Math.max(1, Math.ceil((visible.height * scale) / tileSize)),
    },
    render: {
      ...object.render,
      sizePx: { width: source.width * scale, height: source.height * scale },
      // Scaling a padded crop must not move its visible top-left corner.
      offsetPx: crop
        ? {
            x: offset.x + (crop.x * oldWidth) / source.width - crop.x * scale,
            y: offset.y + (crop.y * oldHeight) / source.height - crop.y * scale,
          }
        : offset,
    },
  };
}

export function observatoryObjectVisibleBounds(
  object: ObservatoryObject,
  asset: ObservatoryAssetDefinition | undefined,
  tileSize = 48
) {
  const source = observatoryAssetSourceSize(asset);
  const size = object.render?.sizePx ?? source;
  const crop = object.render?.sourceCrop;
  const sx = size.width / source.width,
    sy = size.height / source.height;
  return {
    x: object.position.x * tileSize + (object.render?.offsetPx?.x ?? 0) + (crop?.x ?? 0) * sx,
    y: object.position.y * tileSize + (object.render?.offsetPx?.y ?? 0) + (crop?.y ?? 0) * sy,
    width: (crop?.width ?? source.width) * sx,
    height: (crop?.height ?? source.height) * sy,
  };
}
