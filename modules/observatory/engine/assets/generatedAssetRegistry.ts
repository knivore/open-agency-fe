import type { StaticImageData } from 'next/image';

import type { ObservatoryAssetDefinition, ObservatoryAssetSourceCrop } from './assetRegistry';
import { observatoryAssetCatalogEntries, type ObservatoryAssetCatalogEntry } from './assetCatalog';
import type { ObservatoryFurnitureManifestAsset } from './furnitureManifest';
import furnitureManifest from '../../assets/furnitures/furniture-manifest.generated.json';
import asset0 from '../../assets/characters/Character_48x48_01.png';
import asset1 from '../../assets/characters/Character_48x48_02.png';
import asset2 from '../../assets/characters/Character_48x48_03.png';
import asset3 from '../../assets/characters/Character_48x48_04.png';
import asset4 from '../../assets/characters/Character_48x48_05.png';
import asset5 from '../../assets/floors/Floors_1.png';
import asset6 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/angled-office-machine.png';
import asset7 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-dark.png';
import asset8 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-gray.png';
import asset9 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-light.png';
import asset10 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-dark.png';
import asset11 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-gray.png';
import asset12 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-light.png';
import asset13 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blank-whiteboard-wide.png';
import asset14 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-angled-left.png';
import asset15 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-angled-right.png';
import asset16 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-front.png';
import asset17 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-left-small.png';
import asset18 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-left.png';
import asset19 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-on-stand.png';
import asset20 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-wall-monitor-left.png';
import asset21 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-wall-monitor-right.png';
import asset22 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/blue-water-bottle.png';
import asset23 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/compact-gray-laptop.png';
import asset24 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/compact-office-printer-front.png';
import asset25 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/compact-tower-server-light.png';
import asset26 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/compact-tower-server.png';
import asset27 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/computer-mouse-left-dark.png';
import asset28 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/computer-mouse-left-light.png';
import asset29 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/computer-mouse-right-dark.png';
import asset30 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/cubicle-partition-panel-wide.png';
import asset31 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/cyan-water-bottle.png';
import asset32 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/desk-lamp-with-paper-stack-dark.png';
import asset33 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/desk-lamp-with-paper-stack.png';
import asset34 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/desktop-printer-station-gray.png';
import asset35 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/desktop-printer-station-light.png';
import asset36 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/desktop-workstation-cluster-left.png';
import asset37 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/dual-monitor-workstation-wide.png';
import asset38 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/dual-screen-console-desk.png';
import asset39 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/emoji-reaction-board.png';
import asset40 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/fax-printer-with-paper.png';
import asset41 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/glass-display-cabinet.png';
import asset42 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-dark.png';
import asset43 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-left.png';
import asset44 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-light.png';
import asset45 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-right.png';
import asset46 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/large-wood-table-top.png';
import asset47 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/large-wood-table-vertical.png';
import asset48 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/low-desktop-printer.png';
import asset49 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/low-keyboard-dark.png';
import asset50 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/low-keyboard-light.png';
import asset51 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/low-storage-cabinet-gray.png';
import asset52 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/low-storage-cabinet-wide-gray.png';
import asset53 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-blue-dashboard-panel.png';
import asset54 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-green-dashboard-panel.png';
import asset55 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-orange-dashboard-panel.png';
import asset56 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-red-dashboard-panel.png';
import asset57 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-cabinet-front.png';
import asset58 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-018.png';
import asset59 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-019.png';
import asset60 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-020.png';
import asset61 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-022.png';
import asset62 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-023.png';
import asset63 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-027.png';
import asset64 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-028.png';
import asset65 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-029.png';
import asset66 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-030.png';
import asset67 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-031.png';
import asset68 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-032.png';
import asset69 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-033.png';
import asset70 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-001.png';
import asset71 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-002.png';
import asset72 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-003.png';
import asset73 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-012.png';
import asset74 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-013.png';
import asset75 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-014.png';
import asset76 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-015.png';
import asset77 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-016.png';
import asset78 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-corner-tall.png';
import asset79 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-corner.png';
import asset80 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-front.png';
import asset81 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-table-square.png';
import asset82 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-black-metal-stand.png';
import asset83 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-blue-dashboard-screen-left.png';
import asset84 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-blue-dashboard-screen-right.png';
import asset85 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-left.png';
import asset86 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-side.png';
import asset87 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-wide.png';
import asset88 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-computer-terminal.png';
import asset89 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-safe-front.png';
import asset90 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-wall-safe-closed.png';
import asset91 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-wall-safe.png';
import asset92 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-beige-desk-front.png';
import asset93 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-beige-table-front.png';
import asset94 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-gray-desk-front.png';
import asset95 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-tan-desk-front.png';
import asset96 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-white-desk-front.png';
import asset97 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-cream-cabinet-panel-front.png';
import asset98 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-cream-office-counter-module-052.png';
import asset99 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-office-chair-back.png';
import asset100 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-office-chair-front.png';
import asset101 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-runtime-server-tower.png';
import asset102 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-office-chair-side-alt.png';
import asset103 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-desk-phone-handset.png';
import asset104 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-blue.png';
import asset105 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-orange.png';
import asset106 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-yellow.png';
import asset107 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gold-runtime-server-tower.png';
import asset108 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-back.png';
import asset109 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-front.png';
import asset110 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-left-alt.png';
import asset111 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-left.png';
import asset112 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-right-alt.png';
import asset113 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-right.png';
import asset114 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-side-left.png';
import asset115 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-side-right.png';
import asset116 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-counter-module-051.png';
import asset117 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-floor-wall-tile-088.png';
import asset118 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-floor-wall-tile-091.png';
import asset119 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-004.png';
import asset120 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-005.png';
import asset121 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-006.png';
import asset122 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-007.png';
import asset123 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-008.png';
import asset124 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-035.png';
import asset125 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-036.png';
import asset126 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-037.png';
import asset127 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-038.png';
import asset128 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-039.png';
import asset129 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-040.png';
import asset130 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-041.png';
import asset131 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-042.png';
import asset132 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-043.png';
import asset133 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-044.png';
import asset134 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-045.png';
import asset135 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-046.png';
import asset136 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-047.png';
import asset137 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-048.png';
import asset138 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-049.png';
import asset139 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-050.png';
import asset140 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-platform-corner.png';
import asset141 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-platform-front.png';
import asset142 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-runtime-server-tower.png';
import asset143 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-service-counter-front.png';
import asset144 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-service-counter-side.png';
import asset145 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-left.png';
import asset146 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-side.png';
import asset147 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-wide.png';
import asset148 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-board-terminal.png';
import asset149 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-cluster.png';
import asset150 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-server-panel.png';
import asset151 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-low-wood-service-counter.png';
import asset152 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-control-station.png';
import asset153 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-station-with-base.png';
import asset154 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-panel.png';
import asset155 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-platform.png';
import asset156 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-table-panel.png';
import asset157 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-gray-panel.png';
import asset158 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-tan-panel.png';
import asset159 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-tan-storage-cabinet.png';
import asset160 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-white-panel.png';
import asset161 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-olive-office-floor-wall-tile-086.png';
import asset162 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-olive-office-floor-wall-tile-089.png';
import asset163 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-back-alt.png';
import asset164 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-back.png';
import asset165 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-front-alt.png';
import asset166 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-front.png';
import asset167 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-alt.png';
import asset168 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-left.png';
import asset169 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-right.png';
import asset170 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side.png';
import asset171 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-runtime-server-tower.png';
import asset172 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-red-office-floor-wall-tile-087.png';
import asset173 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-red-office-floor-wall-tile-090.png';
import asset174 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-red-runtime-server-tower.png';
import asset175 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-front-side.png';
import asset176 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-side-left.png';
import asset177 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-side-right.png';
import asset178 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-092.png';
import asset179 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-093.png';
import asset180 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-094.png';
import asset181 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-095.png';
import asset182 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-slim-office-plant.png';
import asset183 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-desk-front.png';
import asset184 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform-front.png';
import asset185 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform-side.png';
import asset186 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform.png';
import asset187 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-tabletop.png';
import asset188 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-cabinet-front.png';
import asset189 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-desk-front.png';
import asset190 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-platform.png';
import asset191 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-device.png';
import asset192 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-plant.png';
import asset193 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-terminal.png';
import asset194 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-paper-tray.png';
import asset195 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-scanner.png';
import asset196 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-with-paper.png';
import asset197 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-cabinet-front.png';
import asset198 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-desk-front.png';
import asset199 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-platform.png';
import asset200 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-service-desk.png';
import asset201 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-cabinet-front.png';
import asset202 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-desk-front.png';
import asset203 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-platform.png';
import asset204 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-beige-platform-panel.png';
import asset205 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-cream-storage-cabinet.png';
import asset206 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-gray-platform-panel.png';
import asset207 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-office-plant.png';
import asset208 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-tan-platform-panel.png';
import asset209 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-tan-storage-cabinet.png';
import asset210 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-white-platform-panel.png';
import asset211 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-left.png';
import asset212 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-side.png';
import asset213 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-wide.png';
import asset214 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-053.png';
import asset215 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-054.png';
import asset216 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-055.png';
import asset217 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-056.png';
import asset218 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-057.png';
import asset219 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-058.png';
import asset220 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-059.png';
import asset221 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-060.png';
import asset222 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-061.png';
import asset223 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-062.png';
import asset224 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-063.png';
import asset225 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-064.png';
import asset226 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-065.png';
import asset227 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-066.png';
import asset228 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-067.png';
import asset229 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-068.png';
import asset230 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-017.png';
import asset231 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-021.png';
import asset232 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-024.png';
import asset233 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-025.png';
import asset234 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-034.png';
import asset235 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-panel.png';
import asset236 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-side.png';
import asset237 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-wide.png';
import asset238 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-platform-corner.png';
import asset239 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-platform-front.png';
import asset240 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-left.png';
import asset241 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-side.png';
import asset242 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-wide.png';
import asset243 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-thin-metal-pole.png';
import asset244 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-thin-utility-stand.png';
import asset245 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wall-chart-blueprint.png';
import asset246 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wall-chart-orange-plan.png';
import asset247 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-026.png';
import asset248 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-069.png';
import asset249 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-070.png';
import asset250 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-071.png';
import asset251 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-072.png';
import asset252 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-073.png';
import asset253 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-074.png';
import asset254 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-075.png';
import asset255 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-076.png';
import asset256 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-077.png';
import asset257 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-078.png';
import asset258 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-079.png';
import asset259 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-080.png';
import asset260 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-081.png';
import asset261 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-082.png';
import asset262 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-083.png';
import asset263 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-084.png';
import asset264 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-085.png';
import asset265 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-paper-stack.png';
import asset266 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-platform-corner.png';
import asset267 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-platform-front.png';
import asset268 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-left.png';
import asset269 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-side.png';
import asset270 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-wide.png';
import asset271 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-desk-front.png';
import asset272 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-platform-front.png';
import asset273 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-platform-with-drawer.png';
import asset274 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-table-front.png';
import asset275 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-gray-desk-front.png';
import asset276 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-gray-platform-front.png';
import asset277 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-front.png';
import asset278 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-left.png';
import asset279 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-right.png';
import asset280 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-tan-desk-front.png';
import asset281 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-tan-platform-front.png';
import asset282 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-white-desk-front.png';
import asset283 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-white-platform-front.png';
import asset284 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-whiteboard-panel.png';
import asset285 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-drawer-cabinet-tall.png';
import asset286 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-drawer-cabinet-wide.png';
import asset287 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-009.png';
import asset288 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-010.png';
import asset289 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-011.png';
import asset290 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/modern-office-yellow-runtime-server-tower.png';
import asset291 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/monitor-and-terminal-cluster.png';
import asset292 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/monitor-on-stand-dark.png';
import asset293 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/monitor-on-stand-light.png';
import asset294 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/narrow-storage-cabinet-gray.png';
import asset295 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/narrow-wood-desk-front.png';
import asset296 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-chair-front-gray.png';
import asset297 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-chair-front-light.png';
import asset298 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-chair-front-tan.png';
import asset299 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-chair-front-white.png';
import asset300 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-printer-front-gray.png';
import asset301 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-printer-front-light.png';
import asset302 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-printer-with-output-tray.png';
import asset303 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-printer-with-paper-stack.png';
import asset304 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/office-water-cooler.png';
import asset305 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/operator-chair-with-monitor-left.png';
import asset306 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/operator-chair-with-monitor-right.png';
import asset307 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/paper-stack-angled.png';
import asset308 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/paper-stack-large-angled.png';
import asset309 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/planning-whiteboard-chart.png';
import asset310 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-and-monitor-station.png';
import asset311 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-monitor-cluster.png';
import asset312 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-workbench-blue.png';
import asset313 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-workbench-gray.png';
import asset314 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-workbench-light-blue.png';
import asset315 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-workbench-orange.png';
import asset316 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-workbench-purple.png';
import asset317 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/printer-workbench-white.png';
import asset318 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/rolling-office-chair-side.png';
import asset319 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-front.png';
import asset320 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-left.png';
import asset321 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-right.png';
import asset322 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools-orange.png';
import asset323 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools-red.png';
import asset324 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools.png';
import asset325 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/single-monitor-left-dark.png';
import asset326 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/single-monitor-left-light.png';
import asset327 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/single-paper-sheet-angled.png';
import asset328 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/small-floor-cabinet-gray.png';
import asset329 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/small-framed-wall-screen.png';
import asset330 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/small-wall-control-panel-yellow.png';
import asset331 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/small-wall-control-panel.png';
import asset332 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/small-whiteboard-chart.png';
import asset333 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/small-wood-table-top.png';
import asset334 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/small-yellow-wall-notice.png';
import asset335 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/standing-desk-lamp-yellow.png';
import asset336 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/tall-cabinet-with-posters.png';
import asset337 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/tall-control-server-rack.png';
import asset338 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/tall-network-server-rack.png';
import asset339 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/tall-paper-stack.png';
import asset340 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/tall-wood-table-top.png';
import asset341 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/tower-terminal-front.png';
import asset342 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/tower-terminal-with-blue-screen.png';
import asset343 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/whiteboard-with-ui-chart.png';
import asset344 from '../../assets/furnitures/1_Modern_Office_Singles_48x48/wide-wood-desk-front.png';
import asset345 from '../../assets/walls/Walls_1.png';

type ImportedRasterAsset = StaticImageData | string;
type GeneratedFrameGeometry = {
  confidence: string;
  frameHeight: number;
  frameWidth: number;
};
type FurnitureManifest = {
  assets?: ObservatoryFurnitureManifestAsset[];
};

function uri(asset: ImportedRasterAsset) {
  return typeof asset === 'string' ? asset : asset.src;
}

const furnitureManifestAssetsByCatalogPath = new Map(
  ((furnitureManifest as FurnitureManifest).assets ?? []).map((asset) => [asset.source.path, asset])
);

const generatedAssetImports: Record<string, ImportedRasterAsset> = {
  'characters/Character_48x48_01.png': asset0,
  'characters/Character_48x48_02.png': asset1,
  'characters/Character_48x48_03.png': asset2,
  'characters/Character_48x48_04.png': asset3,
  'characters/Character_48x48_05.png': asset4,
  'floors/Floors_1.png': asset5,
  'furnitures/1_Modern_Office_Singles_48x48/angled-office-machine.png': asset6,
  'furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-dark.png': asset7,
  'furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-gray.png': asset8,
  'furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-light.png': asset9,
  'furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-dark.png': asset10,
  'furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-gray.png': asset11,
  'furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-light.png': asset12,
  'furnitures/1_Modern_Office_Singles_48x48/blank-whiteboard-wide.png': asset13,
  'furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-angled-left.png': asset14,
  'furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-angled-right.png': asset15,
  'furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-front.png': asset16,
  'furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-left-small.png': asset17,
  'furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-left.png': asset18,
  'furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-on-stand.png': asset19,
  'furnitures/1_Modern_Office_Singles_48x48/blue-wall-monitor-left.png': asset20,
  'furnitures/1_Modern_Office_Singles_48x48/blue-wall-monitor-right.png': asset21,
  'furnitures/1_Modern_Office_Singles_48x48/blue-water-bottle.png': asset22,
  'furnitures/1_Modern_Office_Singles_48x48/compact-gray-laptop.png': asset23,
  'furnitures/1_Modern_Office_Singles_48x48/compact-office-printer-front.png': asset24,
  'furnitures/1_Modern_Office_Singles_48x48/compact-tower-server-light.png': asset25,
  'furnitures/1_Modern_Office_Singles_48x48/compact-tower-server.png': asset26,
  'furnitures/1_Modern_Office_Singles_48x48/computer-mouse-left-dark.png': asset27,
  'furnitures/1_Modern_Office_Singles_48x48/computer-mouse-left-light.png': asset28,
  'furnitures/1_Modern_Office_Singles_48x48/computer-mouse-right-dark.png': asset29,
  'furnitures/1_Modern_Office_Singles_48x48/cubicle-partition-panel-wide.png': asset30,
  'furnitures/1_Modern_Office_Singles_48x48/cyan-water-bottle.png': asset31,
  'furnitures/1_Modern_Office_Singles_48x48/desk-lamp-with-paper-stack-dark.png': asset32,
  'furnitures/1_Modern_Office_Singles_48x48/desk-lamp-with-paper-stack.png': asset33,
  'furnitures/1_Modern_Office_Singles_48x48/desktop-printer-station-gray.png': asset34,
  'furnitures/1_Modern_Office_Singles_48x48/desktop-printer-station-light.png': asset35,
  'furnitures/1_Modern_Office_Singles_48x48/desktop-workstation-cluster-left.png': asset36,
  'furnitures/1_Modern_Office_Singles_48x48/dual-monitor-workstation-wide.png': asset37,
  'furnitures/1_Modern_Office_Singles_48x48/dual-screen-console-desk.png': asset38,
  'furnitures/1_Modern_Office_Singles_48x48/emoji-reaction-board.png': asset39,
  'furnitures/1_Modern_Office_Singles_48x48/fax-printer-with-paper.png': asset40,
  'furnitures/1_Modern_Office_Singles_48x48/glass-display-cabinet.png': asset41,
  'furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-dark.png': asset42,
  'furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-left.png': asset43,
  'furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-light.png': asset44,
  'furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-right.png': asset45,
  'furnitures/1_Modern_Office_Singles_48x48/large-wood-table-top.png': asset46,
  'furnitures/1_Modern_Office_Singles_48x48/large-wood-table-vertical.png': asset47,
  'furnitures/1_Modern_Office_Singles_48x48/low-desktop-printer.png': asset48,
  'furnitures/1_Modern_Office_Singles_48x48/low-keyboard-dark.png': asset49,
  'furnitures/1_Modern_Office_Singles_48x48/low-keyboard-light.png': asset50,
  'furnitures/1_Modern_Office_Singles_48x48/low-storage-cabinet-gray.png': asset51,
  'furnitures/1_Modern_Office_Singles_48x48/low-storage-cabinet-wide-gray.png': asset52,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-blue-dashboard-panel.png': asset53,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-green-dashboard-panel.png':
    asset54,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-orange-dashboard-panel.png':
    asset55,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-red-dashboard-panel.png': asset56,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-cabinet-front.png': asset57,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-018.png':
    asset58,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-019.png':
    asset59,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-020.png':
    asset60,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-022.png':
    asset61,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-023.png':
    asset62,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-027.png':
    asset63,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-028.png':
    asset64,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-029.png':
    asset65,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-030.png':
    asset66,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-031.png':
    asset67,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-032.png':
    asset68,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-033.png':
    asset69,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-001.png':
    asset70,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-002.png':
    asset71,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-003.png':
    asset72,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-012.png':
    asset73,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-013.png':
    asset74,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-014.png':
    asset75,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-015.png':
    asset76,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-016.png':
    asset77,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-corner-tall.png': asset78,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-corner.png': asset79,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-front.png': asset80,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-table-square.png': asset81,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-black-metal-stand.png': asset82,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-blue-dashboard-screen-left.png': asset83,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-blue-dashboard-screen-right.png': asset84,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-left.png': asset85,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-side.png': asset86,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-wide.png': asset87,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-computer-terminal.png': asset88,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-safe-front.png': asset89,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-wall-safe-closed.png': asset90,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-wall-safe.png': asset91,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-beige-desk-front.png': asset92,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-beige-table-front.png': asset93,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-gray-desk-front.png': asset94,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-tan-desk-front.png': asset95,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-white-desk-front.png': asset96,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-cream-cabinet-panel-front.png': asset97,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-cream-office-counter-module-052.png':
    asset98,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-office-chair-back.png': asset99,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-office-chair-front.png':
    asset100,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-runtime-server-tower.png':
    asset101,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-office-chair-side-alt.png': asset102,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-desk-phone-handset.png': asset103,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-blue.png': asset104,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-orange.png': asset105,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-yellow.png': asset106,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gold-runtime-server-tower.png': asset107,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-back.png': asset108,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-front.png': asset109,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-left-alt.png': asset110,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-left.png': asset111,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-right-alt.png':
    asset112,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-right.png': asset113,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-side-left.png':
    asset114,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-side-right.png':
    asset115,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-counter-module-051.png':
    asset116,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-floor-wall-tile-088.png':
    asset117,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-floor-wall-tile-091.png':
    asset118,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-004.png':
    asset119,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-005.png':
    asset120,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-006.png':
    asset121,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-007.png':
    asset122,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-008.png':
    asset123,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-035.png': asset124,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-036.png': asset125,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-037.png': asset126,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-038.png': asset127,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-039.png': asset128,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-040.png': asset129,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-041.png': asset130,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-042.png': asset131,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-043.png': asset132,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-044.png': asset133,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-045.png': asset134,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-046.png': asset135,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-047.png': asset136,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-048.png': asset137,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-049.png': asset138,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-050.png': asset139,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-platform-corner.png': asset140,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-platform-front.png': asset141,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-runtime-server-tower.png': asset142,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-service-counter-front.png': asset143,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-service-counter-side.png': asset144,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-left.png': asset145,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-side.png': asset146,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-wide.png': asset147,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-board-terminal.png':
    asset148,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-cluster.png': asset149,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-server-panel.png': asset150,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-low-wood-service-counter.png': asset151,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-control-station.png':
    asset152,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-station-with-base.png':
    asset153,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-panel.png': asset154,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-platform.png': asset155,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-table-panel.png': asset156,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-gray-panel.png': asset157,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-tan-panel.png': asset158,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-tan-storage-cabinet.png': asset159,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-white-panel.png': asset160,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-olive-office-floor-wall-tile-086.png':
    asset161,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-olive-office-floor-wall-tile-089.png':
    asset162,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-back-alt.png':
    asset163,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-back.png': asset164,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-front-alt.png':
    asset165,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-front.png': asset166,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-alt.png':
    asset167,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-left.png':
    asset168,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-right.png':
    asset169,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side.png': asset170,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-runtime-server-tower.png':
    asset171,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-red-office-floor-wall-tile-087.png':
    asset172,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-red-office-floor-wall-tile-090.png':
    asset173,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-red-runtime-server-tower.png': asset174,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-front-side.png': asset175,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-side-left.png': asset176,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-side-right.png': asset177,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-092.png':
    asset178,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-093.png':
    asset179,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-094.png':
    asset180,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-095.png':
    asset181,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-slim-office-plant.png': asset182,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-desk-front.png': asset183,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform-front.png': asset184,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform-side.png': asset185,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform.png': asset186,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-tabletop.png': asset187,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-cabinet-front.png': asset188,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-desk-front.png': asset189,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-platform.png': asset190,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-device.png': asset191,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-plant.png': asset192,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-terminal.png': asset193,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-paper-tray.png': asset194,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-scanner.png': asset195,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-with-paper.png': asset196,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-cabinet-front.png': asset197,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-desk-front.png': asset198,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-platform.png': asset199,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-service-desk.png': asset200,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-cabinet-front.png': asset201,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-desk-front.png': asset202,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-platform.png': asset203,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-beige-platform-panel.png': asset204,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-cream-storage-cabinet.png': asset205,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-gray-platform-panel.png': asset206,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-office-plant.png': asset207,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-tan-platform-panel.png': asset208,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-tan-storage-cabinet.png': asset209,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-white-platform-panel.png': asset210,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-left.png': asset211,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-side.png': asset212,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-wide.png': asset213,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-053.png':
    asset214,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-054.png':
    asset215,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-055.png':
    asset216,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-056.png':
    asset217,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-057.png':
    asset218,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-058.png':
    asset219,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-059.png':
    asset220,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-060.png':
    asset221,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-061.png':
    asset222,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-062.png':
    asset223,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-063.png':
    asset224,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-064.png':
    asset225,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-065.png':
    asset226,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-066.png':
    asset227,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-067.png':
    asset228,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-068.png':
    asset229,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-017.png': asset230,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-021.png': asset231,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-024.png': asset232,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-025.png': asset233,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-034.png': asset234,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-panel.png': asset235,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-side.png': asset236,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-wide.png': asset237,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-platform-corner.png': asset238,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-platform-front.png': asset239,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-left.png': asset240,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-side.png': asset241,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-wide.png': asset242,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-thin-metal-pole.png': asset243,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-thin-utility-stand.png': asset244,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wall-chart-blueprint.png': asset245,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wall-chart-orange-plan.png': asset246,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-026.png':
    asset247,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-069.png':
    asset248,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-070.png':
    asset249,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-071.png':
    asset250,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-072.png':
    asset251,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-073.png':
    asset252,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-074.png':
    asset253,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-075.png':
    asset254,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-076.png':
    asset255,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-077.png':
    asset256,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-078.png':
    asset257,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-079.png':
    asset258,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-080.png':
    asset259,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-081.png':
    asset260,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-082.png':
    asset261,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-083.png':
    asset262,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-084.png':
    asset263,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-085.png':
    asset264,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-paper-stack.png': asset265,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-platform-corner.png': asset266,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-platform-front.png': asset267,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-left.png': asset268,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-side.png': asset269,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-wide.png': asset270,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-desk-front.png': asset271,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-platform-front.png': asset272,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-platform-with-drawer.png':
    asset273,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-table-front.png': asset274,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-gray-desk-front.png': asset275,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-gray-platform-front.png': asset276,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-front.png': asset277,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-left.png': asset278,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-right.png': asset279,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-tan-desk-front.png': asset280,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-tan-platform-front.png': asset281,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-white-desk-front.png': asset282,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-white-platform-front.png': asset283,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-whiteboard-panel.png': asset284,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-drawer-cabinet-tall.png': asset285,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-drawer-cabinet-wide.png': asset286,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-009.png':
    asset287,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-010.png':
    asset288,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-011.png':
    asset289,
  'furnitures/1_Modern_Office_Singles_48x48/modern-office-yellow-runtime-server-tower.png':
    asset290,
  'furnitures/1_Modern_Office_Singles_48x48/monitor-and-terminal-cluster.png': asset291,
  'furnitures/1_Modern_Office_Singles_48x48/monitor-on-stand-dark.png': asset292,
  'furnitures/1_Modern_Office_Singles_48x48/monitor-on-stand-light.png': asset293,
  'furnitures/1_Modern_Office_Singles_48x48/narrow-storage-cabinet-gray.png': asset294,
  'furnitures/1_Modern_Office_Singles_48x48/narrow-wood-desk-front.png': asset295,
  'furnitures/1_Modern_Office_Singles_48x48/office-chair-front-gray.png': asset296,
  'furnitures/1_Modern_Office_Singles_48x48/office-chair-front-light.png': asset297,
  'furnitures/1_Modern_Office_Singles_48x48/office-chair-front-tan.png': asset298,
  'furnitures/1_Modern_Office_Singles_48x48/office-chair-front-white.png': asset299,
  'furnitures/1_Modern_Office_Singles_48x48/office-printer-front-gray.png': asset300,
  'furnitures/1_Modern_Office_Singles_48x48/office-printer-front-light.png': asset301,
  'furnitures/1_Modern_Office_Singles_48x48/office-printer-with-output-tray.png': asset302,
  'furnitures/1_Modern_Office_Singles_48x48/office-printer-with-paper-stack.png': asset303,
  'furnitures/1_Modern_Office_Singles_48x48/office-water-cooler.png': asset304,
  'furnitures/1_Modern_Office_Singles_48x48/operator-chair-with-monitor-left.png': asset305,
  'furnitures/1_Modern_Office_Singles_48x48/operator-chair-with-monitor-right.png': asset306,
  'furnitures/1_Modern_Office_Singles_48x48/paper-stack-angled.png': asset307,
  'furnitures/1_Modern_Office_Singles_48x48/paper-stack-large-angled.png': asset308,
  'furnitures/1_Modern_Office_Singles_48x48/planning-whiteboard-chart.png': asset309,
  'furnitures/1_Modern_Office_Singles_48x48/printer-and-monitor-station.png': asset310,
  'furnitures/1_Modern_Office_Singles_48x48/printer-monitor-cluster.png': asset311,
  'furnitures/1_Modern_Office_Singles_48x48/printer-workbench-blue.png': asset312,
  'furnitures/1_Modern_Office_Singles_48x48/printer-workbench-gray.png': asset313,
  'furnitures/1_Modern_Office_Singles_48x48/printer-workbench-light-blue.png': asset314,
  'furnitures/1_Modern_Office_Singles_48x48/printer-workbench-orange.png': asset315,
  'furnitures/1_Modern_Office_Singles_48x48/printer-workbench-purple.png': asset316,
  'furnitures/1_Modern_Office_Singles_48x48/printer-workbench-white.png': asset317,
  'furnitures/1_Modern_Office_Singles_48x48/rolling-office-chair-side.png': asset318,
  'furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-front.png': asset319,
  'furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-left.png': asset320,
  'furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-right.png': asset321,
  'furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools-orange.png': asset322,
  'furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools-red.png': asset323,
  'furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools.png': asset324,
  'furnitures/1_Modern_Office_Singles_48x48/single-monitor-left-dark.png': asset325,
  'furnitures/1_Modern_Office_Singles_48x48/single-monitor-left-light.png': asset326,
  'furnitures/1_Modern_Office_Singles_48x48/single-paper-sheet-angled.png': asset327,
  'furnitures/1_Modern_Office_Singles_48x48/small-floor-cabinet-gray.png': asset328,
  'furnitures/1_Modern_Office_Singles_48x48/small-framed-wall-screen.png': asset329,
  'furnitures/1_Modern_Office_Singles_48x48/small-wall-control-panel-yellow.png': asset330,
  'furnitures/1_Modern_Office_Singles_48x48/small-wall-control-panel.png': asset331,
  'furnitures/1_Modern_Office_Singles_48x48/small-whiteboard-chart.png': asset332,
  'furnitures/1_Modern_Office_Singles_48x48/small-wood-table-top.png': asset333,
  'furnitures/1_Modern_Office_Singles_48x48/small-yellow-wall-notice.png': asset334,
  'furnitures/1_Modern_Office_Singles_48x48/standing-desk-lamp-yellow.png': asset335,
  'furnitures/1_Modern_Office_Singles_48x48/tall-cabinet-with-posters.png': asset336,
  'furnitures/1_Modern_Office_Singles_48x48/tall-control-server-rack.png': asset337,
  'furnitures/1_Modern_Office_Singles_48x48/tall-network-server-rack.png': asset338,
  'furnitures/1_Modern_Office_Singles_48x48/tall-paper-stack.png': asset339,
  'furnitures/1_Modern_Office_Singles_48x48/tall-wood-table-top.png': asset340,
  'furnitures/1_Modern_Office_Singles_48x48/tower-terminal-front.png': asset341,
  'furnitures/1_Modern_Office_Singles_48x48/tower-terminal-with-blue-screen.png': asset342,
  'furnitures/1_Modern_Office_Singles_48x48/whiteboard-with-ui-chart.png': asset343,
  'furnitures/1_Modern_Office_Singles_48x48/wide-wood-desk-front.png': asset344,
  'walls/Walls_1.png': asset345,
};

const generatedAnimationFrameCrops: Record<string, ObservatoryAssetSourceCrop> = {};

export const observatoryGeneratedAssetRegistryAssets: ObservatoryAssetDefinition[] =
  observatoryAssetCatalogEntries.map(toGeneratedAssetDefinition);

function toGeneratedAssetDefinition(
  entry: ObservatoryAssetCatalogEntry
): ObservatoryAssetDefinition {
  const furnitureAsset = furnitureManifestAssetsByCatalogPath.get(entry.path);

  if (furnitureAsset) {
    return toGeneratedFurnitureAssetDefinition(entry, furnitureAsset);
  }

  const category = categoryForGeneratedCatalogPath(entry.path);
  const frameGeometry = inferGeneratedFrameGeometry(entry);
  const frameWidth = frameGeometry.frameWidth;
  const frameHeight = frameGeometry.frameHeight;
  const isAnimationAtlas = entry.path.startsWith('animations/') && isGeneratedAnimationAtlas(entry);
  const animationFrameCrop = generatedAnimationFrameCrops[entry.path];
  const frameCount = Math.max(
    1,
    Math.floor((entry.width ?? frameWidth) / frameWidth) *
      Math.floor((entry.height ?? frameHeight) / frameHeight)
  );
  const tags = [
    'office-pack',
    'generated',
    `catalog:${entry.path.split('/')[0] ?? 'root'}`,
    ...(entry.path.startsWith('animations/')
      ? [
          `frame:${frameWidth}x${frameHeight}`,
          frameGeometry.confidence,
          ...(isAnimationAtlas ? ['builder-hidden'] : []),
        ]
      : []),
    ...semanticTagsForGeneratedCatalogPath(entry.path),
  ];

  return {
    id: `generated:${entry.id}`,
    catalogPath: entry.path,
    category,
    label: labelForGeneratedCatalogPath(entry.path),
    source: {
      kind: 'spritesheet',
      uri: uri(generatedAssetImports[entry.path] ?? entry.path),
      frameWidth,
      frameHeight,
    },
    ...(animationFrameCrop ? { previewCrop: animationFrameCrop } : {}),
    frame: category === 'human' ? 1 : 0,
    ...(entry.path.startsWith('animations/') && !isAnimationAtlas && frameCount > 1
      ? {
          animation: {
            key: `generated:${entry.id}:loop`,
            startFrame: 0,
            endFrame: frameCount - 1,
            frameRate: 8,
            repeat: -1,
          },
        }
      : {}),
    width: frameWidth,
    height: frameHeight,
    anchor: category === 'human' ? { x: 0.5, y: 0.5 } : { x: 0, y: 0 },
    ...autotileForGeneratedCatalogPath(entry.path, frameGeometry),
    semanticId: `generated:${entry.id}`,
    tags,
  };
}

function toGeneratedFurnitureAssetDefinition(
  entry: ObservatoryAssetCatalogEntry,
  furnitureAsset: ObservatoryFurnitureManifestAsset
): ObservatoryAssetDefinition {
  const collision = collisionForFurnitureAsset(furnitureAsset);

  return {
    id: furnitureAsset.id,
    catalogPath: entry.path,
    category: 'furniture',
    label: furnitureAsset.label,
    source: {
      kind: 'image',
      uri: uri(generatedAssetImports[entry.path] ?? entry.path),
    },
    previewCrop: furnitureAsset.sourceCrop,
    sourceCrop: furnitureAsset.sourceCrop,
    width: furnitureAsset.width,
    height: furnitureAsset.height,
    anchor: { x: 0, y: 0 },
    collision,
    semanticId: `furniture:${furnitureAsset.semanticRole}:${furnitureAsset.id.split(':').at(-1) ?? entry.id}`,
    tags: [
      'office-pack',
      'manifest-backed',
      'furniture-manifest',
      `manifest-category:${furnitureAsset.category}`,
      `role:${furnitureAsset.semanticRole}`,
      ...furnitureAsset.tags,
    ],
  };
}

function collisionForFurnitureAsset(furnitureAsset: ObservatoryFurnitureManifestAsset) {
  const crop = furnitureAsset.sourceCrop ?? {
    height: furnitureAsset.height,
    width: furnitureAsset.width,
    x: 0,
    y: 0,
  };
  const offsetX = Math.floor(crop.x / 48);
  const offsetY = Math.floor(crop.y / 48);
  const width = Math.max(1, Math.ceil((crop.x - offsetX * 48 + crop.width) / 48));
  const height = Math.max(1, Math.ceil((crop.y - offsetY * 48 + crop.height) / 48));

  return {
    width,
    height,
    ...(offsetX > 0 ? { offsetX } : {}),
    ...(offsetY > 0 ? { offsetY } : {}),
  };
}

function inferGeneratedFrameGeometry(entry: ObservatoryAssetCatalogEntry): GeneratedFrameGeometry {
  if (entry.path.startsWith('animations/')) {
    return inferGeneratedAnimationFrameGeometry(entry);
  }

  if (entry.path.startsWith('characters/Character_48x48_')) {
    return { frameWidth: 48, frameHeight: 96, confidence: 'pattern' };
  }

  if (entry.path.startsWith('floors/A2 ')) {
    return { frameWidth: 32, frameHeight: 32, confidence: 'rpgmaker-a2-16x12' };
  }

  if (entry.path.startsWith('walls/A4 ')) {
    return { frameWidth: 32, frameHeight: 32, confidence: 'rpgmaker-a4-16x15' };
  }

  if (entry.path.startsWith('furnitures/')) {
    return {
      frameWidth: entry.width ?? 48,
      frameHeight: entry.height ?? 48,
      confidence: 'furniture-source-frame',
    };
  }

  if (entry.path.startsWith('floors/') || entry.path.startsWith('walls/')) {
    return { frameWidth: 48, frameHeight: 48, confidence: 'tilesheet-default' };
  }

  return { frameWidth: 48, frameHeight: 48, confidence: 'filename-default' };
}

function inferGeneratedAnimationFrameGeometry(
  entry: ObservatoryAssetCatalogEntry
): GeneratedFrameGeometry {
  const sourceWidth = entry.width ?? 48;
  const sourceHeight = entry.height ?? 48;

  if (isGeneratedAnimationAtlas(entry)) {
    return { frameWidth: 48, frameHeight: 48, confidence: 'rpgmaker-animation-atlas-48x48' };
  }

  return {
    frameWidth: sourceWidth % 48 === 0 ? 48 : sourceWidth,
    frameHeight: sourceHeight,
    confidence: 'rpgmaker-animation-horizontal-strip',
  };
}

function isGeneratedAnimationAtlas(entry: ObservatoryAssetCatalogEntry) {
  const fileName = entry.fileName.toLowerCase();
  const sourceWidth = entry.width ?? 0;
  const sourceHeight = entry.height ?? 0;

  return (
    fileName === 'animated_shopping_carts_48x48.png' ||
    (sourceWidth === sourceHeight && sourceWidth >= 480)
  );
}

function autotileForGeneratedCatalogPath(path: string, frameGeometry: GeneratedFrameGeometry) {
  if (path.startsWith('floors/A2 ')) {
    return {
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a2-ground' as const,
        set: { x: 0, y: 0, width: 2, height: 3 },
        tileSize: frameGeometry.frameWidth,
      },
    };
  }

  if (path.startsWith('walls/A4 ')) {
    return {
      autotile: {
        columns: 16,
        kind: 'rpgmaker-a4-wall' as const,
        set: { x: 0, y: 0, width: 2, height: 5 },
        tileSize: frameGeometry.frameWidth,
      },
    };
  }

  return {};
}

function categoryForGeneratedCatalogPath(path: string): ObservatoryAssetDefinition['category'] {
  if (path.startsWith('floors/')) {
    return 'floor';
  }
  if (path.startsWith('walls/')) {
    return 'wall';
  }
  if (path.startsWith('furnitures/')) {
    return 'furniture';
  }
  if (
    path.startsWith('characters/Premade_Character_') ||
    path.startsWith('characters/Character_48x48_')
  ) {
    return 'human';
  }
  return 'decor';
}

function semanticTagsForGeneratedCatalogPath(path: string): string[] {
  const normalized = path.toLowerCase();
  const tags: string[] = [];
  const tagRules: Array<[string, string]> = [
    ['bathroom', 'bathroom'],
    ['bed', 'rest'],
    ['book', 'reading'],
    ['cabinet', 'storage'],
    ['camera', 'security'],
    ['chair', 'seating'],
    ['coffee', 'pantry'],
    ['computer', 'workstation'],
    ['control_room', 'runtime'],
    ['desk', 'workstation'],
    ['door', 'door'],
    ['fridge', 'pantry'],
    ['kitchen', 'pantry'],
    ['laptop', 'workstation'],
    ['monitor', 'screen'],
    ['office', 'office'],
    ['phone', 'communication'],
    ['reception', 'reception'],
    ['screen', 'screen'],
    ['server', 'runtime'],
    ['sink', 'pantry'],
    ['table', 'table'],
    ['tv', 'screen'],
  ];

  for (const [needle, tag] of tagRules) {
    if (normalized.includes(needle)) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

function labelForGeneratedCatalogPath(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
