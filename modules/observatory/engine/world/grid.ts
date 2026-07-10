export const OBSERVATORY_DEFAULT_TILE_SIZE = 32;

export interface ObservatoryGridPoint {
  x: number;
  y: number;
}

export interface ObservatoryWorldPoint {
  x: number;
  y: number;
}

export interface ObservatoryGridSize {
  width: number;
  height: number;
}

export interface ObservatoryGridRect extends ObservatoryGridPoint, ObservatoryGridSize {}

export interface ObservatoryGridConfig {
  tileSize: number;
}

export function gridToWorld(
  point: ObservatoryGridPoint,
  grid: ObservatoryGridConfig
): ObservatoryWorldPoint {
  return {
    x: point.x * grid.tileSize,
    y: point.y * grid.tileSize,
  };
}

export function gridToWorldCenter(
  point: ObservatoryGridPoint,
  grid: ObservatoryGridConfig
): ObservatoryWorldPoint {
  return {
    x: point.x * grid.tileSize + grid.tileSize / 2,
    y: point.y * grid.tileSize + grid.tileSize / 2,
  };
}

export function worldToGrid(
  point: ObservatoryWorldPoint,
  grid: ObservatoryGridConfig
): ObservatoryGridPoint {
  return {
    x: Math.floor(point.x / grid.tileSize),
    y: Math.floor(point.y / grid.tileSize),
  };
}

export function gridRectToWorldRect(
  rect: ObservatoryGridRect,
  grid: ObservatoryGridConfig
): ObservatoryGridRect {
  return {
    x: rect.x * grid.tileSize,
    y: rect.y * grid.tileSize,
    width: rect.width * grid.tileSize,
    height: rect.height * grid.tileSize,
  };
}

export function pointInGridRect(point: ObservatoryGridPoint, rect: ObservatoryGridRect): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}
