import type { ObservatoryRoomWallSide } from '@/modules/observatory/engine/world/layoutTypes';

export type ObservatoryCanvasSelectionKind = 'agent' | 'object' | 'room';

export interface ObservatoryCanvasSelection {
  id: string;
  kind: ObservatoryCanvasSelectionKind;
  label: string;
}

export interface ObservatoryCanvasGridClick {
  wallSide?: ObservatoryRoomWallSide;
  x: number;
  y: number;
}

export interface ObservatoryCanvasOverlayState {
  anchorX: number;
  anchorY: number;
  kind: 'object' | 'room';
  label: string;
  placement: 'above' | 'below';
}
