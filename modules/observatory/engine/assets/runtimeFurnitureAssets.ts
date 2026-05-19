import type { StaticImageData } from 'next/image';

import type { ObservatoryAssetDefinition } from '@/modules/observatory/engine/assets/assetRegistry';
import runtimeFurniture0 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/blue-wall-monitor-right.png';
import runtimeFurniture1 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/compact-gray-laptop.png';
import runtimeFurniture2 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/dual-monitor-workstation-wide.png';
import runtimeFurniture3 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/dual-screen-console-desk.png';
import runtimeFurniture4 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/low-storage-cabinet-wide-gray.png';
import runtimeFurniture5 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-desk-phone-handset.png';
import runtimeFurniture6 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-runtime-server-tower.png';
import runtimeFurniture7 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-control-station.png';
import runtimeFurniture8 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-station-with-base.png';
import runtimeFurniture9 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-plant.png';
import runtimeFurniture10 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-computer-terminal.png';
import runtimeFurniture11 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-front.png';
import runtimeFurniture12 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-desk-front.png';
import runtimeFurniture13 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-gray-desk-front.png';
import runtimeFurniture14 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-front.png';
import runtimeFurniture15 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-tan-desk-front.png';
import runtimeFurniture16 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-whiteboard-panel.png';
import runtimeFurniture17 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/monitor-and-terminal-cluster.png';
import runtimeFurniture18 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/office-chair-front-tan.png';
import runtimeFurniture19 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/office-water-cooler.png';
import runtimeFurniture20 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/planning-whiteboard-chart.png';
import runtimeFurniture21 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/printer-and-monitor-station.png';
import runtimeFurniture22 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools.png';
import runtimeFurniture23 from '@/modules/observatory/assets/furnitures/1_Modern_Office_Singles_48x48/whiteboard-with-ui-chart.png';

type ImportedRasterAsset = StaticImageData | string;
type RuntimeFurnitureInput = {
  asset: ImportedRasterAsset;
  crop: { height: number; width: number; x: number; y: number };
  height: number;
  id: string;
  label: string;
  role: string;
  width: number;
};

function uri(asset: ImportedRasterAsset) {
  return typeof asset === 'string' ? asset : asset.src;
}

function collisionForRuntimeFurniture({ height, width, x, y }: RuntimeFurnitureInput['crop']) {
  const offsetX = Math.floor(x / 48);
  const offsetY = Math.floor(y / 48);
  const collisionWidth = Math.max(1, Math.ceil((x - offsetX * 48 + width) / 48));
  const collisionHeight = Math.max(1, Math.ceil((y - offsetY * 48 + height) / 48));

  return {
    width: collisionWidth,
    height: collisionHeight,
    ...(offsetX > 0 ? { offsetX } : {}),
    ...(offsetY > 0 ? { offsetY } : {}),
  };
}

function runtimeFurniture(input: RuntimeFurnitureInput): ObservatoryAssetDefinition {
  return {
    id: input.id,
    catalogPath: `runtime/${input.id}`,
    category: 'furniture',
    label: input.label,
    source: { kind: 'image', uri: uri(input.asset) },
    previewCrop: input.crop,
    sourceCrop: input.crop,
    width: input.width,
    height: input.height,
    anchor: { x: 0, y: 0 },
    collision: collisionForRuntimeFurniture(input.crop),
    semanticId: `furniture:${input.role}:${input.id.split(':').at(-1) ?? input.id}`,
    tags: ['office-pack', 'runtime-furniture', `role:${input.role}`],
  };
}

export const observatoryRuntimeFurnitureAssets: ObservatoryAssetDefinition[] = [
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:blue-wall-monitor-right',
    label: 'Blue Wall Monitor Right',
    asset: runtimeFurniture0,
    width: 96,
    height: 144,
    crop: { height: 45, width: 45, x: 3, y: 99 },
    role: 'monitor',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:compact-gray-laptop',
    label: 'Compact Gray Laptop',
    asset: runtimeFurniture1,
    width: 96,
    height: 144,
    crop: { height: 33, width: 39, x: 6, y: 72 },
    role: 'laptop',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:dual-monitor-workstation-wide',
    label: 'Dual Monitor Workstation Wide',
    asset: runtimeFurniture2,
    width: 96,
    height: 144,
    crop: { height: 69, width: 96, x: 0, y: 54 },
    role: 'workstation',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:dual-screen-console-desk',
    label: 'Dual Screen Console Desk',
    asset: runtimeFurniture3,
    width: 96,
    height: 144,
    crop: { height: 69, width: 96, x: 0, y: 51 },
    role: 'workstation',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:low-storage-cabinet-wide-gray',
    label: 'Low Storage Cabinet Wide Gray',
    asset: runtimeFurniture4,
    width: 96,
    height: 144,
    crop: { height: 39, width: 78, x: 9, y: 105 },
    role: 'cabinet',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-desk-phone-handset',
    label: 'Modern Office Desk Phone Handset',
    asset: runtimeFurniture5,
    width: 96,
    height: 144,
    crop: { height: 15, width: 48, x: 0, y: 123 },
    role: 'phone',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-gray-runtime-server-tower',
    label: 'Modern Office Gray Runtime Server Tower',
    asset: runtimeFurniture6,
    width: 96,
    height: 144,
    crop: { height: 63, width: 39, x: 6, y: 60 },
    role: 'server',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-multi-monitor-control-station',
    label: 'Modern Office Multi Monitor Control Station',
    asset: runtimeFurniture7,
    width: 96,
    height: 144,
    crop: { height: 105, width: 48, x: 0, y: 3 },
    role: 'workstation',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-multi-monitor-station-with-base',
    label: 'Modern Office Multi Monitor Station With Base',
    asset: runtimeFurniture8,
    width: 96,
    height: 144,
    crop: { height: 105, width: 48, x: 0, y: 3 },
    role: 'workstation',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-small-office-plant',
    label: 'Modern Office Small Office Plant',
    asset: runtimeFurniture9,
    width: 96,
    height: 144,
    crop: { height: 54, width: 48, x: 0, y: 60 },
    role: 'plant',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-compact-computer-terminal',
    label: 'Modern Office Compact Computer Terminal',
    asset: runtimeFurniture10,
    width: 96,
    height: 144,
    crop: { height: 30, width: 33, x: 6, y: 96 },
    role: 'computer',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-gray-office-chair-front',
    label: 'Modern Office Gray Office Chair Front',
    asset: runtimeFurniture11,
    width: 96,
    height: 144,
    crop: { height: 63, width: 48, x: 0, y: 75 },
    role: 'chair',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-wide-beige-desk-front',
    label: 'Modern Office Wide Beige Desk Front',
    asset: runtimeFurniture12,
    width: 96,
    height: 144,
    crop: { height: 57, width: 96, x: 0, y: 48 },
    role: 'desk',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-wide-gray-desk-front',
    label: 'Modern Office Wide Gray Desk Front',
    asset: runtimeFurniture13,
    width: 96,
    height: 144,
    crop: { height: 57, width: 96, x: 0, y: 48 },
    role: 'desk',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-wide-server-cage-front',
    label: 'Modern Office Wide Server Cage Front',
    asset: runtimeFurniture14,
    width: 96,
    height: 144,
    crop: { height: 72, width: 93, x: 0, y: 60 },
    role: 'server-rack',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-wide-tan-desk-front',
    label: 'Modern Office Wide Tan Desk Front',
    asset: runtimeFurniture15,
    width: 96,
    height: 144,
    crop: { height: 57, width: 96, x: 0, y: 48 },
    role: 'desk',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:modern-office-wide-whiteboard-panel',
    label: 'Modern Office Wide Whiteboard Panel',
    asset: runtimeFurniture16,
    width: 96,
    height: 144,
    crop: { height: 42, width: 75, x: 12, y: 81 },
    role: 'whiteboard',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:monitor-and-terminal-cluster',
    label: 'Monitor And Terminal Cluster',
    asset: runtimeFurniture17,
    width: 96,
    height: 144,
    crop: { height: 72, width: 78, x: 18, y: 48 },
    role: 'workstation',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:office-chair-front-tan',
    label: 'Office Chair Front Tan',
    asset: runtimeFurniture18,
    width: 96,
    height: 144,
    crop: { height: 54, width: 48, x: 0, y: 66 },
    role: 'chair',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:office-water-cooler',
    label: 'Office Water Cooler',
    asset: runtimeFurniture19,
    width: 96,
    height: 144,
    crop: { height: 90, width: 42, x: 3, y: 24 },
    role: 'water-cooler',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:planning-whiteboard-chart',
    label: 'Planning Whiteboard Chart',
    asset: runtimeFurniture20,
    width: 96,
    height: 144,
    crop: { height: 69, width: 90, x: 3, y: 69 },
    role: 'whiteboard',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:printer-and-monitor-station',
    label: 'Printer And Monitor Station',
    asset: runtimeFurniture21,
    width: 96,
    height: 144,
    crop: { height: 69, width: 84, x: 12, y: 51 },
    role: 'workstation',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:server-workbench-with-tools',
    label: 'Server Workbench With Tools',
    asset: runtimeFurniture22,
    width: 96,
    height: 144,
    crop: { height: 96, width: 78, x: 12, y: 21 },
    role: 'workbench',
  }),
  runtimeFurniture({
    id: 'furniture:1-modern-office-singles-48x48:whiteboard-with-ui-chart',
    label: 'Whiteboard With UI Chart',
    asset: runtimeFurniture23,
    width: 96,
    height: 144,
    crop: { height: 69, width: 90, x: 3, y: 69 },
    role: 'whiteboard',
  }),
];
