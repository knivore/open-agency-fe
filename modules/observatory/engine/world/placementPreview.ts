import type { OfficePresetId, OfficePresetStyle } from './officeAssemblies';
export type ObservatoryPlacementRequest = { kind: 'asset'; assetId: string; label: string } | { kind: 'preset'; presetId: OfficePresetId; style: OfficePresetStyle; label: string };
