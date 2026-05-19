export interface ObservatoryAssetCatalogDirectorySummary {
  directory: string;
  fileCount: number;
}

export interface ObservatoryAssetCatalogEntry {
  animationFrameCrop?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  directory: string;
  extension: string;
  fileName: string;
  id: string;
  path: string;
  sha256: string;
  width?: number;
  height?: number;
}

export const observatoryAssetCatalogEntries = [
  {
    "id": "characters-character-48x48-01",
    "path": "characters/Character_48x48_01.png",
    "directory": "characters",
    "extension": ".png",
    "fileName": "Character_48x48_01.png",
    "sha256": "15eda7d8be8222d609a8000654c9482e510a77712b39fe2220bc3aa6e277c464",
    "width": 2688,
    "height": 1968
  },
  {
    "id": "characters-character-48x48-02",
    "path": "characters/Character_48x48_02.png",
    "directory": "characters",
    "extension": ".png",
    "fileName": "Character_48x48_02.png",
    "sha256": "20498f56b5303aac8f123d9733d9e9c8a3a5d1ef0877c6d31f0f90458e577333",
    "width": 2688,
    "height": 1968
  },
  {
    "id": "characters-character-48x48-03",
    "path": "characters/Character_48x48_03.png",
    "directory": "characters",
    "extension": ".png",
    "fileName": "Character_48x48_03.png",
    "sha256": "90069bcf84743909cc66fab1caead3a065bea12c9862f6067437a62aa1c124d6",
    "width": 2688,
    "height": 1968
  },
  {
    "id": "characters-character-48x48-04",
    "path": "characters/Character_48x48_04.png",
    "directory": "characters",
    "extension": ".png",
    "fileName": "Character_48x48_04.png",
    "sha256": "04f9ba832b584175671b5ca333a0a4cec909f6f56770139b42227d61bc65ae75",
    "width": 2688,
    "height": 1968
  },
  {
    "id": "characters-character-48x48-05",
    "path": "characters/Character_48x48_05.png",
    "directory": "characters",
    "extension": ".png",
    "fileName": "Character_48x48_05.png",
    "sha256": "b9ff6fd6c8c7b26ad298856fc24567127cb8fd7dedf1acc36e020fc03a15e82c",
    "width": 2688,
    "height": 1968
  },
  {
    "id": "floors-floors-1",
    "path": "floors/Floors_1.png",
    "directory": "floors",
    "extension": ".png",
    "fileName": "Floors_1.png",
    "sha256": "f67ea68ff69da5210d7c658d9bf8737df7c9caefe46f491ca8d7a954b25ccea5",
    "width": 512,
    "height": 384
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-angled-office-machine",
    "path": "furnitures/1_Modern_Office_Singles_48x48/angled-office-machine.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "angled-office-machine.png",
    "sha256": "dfe0b469f4327002e1f560ddc646244c12af14a0e35a6c144915aa2678228965",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-anglepoise-desk-lamp-left-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "anglepoise-desk-lamp-left-dark.png",
    "sha256": "ec26b381a6b0d9fe315a0081c65e5bf51c505cdd6f3d104c77f9e5ba2c1eb90e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-anglepoise-desk-lamp-left-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "anglepoise-desk-lamp-left-gray.png",
    "sha256": "7f6e671df56728174180a2383b6e7d1b29cd4628f21b84da7d298dc488ee7b16",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-anglepoise-desk-lamp-left-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-left-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "anglepoise-desk-lamp-left-light.png",
    "sha256": "8273b38092a5247f93c6b719923a3e4b7251ca125ff16339d1073c700f4a9aab",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-anglepoise-desk-lamp-right-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "anglepoise-desk-lamp-right-dark.png",
    "sha256": "64ef5443856f806e818a2b213465ff363cbd36bd59d9e79494b1862c58a0d49a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-anglepoise-desk-lamp-right-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "anglepoise-desk-lamp-right-gray.png",
    "sha256": "6dc378d86140287510e9b861eca98e759971b1dc0164e4d733d664bb99a71846",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-anglepoise-desk-lamp-right-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/anglepoise-desk-lamp-right-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "anglepoise-desk-lamp-right-light.png",
    "sha256": "088aba37149a7bb9cc7fca0599cd60590986c6a62d5d7c342b0c0f6e0e2cb53a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blank-whiteboard-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blank-whiteboard-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blank-whiteboard-wide.png",
    "sha256": "b99d649a8d3210e3e7b98f5dc58cfb43f15f1357a1de6d302564e85682a13511",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-screen-monitor-angled-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-angled-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-screen-monitor-angled-left.png",
    "sha256": "7c328194724573d222105b9b4bd41027a894d288db705f1c6a27a1b5c22c3744",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-screen-monitor-angled-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-angled-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-screen-monitor-angled-right.png",
    "sha256": "a0887cbc611111ea1c69509acca2340bc74f90e38e2cf3ac7f6e5213b5156aa0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-screen-monitor-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-screen-monitor-front.png",
    "sha256": "7d335d66e7eb00546c39bc03c7722056565b1c3e1cb3ebc1bd02afa081f21d14",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-screen-monitor-left-small",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-left-small.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-screen-monitor-left-small.png",
    "sha256": "304d95ac1198e1dabe3b5654b3ec0a62113c325274bff62dd56f7784ff2b7937",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-screen-monitor-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-screen-monitor-left.png",
    "sha256": "d22f7499112e711f8651a3801fe48695e8b5d72e3f2a3dea80dfe2f99450603f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-screen-monitor-on-stand",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-screen-monitor-on-stand.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-screen-monitor-on-stand.png",
    "sha256": "eae36db1c8e354fd10564d7edadc14c46cf0d385eed10f61bda5e2f6bfbad6b0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-wall-monitor-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-wall-monitor-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-wall-monitor-left.png",
    "sha256": "97f3fc217cd77f171b2682c142cbb3b76dbe6a2c4209d4aebdcaf63a6c2ce73d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-wall-monitor-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-wall-monitor-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-wall-monitor-right.png",
    "sha256": "91a3a8d9040e9b1e93266cccf7c4b9bf63a10c07453802ea9aa184a6e4a844f6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-blue-water-bottle",
    "path": "furnitures/1_Modern_Office_Singles_48x48/blue-water-bottle.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "blue-water-bottle.png",
    "sha256": "c2b1df3e3891ab414be018f8ee5cc71f7e827782159d4ecf7f80e069df9e1cb2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-compact-gray-laptop",
    "path": "furnitures/1_Modern_Office_Singles_48x48/compact-gray-laptop.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "compact-gray-laptop.png",
    "sha256": "b73979f1239e0d55237f75d88585cd3796774eb503ba1863cee9bb6e70da31c3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-compact-office-printer-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/compact-office-printer-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "compact-office-printer-front.png",
    "sha256": "fad09c35013bf3e53b8da88ccc983e4c13764e3aecc917bfcbaa1bc9d4e5185a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-compact-tower-server-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/compact-tower-server-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "compact-tower-server-light.png",
    "sha256": "3b26dfc5053c27c8415dda3a0a88e54d18048d09ff999b2f5ce5e277c7be64ea",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-compact-tower-server",
    "path": "furnitures/1_Modern_Office_Singles_48x48/compact-tower-server.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "compact-tower-server.png",
    "sha256": "bf8192c0440bae1ab612606df9bddff6c508d87b518ee8f1cbc272a24aea2eb1",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-computer-mouse-left-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/computer-mouse-left-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "computer-mouse-left-dark.png",
    "sha256": "6638625172c7487a1d6896d35458d2dda43ea244bbd53f0dc28d7a4bab8feee4",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-computer-mouse-left-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/computer-mouse-left-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "computer-mouse-left-light.png",
    "sha256": "491b8fcbc5b95e90377d28c0db5129e6ffc3d278d40ac55f76c8616bb5f1d23b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-computer-mouse-right-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/computer-mouse-right-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "computer-mouse-right-dark.png",
    "sha256": "9c2d2186f6a9a2d29450fdc599979355b182831bfe869fc269b41d78be3f7636",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-cubicle-partition-panel-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/cubicle-partition-panel-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "cubicle-partition-panel-wide.png",
    "sha256": "bd776449c991b109a6c1d7785998eeeef0685d947e9ea2772a544f9a4bc47262",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-cyan-water-bottle",
    "path": "furnitures/1_Modern_Office_Singles_48x48/cyan-water-bottle.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "cyan-water-bottle.png",
    "sha256": "52b7c89c1c5134a945dbca079337ca3d534c711b9554083bf448192725dfbbf6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-desk-lamp-with-paper-stack-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/desk-lamp-with-paper-stack-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "desk-lamp-with-paper-stack-dark.png",
    "sha256": "584d9a37d692facdee561e1be3e9c21ab36b683b2aa94ab3bada55c8df581f11",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-desk-lamp-with-paper-stack",
    "path": "furnitures/1_Modern_Office_Singles_48x48/desk-lamp-with-paper-stack.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "desk-lamp-with-paper-stack.png",
    "sha256": "81d62dd6cab9005d8304cce6ad53c083e26ec01f55f6781ea2b081b24e00a261",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-desktop-printer-station-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/desktop-printer-station-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "desktop-printer-station-gray.png",
    "sha256": "950bc625b3577634bd0d71e76525e51f5578c1f722f1ca57a7bb45a24bb5977b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-desktop-printer-station-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/desktop-printer-station-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "desktop-printer-station-light.png",
    "sha256": "98eb75e3c32ffdfe58680c0c30884ffbca73cff55789960db8735fd135b4afb9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-desktop-workstation-cluster-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/desktop-workstation-cluster-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "desktop-workstation-cluster-left.png",
    "sha256": "5579eb4e2c2af411d7bebd0c65a04a2085b33236aab353f833e0e30ab464fbf1",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-dual-monitor-workstation-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/dual-monitor-workstation-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "dual-monitor-workstation-wide.png",
    "sha256": "5fe1018834027042cb84f431b4fa98fd1c0d3fa3c24a9f70bfdf0c1c54627805",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-dual-screen-console-desk",
    "path": "furnitures/1_Modern_Office_Singles_48x48/dual-screen-console-desk.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "dual-screen-console-desk.png",
    "sha256": "27b0bb656dc8cd0987a671b27e093e1c3e54d1acac0c27351ac1d87c97897c14",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-emoji-reaction-board",
    "path": "furnitures/1_Modern_Office_Singles_48x48/emoji-reaction-board.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "emoji-reaction-board.png",
    "sha256": "daf93a61f4b779003a47f59153f0947d0fc88e0ffcf163d5abb80f3f136aec55",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-fax-printer-with-paper",
    "path": "furnitures/1_Modern_Office_Singles_48x48/fax-printer-with-paper.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "fax-printer-with-paper.png",
    "sha256": "0758099283270b8d73223042d063f33aa0769f9be5d13442b31d438615ce5567",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-glass-display-cabinet",
    "path": "furnitures/1_Modern_Office_Singles_48x48/glass-display-cabinet.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "glass-display-cabinet.png",
    "sha256": "f669e0a9ff6c6d880f5681f567ea9892d3f7cc14cda1f04445acb1dadf559f95",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-hanging-keypad-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "hanging-keypad-dark.png",
    "sha256": "b566cdff8a1b79365d92c293a6bddbf0490efd3295902e772176f06857bc6bfb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-hanging-keypad-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "hanging-keypad-left.png",
    "sha256": "74afa36ec10f061ddc659511aef88927439d29eabaa4b4c800d1195ce7034845",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-hanging-keypad-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "hanging-keypad-light.png",
    "sha256": "f1db38a07692e94e8bf9a8b38eab5594e2326e45cad6e008da2705b9fda31e8d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-hanging-keypad-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/hanging-keypad-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "hanging-keypad-right.png",
    "sha256": "3965516bc3e583c63b37b1b423a961282c0d3249215aa9fb0b1d58b00d0d4c60",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-large-wood-table-top",
    "path": "furnitures/1_Modern_Office_Singles_48x48/large-wood-table-top.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "large-wood-table-top.png",
    "sha256": "f43e271fae8a9f34c5c052403f6590d06fd86a20cfa6cedfd0156c07895a6599",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-large-wood-table-vertical",
    "path": "furnitures/1_Modern_Office_Singles_48x48/large-wood-table-vertical.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "large-wood-table-vertical.png",
    "sha256": "e9d0d9bf95443398c546999b8274d46ac35cd7ee888a565de343651b67ced5fd",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-low-desktop-printer",
    "path": "furnitures/1_Modern_Office_Singles_48x48/low-desktop-printer.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "low-desktop-printer.png",
    "sha256": "d0ddb8c2cd47e3a60ed52296a3257d747ba861df854f728cb72061684c05ede1",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-low-keyboard-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/low-keyboard-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "low-keyboard-dark.png",
    "sha256": "35df7746e7f0f28fd24b11381ff152318a43d5eb8da16a5cfab47cf3fdfac22e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-low-keyboard-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/low-keyboard-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "low-keyboard-light.png",
    "sha256": "335aba4d514db516c8e7e36181a5e4767f445aaca88244f6a0d8d06969048d36",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-low-storage-cabinet-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/low-storage-cabinet-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "low-storage-cabinet-gray.png",
    "sha256": "30c2b6d268df217aa65cf05226e7534b27eae3ba8a10b0412cd672b6e8a1910a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-low-storage-cabinet-wide-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/low-storage-cabinet-wide-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "low-storage-cabinet-wide-gray.png",
    "sha256": "fbde71014c34df59726f8d11e49823db33a6e825ff6620d6c0562757200976ba",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-angled-blue-dashboard-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-blue-dashboard-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-angled-blue-dashboard-panel.png",
    "sha256": "0ccee8ee9f02850d75a9d364e00162e9bce1914ea4fa33c14b13696fc01115bc",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-angled-green-dashboard-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-green-dashboard-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-angled-green-dashboard-panel.png",
    "sha256": "46b73385fecfde28befc3ecd33e8c596b29a6c8d225d4318c483dc3319de0c41",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-angled-orange-dashboard-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-orange-dashboard-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-angled-orange-dashboard-panel.png",
    "sha256": "8cea442551b3ceebf077a81c125fa715c98e40dd5c4753663b2e6ddc241c6b7b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-angled-red-dashboard-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-angled-red-dashboard-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-angled-red-dashboard-panel.png",
    "sha256": "a73276e32e40d5e01d531f5919b315f7bb1a3384acd1e6f3279254a7976d71be",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-cabinet-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-cabinet-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-cabinet-front.png",
    "sha256": "3f0f26c8072979efb519f2b171b39e8cccd9f8ed9f29591ce99d4dfbdace38ef",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-018",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-018.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-018.png",
    "sha256": "603ba4454e0cc873e7c80d5f54710f5821114dd158f149e56f336fa23d8a765d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-019",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-019.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-019.png",
    "sha256": "52d926e6610df8023fa451600db5aac4081d3764065d949f8d9162422d0619fd",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-020",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-020.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-020.png",
    "sha256": "56d54798357d26fa97a9f1c88a6fa0ef5c5be0ec2e4328b8142fc8476fff435b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-022",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-022.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-022.png",
    "sha256": "6085b58c55e641772fcc7ee3b48d1741cc31660e5dc7c478b5924f03b34c37ef",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-023",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-023.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-023.png",
    "sha256": "db1928b2eabdf7946e05925c2d03fd0779e8bf320f7bb35ed72362161a19d206",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-027",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-027.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-027.png",
    "sha256": "3b2705a791062951a04760d5497fdd7d6d0829bf094f32185e71e223a2fb8dc0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-028",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-028.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-028.png",
    "sha256": "f8edabfbf55db6474f9b688919bb222840ddb42162a4a5b3905009f1e73f8ef0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-029",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-029.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-029.png",
    "sha256": "c5a121604210902b2de3f4daaba309f1c9462ce74512451aa2e7901beacdb265",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-030",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-030.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-030.png",
    "sha256": "cc3770ca5d055875749ea84d945d73586956f0be9d606cdaf0302f2ad870a569",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-031",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-031.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-031.png",
    "sha256": "4faa6d966099a7c65059010d0b2b586dbcd3f7b6abec428b1a2f30114072c975",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-032",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-032.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-032.png",
    "sha256": "8b3313df26bd69908f536dbb092b30de259b9afaf84d0a4223e23607383177eb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-desk-module-033",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-desk-module-033.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-desk-module-033.png",
    "sha256": "f7ea8d697b87721e13329e3b2f308ebcfe6102ea6cdfe43899658602f01a88ee",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-001",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-001.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-001.png",
    "sha256": "a2273089a8c7ae5399cc3b56de5a5df5f92f73b2a183b11ef06aeb6ee562cded",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-002",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-002.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-002.png",
    "sha256": "a98dbdaec15cfb596ca51350d4aa856fbd395c3b2a0e59236462daad5fd65d90",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-003",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-003.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-003.png",
    "sha256": "d53cb56f151a977ed152df654730f4ead1a83f52859831f1a26ac6d9c592a430",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-012",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-012.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-012.png",
    "sha256": "9d27bb60e66027cf6e520299c216f9468c9ad1a9aa0e20bb855c6cc1dfc6b732",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-013",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-013.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-013.png",
    "sha256": "d1e0e9edc1e9594f42d6b46b74ac3cd09ee3f26e993350ea1ee93bf8b68c65fa",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-014",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-014.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-014.png",
    "sha256": "dd4fb7b19f1242b8aad6a8da783dce6d8148e21a5a2d47ddc858fea41adccb06",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-015",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-015.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-015.png",
    "sha256": "2e6ac2f2f28144725ea06c2e7edd3a094dace691f7bbffbaae798fa6661d47ce",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-office-surface-panel-016",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-office-surface-panel-016.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-office-surface-panel-016.png",
    "sha256": "10ad3b66b1a6c6a984e58562e94aee168dccd9111f2cf9084f3430bac842917e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-platform-corner-tall",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-corner-tall.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-platform-corner-tall.png",
    "sha256": "68338976936cc1f4402e2fd0e600022aadf383e49f6febacc9d69bbca399f60d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-platform-corner",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-corner.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-platform-corner.png",
    "sha256": "9e680d4cd2644d58ba34cffb15e451fdc64f80734c34a3790d3008863e133dcd",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-platform-front.png",
    "sha256": "ed34c1acb8a0fa90c522aaa986c9e905601ecea6fc38f8555a81b2a226150b38",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-beige-table-square",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-beige-table-square.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-beige-table-square.png",
    "sha256": "60847724e04ba9b5a5a459d948972b1f9cb9f0bf11cd637f97dc166d4133e51d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-black-metal-stand",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-black-metal-stand.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-black-metal-stand.png",
    "sha256": "ac85865bb10abb57b2cfe524f5f9427701ab02749e3d6f89e71db49dc3693bde",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-blue-dashboard-screen-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-blue-dashboard-screen-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-blue-dashboard-screen-left.png",
    "sha256": "d22f7499112e711f8651a3801fe48695e8b5d72e3f2a3dea80dfe2f99450603f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-blue-dashboard-screen-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-blue-dashboard-screen-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-blue-dashboard-screen-right.png",
    "sha256": "7c328194724573d222105b9b4bd41027a894d288db705f1c6a27a1b5c22c3744",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-brown-cabinet-panel-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-brown-cabinet-panel-left.png",
    "sha256": "b71ea78ab2f4326a2e3c94f4da9528d609b1e87282423ad2aac8e4ca690fa5cb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-brown-cabinet-panel-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-brown-cabinet-panel-side.png",
    "sha256": "ab349fe34936beb7b0feb407e63d0919b5085e8b7a22f3e3e79eeed71332ade8",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-brown-cabinet-panel-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-brown-cabinet-panel-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-brown-cabinet-panel-wide.png",
    "sha256": "7ce397e94058678247cb7d3bd9cdd16477121431307a9c4ddf5b793ccd07d7ad",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-compact-computer-terminal",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-computer-terminal.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-compact-computer-terminal.png",
    "sha256": "16fcbbe434d9ad2b18ce5795c34737bd6682710005147ad6b3f1b4b7c4cf44b9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-compact-safe-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-safe-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-compact-safe-front.png",
    "sha256": "bf1ad6d9d13edaca2f0cbb68c86dcad2e7b0dcfb8972b9d4c82525274a84e3bc",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-compact-wall-safe-closed",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-wall-safe-closed.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-compact-wall-safe-closed.png",
    "sha256": "c5fbf800e4be5915d5033b41c502652e7bd48766a74676a0badf2c652bde9c2f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-compact-wall-safe",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-compact-wall-safe.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-compact-wall-safe.png",
    "sha256": "fd0405660b8e620310578bd2e46cf6be5ed2223b137c11c87510c182822f9fde",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-corner-beige-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-beige-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-corner-beige-desk-front.png",
    "sha256": "50fd955e33525eabf2556fb9f7d3ed64961a22e0ecd2e25051174b8fafbc3f2f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-corner-beige-table-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-beige-table-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-corner-beige-table-front.png",
    "sha256": "b94dfa92204e3716a8da57902993059d2f92a406a423476ccfdb38966a3d8ce6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-corner-gray-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-gray-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-corner-gray-desk-front.png",
    "sha256": "b27fb242d2fdfcdbd2e52b28ef000a821ee881699c10ca60400f75a5c27e45a2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-corner-tan-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-tan-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-corner-tan-desk-front.png",
    "sha256": "47d01ec81466c544318a4ee99261e70b71a24ffe1d0175bf7ca31246ede9c336",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-corner-white-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-corner-white-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-corner-white-desk-front.png",
    "sha256": "e7cb390fd4fd91bab5760a5fce924670861a58fdf2eca2ac6b7be4394a34b182",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-cream-cabinet-panel-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-cream-cabinet-panel-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-cream-cabinet-panel-front.png",
    "sha256": "10a133e1806f048c9f61b520d7dabd68893cf158fbb89089bba30532c67ec503",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-cream-office-counter-module-052",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-cream-office-counter-module-052.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-cream-office-counter-module-052.png",
    "sha256": "d3f639826a397a6bef3fd3e12ea116658dacfae94497855ce19db5ef72506580",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-dark-gray-office-chair-back",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-office-chair-back.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-dark-gray-office-chair-back.png",
    "sha256": "30b4daf46262a5d67d6c4c5d7077248f937c456d47796cc643523029066d2b9e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-dark-gray-office-chair-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-office-chair-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-dark-gray-office-chair-front.png",
    "sha256": "7e6b72f06de1cfc455b406674e53e6c9e44ce291b86e982c9d417aef3383117f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-dark-gray-runtime-server-tower",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-gray-runtime-server-tower.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-dark-gray-runtime-server-tower.png",
    "sha256": "734efdaf3050411870b398a8d3050060c28e09f5e0d7a9ce81357ba542b1f34e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-dark-office-chair-side-alt",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-dark-office-chair-side-alt.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-dark-office-chair-side-alt.png",
    "sha256": "981674f2ff4b3d8c601391ebdd3a3d83777537bd286d6ab2e06702d395679de4",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-desk-phone-handset",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-desk-phone-handset.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-desk-phone-handset.png",
    "sha256": "8828578b8a9730b223f89bcd6ee7206bd52340a45c0e75d3cb307bdcc50bb4eb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-framed-task-poster-blue",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-blue.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-framed-task-poster-blue.png",
    "sha256": "f7982ef1a6e0cbd61386aefcc71a922e3ea0363f210a3205900ef6b0f95b1149",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-framed-task-poster-orange",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-orange.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-framed-task-poster-orange.png",
    "sha256": "23c6e9bada8827d378c3c79eefe91e55f56c4a8ffccec0fc8c7be8849e5ff9e2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-framed-task-poster-yellow",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-framed-task-poster-yellow.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-framed-task-poster-yellow.png",
    "sha256": "84bc5c7c9d254ed307affdd912da0875ae000b3f49c1be246853e54298fa0101",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gold-runtime-server-tower",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gold-runtime-server-tower.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gold-runtime-server-tower.png",
    "sha256": "c8105331295b997c4b48c91e96cf4115149f6bc84efcd06f1c2d4892a3a0f183",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-back",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-back.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-back.png",
    "sha256": "ab4f343659e78c63c60e380877a6fd607ae9dd9518a7d4b99088b6bcc4307502",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-front.png",
    "sha256": "205af0a27becb65d6d43c5c34369a95eddb8e1a2df4cb9c1ebcf1fbb046108e9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-left-alt",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-left-alt.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-left-alt.png",
    "sha256": "3644760a756f1abaa994e122bc6ccf6a74753c09805a490b7059f8cf4ef3c89c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-left.png",
    "sha256": "956a47581c7bce705292b4db747852d83cfab3179bb00527ed87d3eca34e7c1d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-right-alt",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-right-alt.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-right-alt.png",
    "sha256": "08f02e118f80a0bd20bfa21cdd5538c818d582cbe8669088ac77e7c46bbfbf91",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-right.png",
    "sha256": "ed6cb248aa17f777953006de616355a23366dbc80f2fb89f68241b22bdce0a22",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-side-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-side-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-side-left.png",
    "sha256": "dab93a381f631c7bffa3e0a003822d84d00d2196dc5edf7191f68c1b3ae4f172",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-chair-side-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-chair-side-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-chair-side-right.png",
    "sha256": "472f415419c6b86b00aea5cf22d64a0d16e2cecebe92e0bc3c99787c6dcd0e10",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-counter-module-051",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-counter-module-051.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-counter-module-051.png",
    "sha256": "a13c5d57de66ebdefb2dab3a7144dc098027963291c9802faf52c61d621c2da3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-floor-wall-tile-088",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-floor-wall-tile-088.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-floor-wall-tile-088.png",
    "sha256": "c0b6d88a9f75f8bbae0a318314e33f0848af8b9c51af33493cad583455f665bf",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-floor-wall-tile-091",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-floor-wall-tile-091.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-floor-wall-tile-091.png",
    "sha256": "fbceee70ded2c1d135adbcb1659b6cbbd99aba25efd6fee42d911453e5dbb637",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-surface-panel-004",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-004.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-surface-panel-004.png",
    "sha256": "ec669eabe1de9c15e4c39021135f1fe38e99386fabe0088c57867a356ee37bf3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-surface-panel-005",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-005.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-surface-panel-005.png",
    "sha256": "1f7c8b9e85278d44d785a496f618b547bf98223be6f863a57d3e890f8a81daea",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-surface-panel-006",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-006.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-surface-panel-006.png",
    "sha256": "d718bbdf468c721a425ccbd4cd1d509175bf6a5e47b552db1ce047b36d970e2a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-surface-panel-007",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-007.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-surface-panel-007.png",
    "sha256": "ae19f868f00fd4528cf766e8dbccafee711350df3a068cf3cd566a03f9c5c6bc",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-surface-panel-008",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-surface-panel-008.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-surface-panel-008.png",
    "sha256": "f2e1532368d3dc77e1466b832e35eaed591906f00ca5cb823058b9a4508d6d9e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-035",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-035.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-035.png",
    "sha256": "c6276a2f560075a4cf4aa311ef2d8da870e5afb410017d0a03c7448174d7922d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-036",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-036.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-036.png",
    "sha256": "a7a70a6bf209aab9777b62b963a1193374707c2e5dd181493eb87d41cd58b0cb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-037",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-037.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-037.png",
    "sha256": "7a2824bb092f393f85457f54a0b70b8e5ef1c081b2a1ff96adf7d6445ade694f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-038",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-038.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-038.png",
    "sha256": "05d2696984419716c91ee144457d7abafb6b6ab7e2fe664b42d0d395e13d5a8b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-039",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-039.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-039.png",
    "sha256": "0fdffbf23e93750ae36d5ddabf98988721662b7a3b9130a0f9973c87ec9c1ba1",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-040",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-040.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-040.png",
    "sha256": "20544c2392e5bff64d9fe74767d2822edc3e3444ab115d7b64f49a97edf195a9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-041",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-041.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-041.png",
    "sha256": "01bf2e742bbe8dfd680ca46d0fdd48708778544673a10f3a770a80f752d6ce80",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-042",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-042.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-042.png",
    "sha256": "5a3f295b7e6cdffa4fa00871c41680c5b0e7b4e08927e60c24671151d8ece4be",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-043",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-043.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-043.png",
    "sha256": "0f021c90002495f4961fbc89348cc8a39ef40a1dae399a6d9c86b8cb2fb10aa0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-044",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-044.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-044.png",
    "sha256": "f7956e0c0c7cbb858982716b7ebade9575cbf7076f72009d0599802498e32a46",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-045",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-045.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-045.png",
    "sha256": "789ca0e57f8dcdf30cba655d4596951600d0b4d6baad1bf74ee1e475c695766d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-046",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-046.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-046.png",
    "sha256": "586d248b5124a2149c84fe6066e67e6815c0944f64897a23b37bbedc4a6a352a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-047",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-047.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-047.png",
    "sha256": "c23c5d788caa3da822d44f10b8167aed9c7817d9dda210df0fed7788a596dd8b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-048",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-048.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-048.png",
    "sha256": "dd6f7c076656b05b12b355a420ca551dfc561b9a47b72f5bcb3582df4d01ed5a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-049",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-049.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-049.png",
    "sha256": "772faa0a4c4948c5f1ff57853ea1803e9984ed77a555659f8cb2f2f82e4bf380",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-office-wall-panel-050",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-office-wall-panel-050.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-office-wall-panel-050.png",
    "sha256": "fcaf405c7228d1bb02ab43f2bde34e46b4828756ac2122caf150456bb25a7fff",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-platform-corner",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-platform-corner.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-platform-corner.png",
    "sha256": "695945871627273801251183141e0aa503dc9179e531dcd1332a2a8dd0128e67",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-platform-front.png",
    "sha256": "a5aa56a0bd4651c15badf89444a7515245c3632f2fa825336f6c3939bc77c838",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-runtime-server-tower",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-runtime-server-tower.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-runtime-server-tower.png",
    "sha256": "6db726bc6584ca9c0c333e68abd109cb071d1394ec4672e0f9ac0d18a6d5de04",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-service-counter-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-service-counter-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-service-counter-front.png",
    "sha256": "c73a1c452a74bd53241098f6fb96a57b8ad8d28deb1387d05510a5296c8f2c1d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-service-counter-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-service-counter-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-service-counter-side.png",
    "sha256": "1d73bbb5c983c8ba43abdbd9ec9445a61929b89be489c804874a8a127a127741",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-storage-cabinet-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-storage-cabinet-left.png",
    "sha256": "f88345ae69294656467b3bd184ce03a84f92c3792e1d3f0ba9d2f49a06ef8066",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-storage-cabinet-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-storage-cabinet-side.png",
    "sha256": "ac18bcff838a0c66d2dba539b2cc1228ab80a8eed577cd601e6df3b15188d288",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-gray-storage-cabinet-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-gray-storage-cabinet-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-gray-storage-cabinet-wide.png",
    "sha256": "eab2bf4da30bb286a7d7984185c3de453fc3bd959841fd33997781ea58f5ceca",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-green-circuit-board-terminal",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-board-terminal.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-green-circuit-board-terminal.png",
    "sha256": "c48914be3c5778b7a95161916a044568b2afdd6b09978881af0e03581ba2ced9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-green-circuit-cluster",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-cluster.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-green-circuit-cluster.png",
    "sha256": "b2c038525d33fec2556c820c53879c6743603678e213bf688909d1bf0e44fbf4",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-green-circuit-server-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-green-circuit-server-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-green-circuit-server-panel.png",
    "sha256": "a15fa2fd1de82eefde2e3bf1cf823e52b4956e4095378c50adee2c66092d4b42",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-low-wood-service-counter",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-low-wood-service-counter.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-low-wood-service-counter.png",
    "sha256": "cf057a8104636dfaacad8d52d1cd9b028409480cca87828c77b450f84d9107ff",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-multi-monitor-control-station",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-control-station.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-multi-monitor-control-station.png",
    "sha256": "d98c69403143666e3e1d49b9619187c4d798b1ac7683f87726280fd47f207641",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-multi-monitor-station-with-base",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-multi-monitor-station-with-base.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-multi-monitor-station-with-base.png",
    "sha256": "769205ab48039dde983140b4fef51031dfb590f277477a4542ca162d721cf7a6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-narrow-beige-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-narrow-beige-panel.png",
    "sha256": "9a5a78b643bd60b5dd9c398aae98afa7c1e809f3574dd1c9255a57bbf395c67b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-narrow-beige-platform",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-platform.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-narrow-beige-platform.png",
    "sha256": "64fbb94acc528523711273cb09bd23f6564680af49fe3e4d4c7db9f8f374ee1d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-narrow-beige-table-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-beige-table-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-narrow-beige-table-panel.png",
    "sha256": "c8f150e301a691830c87684d92a703ce457246c9e3330a8b060677a9840439f6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-narrow-gray-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-gray-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-narrow-gray-panel.png",
    "sha256": "a72cc54368f3e8e72f637f841ed8c959f79154b4876c63a4e0dd6f85d07bcd1f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-narrow-tan-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-tan-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-narrow-tan-panel.png",
    "sha256": "c5366b3243eb33da4b1f4418b4bbbc4a3dd280905bae2904bea4e93279de017b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-narrow-tan-storage-cabinet",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-tan-storage-cabinet.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-narrow-tan-storage-cabinet.png",
    "sha256": "6e1a4333d24b98bfe1b914e7fe9a8edf6a38c2087b2e8d73afaa815bf7525048",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-narrow-white-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-narrow-white-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-narrow-white-panel.png",
    "sha256": "fe5c0edfb382859404071dbeaab556afceac6bb9308985020aaeb0e6f31139b9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-olive-office-floor-wall-tile-086",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-olive-office-floor-wall-tile-086.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-olive-office-floor-wall-tile-086.png",
    "sha256": "8f8750f7eca5860c750ba9493114a3be667431dcde4cd0fdabbbaece99111b2d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-olive-office-floor-wall-tile-089",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-olive-office-floor-wall-tile-089.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-olive-office-floor-wall-tile-089.png",
    "sha256": "fcfba8cfcb268e43cd4dad3a0bae27a6582bed14d9a2c3f16b9eaa4ce771e5b3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-back-alt",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-back-alt.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-back-alt.png",
    "sha256": "777d77f4f2fb7ab090fce6435514bf9ff2754f17e1fe9f704f94dd97d5c0f9d5",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-back",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-back.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-back.png",
    "sha256": "edda99ddeccb418bfb0d7ddcc75b3663e5a0eea5bd4ba96e4fb9b0ba186d320a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-front-alt",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-front-alt.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-front-alt.png",
    "sha256": "6feee6f010c0d4ea180badbf8cdf8b609f0663910cf8ae56110e0a69cd6a2518",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-front.png",
    "sha256": "c7a2123237bf3cb254169e16194ab0927dba95afafe14aeb6729dbe4fbd40c36",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-side-alt",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-alt.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-side-alt.png",
    "sha256": "56b3e4d8fa74c4ed9cecb17822384f108f48d786eb75a0f1018749d024480866",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-side-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-side-left.png",
    "sha256": "8bc6be496e8a02cd07d206aa38648e5c36e92fff6baf78fee1485f4690d7d9e6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-side-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-side-right.png",
    "sha256": "499551866218bb73a25fbd85e00929ee74cf986e83f744f2f8bdc887464e5601",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-office-chair-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-office-chair-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-office-chair-side.png",
    "sha256": "499551866218bb73a25fbd85e00929ee74cf986e83f744f2f8bdc887464e5601",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-orange-runtime-server-tower",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-orange-runtime-server-tower.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-orange-runtime-server-tower.png",
    "sha256": "145686a435fb33d3eeee065cbaf3cdf646d5d8439b6610050b2a1c57116f9635",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-red-office-floor-wall-tile-087",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-red-office-floor-wall-tile-087.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-red-office-floor-wall-tile-087.png",
    "sha256": "b19c255eb45c3b19b1c55f231f570395105f3c31a6dc9c3e5d49c1eef1d3d643",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-red-office-floor-wall-tile-090",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-red-office-floor-wall-tile-090.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-red-office-floor-wall-tile-090.png",
    "sha256": "4261136b964594df57753e01e575c13954073416433d36db41850ba0295336f9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-red-runtime-server-tower",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-red-runtime-server-tower.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-red-runtime-server-tower.png",
    "sha256": "5da2f79937226ee42e8b0b81ae94b7af26f36e05f13470593c4a22b6ad955942",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-server-cage-front-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-front-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-server-cage-front-side.png",
    "sha256": "6e4fbcdafb7ced3975bdda2a762f2e47ebe17bbe4602ce3453faa5ec4593cee3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-server-cage-side-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-side-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-server-cage-side-left.png",
    "sha256": "72ac33e291b9ade9d7fba2fbe33229c828a3e1a135bf674bba3be0bf5b1ed897",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-server-cage-side-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-server-cage-side-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-server-cage-side-right.png",
    "sha256": "7c8fe471aabdc00fc1c04020f36c96d700e41a6e59922279aff32c8b343bb683",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-silver-office-floor-wall-tile-092",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-092.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-silver-office-floor-wall-tile-092.png",
    "sha256": "43e633983f1b4da9dbe5fe9096b8d9a203295dcec94a47d2e9c4f1c5c91c1d07",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-silver-office-floor-wall-tile-093",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-093.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-silver-office-floor-wall-tile-093.png",
    "sha256": "3df29d388f5196900565e39b20012c1d9e62680fb31f79b1f440db118c26a835",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-silver-office-floor-wall-tile-094",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-094.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-silver-office-floor-wall-tile-094.png",
    "sha256": "95d5b577778ef169b3a6ec2a78f508efe4d83df274d823a926720b5c6b1a57b8",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-silver-office-floor-wall-tile-095",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-silver-office-floor-wall-tile-095.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-silver-office-floor-wall-tile-095.png",
    "sha256": "5839399a56f3b12846a2a4133ff990c5b4a292243b7c70dcb2428a7b52dc168e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-slim-office-plant",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-slim-office-plant.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-slim-office-plant.png",
    "sha256": "e424866696fae0de3c0244bd9a0e527ee8303ad3fb4c5dcd730680bdd31367b6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-beige-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-beige-desk-front.png",
    "sha256": "bda88769c4a57a7005ce991affbc6c290d114a80b2eea7ea5289e22698cd704c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-beige-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-beige-platform-front.png",
    "sha256": "d7d531c3471ecf56ba02bc8fe8b9d1a1a6a54749850dd9c76456b671a61997a6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-beige-platform-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-beige-platform-side.png",
    "sha256": "24c8cb02ee7e29c0afb64eee6802b3c5f97bd7c02a6a7a9a9546394fb698dee9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-beige-platform",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-platform.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-beige-platform.png",
    "sha256": "beb0c51dc03f14e8afe906cbeef9965a9126ad5cd859726a6aa78b7c5973b2f5",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-beige-tabletop",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-beige-tabletop.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-beige-tabletop.png",
    "sha256": "e0fd9be29f56347335abf8c426bd650821869b73939e76f32575ca40d0e50210",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-gray-cabinet-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-cabinet-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-gray-cabinet-front.png",
    "sha256": "00ed79502560b429599fd3fc7fcde14d453a13ebe7e34921e508ff179caa7b36",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-gray-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-gray-desk-front.png",
    "sha256": "f49faf89103b73014971af18597a73599a17c4c1bbdeca6ef31d20746c3d54a4",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-gray-platform",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-gray-platform.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-gray-platform.png",
    "sha256": "1ea401d1928ad771a14bbcc6e7601b35daec17ca7feb4648904f000f3f084aa5",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-office-device",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-device.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-office-device.png",
    "sha256": "c4bd8f2409ef929f31c355aa1ee3e54131d25fdce0138135409651ac71c37b91",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-office-plant",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-plant.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-office-plant.png",
    "sha256": "1052c877a77f7969fd70820de131e97fa724ef09812898d5e10c1b25d0250faf",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-office-terminal",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-office-terminal.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-office-terminal.png",
    "sha256": "8b906dc0ac8ccafd600d3d700d2d7c8333680e2edcde8fecc4f7a31268d9e981",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-printer-paper-tray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-paper-tray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-printer-paper-tray.png",
    "sha256": "87e94af4c32d78a482119cd65f08acbdc506488a79cdab5f432ca5a6f051af99",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-printer-scanner",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-scanner.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-printer-scanner.png",
    "sha256": "fa32a73c567c60b1cf782486d6f1bbc6b0d1c8dbd93250070f05587604894d63",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-printer-with-paper",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-printer-with-paper.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-printer-with-paper.png",
    "sha256": "465e7c1b67f212128a8f4de547e0c0c1d85ce5a05bf228ffaba7ed158dc3128d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-tan-cabinet-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-cabinet-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-tan-cabinet-front.png",
    "sha256": "fb3ac3b5d0c4c1d000029ee568663da8f1eacd1ddf8e38b0d6ab1573605dc943",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-tan-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-tan-desk-front.png",
    "sha256": "a34d5c1c8e2b273164982d42791360da50d6394038cd5eaddf99fca138ebf2eb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-tan-platform",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-platform.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-tan-platform.png",
    "sha256": "388088d66988fd582346d5c48d0866722929d4e8c2eba1d64bf23aff2d8c6245",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-tan-service-desk",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-tan-service-desk.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-tan-service-desk.png",
    "sha256": "2786474fffc43cd221e71ba2b5ab1526dce9edb89723abda5e4eb4d2b4d14aef",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-white-cabinet-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-cabinet-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-white-cabinet-front.png",
    "sha256": "a438e15679f274f3bfe55f54a8bdcffd5fba710fb2f86e4078b2245490d28f62",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-white-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-white-desk-front.png",
    "sha256": "cd741887c394f8dab08059a9b824051a28df17ee5b8a72e62ba530014d6c6ac2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-small-white-platform",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-small-white-platform.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-small-white-platform.png",
    "sha256": "5416bd95452b9eca0f8eec00c63dd3b3543072f526ac32a51498788fb39bb551",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tall-beige-platform-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-beige-platform-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tall-beige-platform-panel.png",
    "sha256": "c15dc83ce7b55f36af83bf8b680caa97aff72fdb156e9b80f42f6cca8dafe1ab",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tall-cream-storage-cabinet",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-cream-storage-cabinet.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tall-cream-storage-cabinet.png",
    "sha256": "9d213a7723378d419c557ed5bfb30f70483df585e921a9caa5d626a63b9fa62a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tall-gray-platform-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-gray-platform-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tall-gray-platform-panel.png",
    "sha256": "5dd5fc89dfceab62f2e39d6a5b1960c07a9b74f3d3e2db5c112b58883900c1e2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tall-office-plant",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-office-plant.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tall-office-plant.png",
    "sha256": "e759126af4fb83b3880ee4d7070e151bb47d7b6c47bee1245ee31ba8661d4c4e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tall-tan-platform-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-tan-platform-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tall-tan-platform-panel.png",
    "sha256": "cc61e1fca873025417f3be2a1a4150916288c84f151c462f67d81f3cc2adfc9b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tall-tan-storage-cabinet",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-tan-storage-cabinet.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tall-tan-storage-cabinet.png",
    "sha256": "813676059a5cddfe26f4b9207aaa6b36ee443327a87556bde1fa9762c465b8a2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tall-white-platform-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tall-white-platform-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tall-white-platform-panel.png",
    "sha256": "b2b6a3379b57b9fcff02d18061296d0a5808097e771f86e15f3ec9197d3ca8ce",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-cabinet-panel-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-cabinet-panel-left.png",
    "sha256": "3d4e7ac21ee11fbe4cb0a09ac2d405a219099de5e6bd45399a3cee8e1c6a0a92",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-cabinet-panel-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-cabinet-panel-side.png",
    "sha256": "8eb4512e0aba22992c1158fd0025897b6c49de0e405cad19df82e83f1c010d0d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-cabinet-panel-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-cabinet-panel-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-cabinet-panel-wide.png",
    "sha256": "9c4355bfba4d20ff3b92003338031cb8d8840d573e7b745bc22a095f44c38a7e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-053",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-053.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-053.png",
    "sha256": "88e15cf16eb2fe827f27e852b2190c231624dd74b7a4d9e7c8870ffde6c40aa2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-054",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-054.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-054.png",
    "sha256": "1cb1e417bf95804e9eb49ea14744b7956db2aaea2edffd7de0a1bb2b5e3f8c3f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-055",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-055.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-055.png",
    "sha256": "a620a49901d6ac49814511454e87fc18beb85685e39feabd5fa2b5f033f08b74",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-056",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-056.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-056.png",
    "sha256": "f4a8be56e83c000218345da45f145efb595f3a6c23ad9da79bcb8832ffa8eaf6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-057",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-057.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-057.png",
    "sha256": "625af2615a42122df381803c0e85f8fec2dc9e08da0c9c7a5712629a76c91c9c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-058",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-058.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-058.png",
    "sha256": "a925ee5fc7641308313fd760a9e8784d4e70a428bd8e2b2a43f54379e55a2fa5",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-059",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-059.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-059.png",
    "sha256": "0cc8a61bc4c51a779d71e49012f746c96d1ea0ac8c2357626ead32be122db0d3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-060",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-060.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-060.png",
    "sha256": "3d70fc4c18251c90aade52f0e31254c629845a85a7b3b6915ba38042d6ce7453",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-061",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-061.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-061.png",
    "sha256": "059e40f896c1843c1f92d317c6bc8962ce3bffcb41f100ca606643107cd20131",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-062",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-062.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-062.png",
    "sha256": "b43cb57fc2a6d8c142a9bbcdef36d9efbfc83ba1c64ddb0a5a1ee695cbea1e42",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-063",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-063.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-063.png",
    "sha256": "1e3592dc3a7d0811e24529272c487d5bc75812c2edccaec1dd4cb6be4bdabcf3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-064",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-064.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-064.png",
    "sha256": "cba7498058a470c379517c91d25825e7d27151e74cb37305580fd5497694ba67",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-065",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-065.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-065.png",
    "sha256": "1d8673ff2d0ab5f51727ba6311621b0e074ec8764423e845a224d5e668a826d9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-066",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-066.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-066.png",
    "sha256": "51967de42f4181806ff90862c788ffba083421cb7094813d2988d4049cc5c957",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-067",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-067.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-067.png",
    "sha256": "df8d67cbd9d15cc4b5d855e9c5833c3ebf05cbbbf6a36ea76ae439e95c121439",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-counter-module-068",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-counter-module-068.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-counter-module-068.png",
    "sha256": "5810c17a5ffc10962519967ec14109fbde1c582c45356cda6d5e02ab057ea4ec",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-desk-module-017",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-017.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-desk-module-017.png",
    "sha256": "5ca294b3af6aef9c0485afbd4db5432ca7bb1c674e7d262c0f40e56dcfb83282",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-desk-module-021",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-021.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-desk-module-021.png",
    "sha256": "99423fe185d7d5f97c5edbfd56c31f794f67e0d726dc6686e39997b8cbc08624",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-desk-module-024",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-024.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-desk-module-024.png",
    "sha256": "44d3b66944f50af671d80dc7480f4d76034a7fb70f41c151051b977f7f492008",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-desk-module-025",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-025.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-desk-module-025.png",
    "sha256": "88a4a59beeadd1903258b746dcbc878672aefd71199da82ffa77023cb0717ae0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-desk-module-034",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-desk-module-034.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-desk-module-034.png",
    "sha256": "93f93b474353d7f76a68672ceb814ff7c0a4fc9dd1e90d60f901ce2adcff28b1",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-partition-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-partition-panel.png",
    "sha256": "5d70df3ede37ee73e870c7812a78251fa5dfa4028f60015f9aafce842ec24855",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-partition-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-partition-side.png",
    "sha256": "e637de28885b3bbed115800272b12430e546e78d8b6c4d217d68d170973b9542",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-office-partition-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-office-partition-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-office-partition-wide.png",
    "sha256": "6c744ceabcd300ad17b5205661d6acde7febff4da9bba6e6480848222a96e0ee",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-platform-corner",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-platform-corner.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-platform-corner.png",
    "sha256": "983130a154baf27c1be3a45656f58641f1645bfba7ec9f094a049927e95519dc",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-platform-front.png",
    "sha256": "1262a8485346a1f82cb23eac844914af18f1cf9072fb647a4ba3bdf80923f86b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-privacy-screen-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-privacy-screen-left.png",
    "sha256": "0c0afd69b2a082777cc33160aa2946f4a6c18244520f9651c12fd1e92b1fa33c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-privacy-screen-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-privacy-screen-side.png",
    "sha256": "39583e59d59b8453561360f402f0eb6ef9c8818761e026ce2e38dc6b3cd604d2",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-tan-privacy-screen-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-tan-privacy-screen-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-tan-privacy-screen-wide.png",
    "sha256": "a93b7ebbd406a5dae3472ff3b3df152e23ebfac12aebd4eaac0568d21f9c8503",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-thin-metal-pole",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-thin-metal-pole.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-thin-metal-pole.png",
    "sha256": "1e42e1a5d45b4322732a6b55127c7355974a763c7bd91949adb985ca46db7897",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-thin-utility-stand",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-thin-utility-stand.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-thin-utility-stand.png",
    "sha256": "e7f57c876dd1c85d7875763c656b42a692a4ddb6edb54367b5cce3aae2b486af",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wall-chart-blueprint",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wall-chart-blueprint.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wall-chart-blueprint.png",
    "sha256": "9736d0ef827462b7fb5d8d0a633a0bacc33db31770f339b7760bb17e2cc0bd73",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wall-chart-orange-plan",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wall-chart-orange-plan.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wall-chart-orange-plan.png",
    "sha256": "f764220c2c9078675e8bd0cc3589a179ec719982ba36094ec90845f7ba958d8c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-026",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-026.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-026.png",
    "sha256": "4fa3b8423c7777bcea29d0ca2ad755c802add3616eb36c0036070e8c5518f954",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-069",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-069.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-069.png",
    "sha256": "5d456defd390c63e7081bb7185edf2e75933e5f85e78ba4839b97710501bd82b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-070",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-070.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-070.png",
    "sha256": "1379a96b05231cbbb58005086c0a0b7540e0b7432cf0304b656c6a1f0ec40cc8",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-071",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-071.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-071.png",
    "sha256": "036e2dabb389a1c748cd7b346953022ff4782ddb81807965ca7d734e6b4c61e3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-072",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-072.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-072.png",
    "sha256": "2b19b2092b4f606190b4f14972e97f34c004a2c16e46f05120f9b8fd6adce360",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-073",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-073.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-073.png",
    "sha256": "6980905ac7125499ad5dfb5e13dcb6a5012ded1eebcc9c0ec9425309b7feeb58",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-074",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-074.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-074.png",
    "sha256": "746fe12771def90301c6f33b7dbb0132b5825fb8f0b2c1753cc57e4897a78569",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-075",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-075.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-075.png",
    "sha256": "953b98c614f5cd1356ef410cf38e0e9f52492f6e9e67aa4f14bf6a6387d3d659",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-076",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-076.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-076.png",
    "sha256": "d4132e602b63ba97bcb1f2c4ad869596e6dcc675003ada1254eea3971b1472ef",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-077",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-077.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-077.png",
    "sha256": "3fcf10ba64114f8e2d9348e9e5b9c4e1391c17ded16d52eb97c42fb321c52be1",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-078",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-078.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-078.png",
    "sha256": "0eb44a023a622c6c51b254450277d4148ab40452242619ee1cc87349883f5105",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-079",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-079.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-079.png",
    "sha256": "39e63c87a5b96047cf98a9a1f2704b3c1263bafb675173e2022dbe638ffc87c0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-080",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-080.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-080.png",
    "sha256": "91ae9957e47a544a1a0030858caa29f238e8b37fdd7a20f562c8d19022ac1a3f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-081",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-081.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-081.png",
    "sha256": "a59c27c57ef169af0b378ad5523a1cbef14529495e0750b20d2ce089e0bd7844",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-082",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-082.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-082.png",
    "sha256": "3cbfeda59a3c023edd6590deb49edec7a29fd028ba7685d032339b9cd4df97c3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-083",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-083.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-083.png",
    "sha256": "3e9bcb301802726e1a5c816b6ec7fcb097eb9f606fa87cc2914451f39d1c7c8a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-084",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-084.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-084.png",
    "sha256": "486e2a02f90493705819932435ed6e0c1c740e1bb57037c0159430c7c5afce62",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-office-desk-module-085",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-office-desk-module-085.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-office-desk-module-085.png",
    "sha256": "6313ff0792086169d0f64d98fc771dd1296506ba69edf28bdbe972919315c236",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-paper-stack",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-paper-stack.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-paper-stack.png",
    "sha256": "4cfa98b4ba82feb1bb94beb80fe5245281fb9800a965762ee5a6cf9a323485bb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-platform-corner",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-platform-corner.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-platform-corner.png",
    "sha256": "2412acd2de38cfa30fb5cdfe321c403566287d447fbaab5a9c2938dad9f690ca",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-platform-front.png",
    "sha256": "d4ce0aab34eed1150e8905f0cae62004df6d8403961d134940dd6ac83bd6a96a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-storage-cabinet-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-storage-cabinet-left.png",
    "sha256": "c19251b45db1cb4fc01b4731f41cce5c8371884f827dcc919eba84655f2b34ac",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-storage-cabinet-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-storage-cabinet-side.png",
    "sha256": "e0b899b7c8f34dcdcf18d26bd6b75677df36db07b70b6ab3ecd5d8409419e6f8",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-white-storage-cabinet-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-white-storage-cabinet-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-white-storage-cabinet-wide.png",
    "sha256": "ea18a896c1293ebe02e30ce708d0fac21ff6ad7956abfe9005e4b9ceca69a91b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-beige-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-beige-desk-front.png",
    "sha256": "2d5907ae08127035bfc1b2941b4005b5e34988c6ffe3326373702d50fad9ec7d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-beige-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-beige-platform-front.png",
    "sha256": "6a2b76c50888523336b7410a914001cba9fda56653b5fb34cdfd07c63e60f20f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-beige-platform-with-drawer",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-platform-with-drawer.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-beige-platform-with-drawer.png",
    "sha256": "49be379c01795397f4ef7938145da29906726fb74b3ee4982802b7986dc7c23c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-beige-table-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-beige-table-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-beige-table-front.png",
    "sha256": "f258a4194c55a913fdb4e22ce3721f41d5b3da8c90d9abe55e9541c067c62feb",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-gray-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-gray-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-gray-desk-front.png",
    "sha256": "f19e1d2c70455ad9cd26e638f312ee2582cabc90cac7ac0734f31ff9b5f421b3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-gray-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-gray-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-gray-platform-front.png",
    "sha256": "fdcb7b0bd82732cc727ae4187898cb3a4976153751630706214813a295653541",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-server-cage-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-server-cage-front.png",
    "sha256": "102be3cb6f59315791a7ec6724bdcd54a9cb02f864278aabf54c4efee63fed1a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-server-cage-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-server-cage-left.png",
    "sha256": "bc81bb5b611e85b6da28174466f81157940ccba013b1408760b0e1192ba7938b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-server-cage-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-server-cage-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-server-cage-right.png",
    "sha256": "516819b38d77173318edd1e44d5f549d2011361c3143558f4a702be9e0762b05",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-tan-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-tan-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-tan-desk-front.png",
    "sha256": "d681d2fd54bfc78a12a3a88b6099099ee4ed97b09da111b024a8375be31940a0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-tan-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-tan-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-tan-platform-front.png",
    "sha256": "10cb59161313d75a0949b0b757b2d12bfe79b992e8839bc690f24865b26cc53b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-white-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-white-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-white-desk-front.png",
    "sha256": "4a961ee32034ae975ee877966a274697516278d66279f644b76abb6fc8f2b2f7",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-white-platform-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-white-platform-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-white-platform-front.png",
    "sha256": "023a674a2dcec24a1e2627758c6d6e89364eac443165faa881018167836f4879",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wide-whiteboard-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wide-whiteboard-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wide-whiteboard-panel.png",
    "sha256": "d09e0f79ea368c9f1d43a5fe5bd1e540674845b66b4aebcf37c11573b01f5a5a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wood-drawer-cabinet-tall",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-drawer-cabinet-tall.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wood-drawer-cabinet-tall.png",
    "sha256": "b2479274c6d36f5c8965da5cd5abdaf373bceb7d3d38e0f686cfb5a07bae1b1a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wood-drawer-cabinet-wide",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-drawer-cabinet-wide.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wood-drawer-cabinet-wide.png",
    "sha256": "ecfea6d709e21656c077677f25d842beeb0cb5cbdaafa3033842a34d40736096",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wood-office-surface-panel-009",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-009.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wood-office-surface-panel-009.png",
    "sha256": "9ebee58bb649a6efe05297677428ca8eb40dc8491c9d16d472366b04238dd55c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wood-office-surface-panel-010",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-010.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wood-office-surface-panel-010.png",
    "sha256": "46653657f482db2d05740f414a7a4c4e462643b61e85e8b423175b10e997626f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-wood-office-surface-panel-011",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-wood-office-surface-panel-011.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-wood-office-surface-panel-011.png",
    "sha256": "315626737872437b0fa44aadad3c3874bb33b43a8f2b66c2b995ad336df8d8b3",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-modern-office-yellow-runtime-server-tower",
    "path": "furnitures/1_Modern_Office_Singles_48x48/modern-office-yellow-runtime-server-tower.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "modern-office-yellow-runtime-server-tower.png",
    "sha256": "9dd057fb3c7d5936685f2fdbf0d69b46bc8ad74750fe8a9569fa5cd3dff7a176",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-monitor-and-terminal-cluster",
    "path": "furnitures/1_Modern_Office_Singles_48x48/monitor-and-terminal-cluster.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "monitor-and-terminal-cluster.png",
    "sha256": "3a2f12df6819744eedf603f08a3ee7cd4ad204fda171a34d951563dcac4d673f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-monitor-on-stand-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/monitor-on-stand-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "monitor-on-stand-dark.png",
    "sha256": "bd80976401620569dfe5958c99f86261599d153b2d18d53b972d66091b82593e",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-monitor-on-stand-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/monitor-on-stand-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "monitor-on-stand-light.png",
    "sha256": "ee67f1c0e11afb6833bcda9fd6f0ae487fd87da29aa772afcf336f3956a386dc",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-narrow-storage-cabinet-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/narrow-storage-cabinet-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "narrow-storage-cabinet-gray.png",
    "sha256": "8354ccf2a9ceb05e6ea247f41c9ba6a0dd37aec4635994169dffab74883ccef6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-narrow-wood-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/narrow-wood-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "narrow-wood-desk-front.png",
    "sha256": "08956b19514e1d0e0d307065d37a73ca420d9deced165d0de863db08dcbc9b02",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-chair-front-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-chair-front-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-chair-front-gray.png",
    "sha256": "b8a7865f4b01fb512c12bb9dedc2f1f2dd4127ffdcb4a59abf1e9d6411c96b58",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-chair-front-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-chair-front-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-chair-front-light.png",
    "sha256": "d93eac7a5123ad438cbb21b7d0655e6c52d8b0fb1a579f0d5ffbe2c09e379082",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-chair-front-tan",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-chair-front-tan.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-chair-front-tan.png",
    "sha256": "9768dd65229bb5e8146c8880d29e00501ec4449acccc540e78a01f5374e26f1c",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-chair-front-white",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-chair-front-white.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-chair-front-white.png",
    "sha256": "0cd5cd065671292511f5de2e9f6c08ee0c707609af7b14e8fc07acfc4c203ef7",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-printer-front-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-printer-front-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-printer-front-gray.png",
    "sha256": "71874235edf45d538718927b846ab122a6667a78d4716c05933febe0f49cd5a8",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-printer-front-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-printer-front-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-printer-front-light.png",
    "sha256": "7df1f210a952a75e56c061176ffb6922d5ba0adebe883e0c653b8db60886667b",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-printer-with-output-tray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-printer-with-output-tray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-printer-with-output-tray.png",
    "sha256": "eb733da68db74fe75fa59556abda5a31a02085b610a0993b47daef97d5b125ee",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-printer-with-paper-stack",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-printer-with-paper-stack.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-printer-with-paper-stack.png",
    "sha256": "fc75295b029fb73088a0542456f8354b2221df96ac69ef03c8e2287a817d0c09",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-office-water-cooler",
    "path": "furnitures/1_Modern_Office_Singles_48x48/office-water-cooler.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "office-water-cooler.png",
    "sha256": "81c04caf4c19f25b8bf229c632cb749cd26fbc7c78830b89688c7ea98375dd22",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-operator-chair-with-monitor-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/operator-chair-with-monitor-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "operator-chair-with-monitor-left.png",
    "sha256": "ecaa9a707c71edde860a6701817462fe03d0f6913fb8185a604f8baa1f85d102",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-operator-chair-with-monitor-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/operator-chair-with-monitor-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "operator-chair-with-monitor-right.png",
    "sha256": "326a2e0ac4a76a5cc3ab38b7bf1e9ef33df28d6a911197c8da088f971acf1426",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-paper-stack-angled",
    "path": "furnitures/1_Modern_Office_Singles_48x48/paper-stack-angled.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "paper-stack-angled.png",
    "sha256": "4def874468bb06e93745866c52752effce785ba3bfd1ed30dd0ab8d8b4d10259",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-paper-stack-large-angled",
    "path": "furnitures/1_Modern_Office_Singles_48x48/paper-stack-large-angled.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "paper-stack-large-angled.png",
    "sha256": "38d5566b96c3a1ffa7400ddc0f7adf0bf1a83130c7a991d12968fc0968fd5804",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-planning-whiteboard-chart",
    "path": "furnitures/1_Modern_Office_Singles_48x48/planning-whiteboard-chart.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "planning-whiteboard-chart.png",
    "sha256": "a963975d8964221d4bc4a3fb827f2ae56eca4147a70734189a8bdda228e47338",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-and-monitor-station",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-and-monitor-station.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-and-monitor-station.png",
    "sha256": "9258b12b9ba673092ab7f7fc3be38b00ba6c2a2ba6e7fcc82c31881248ee0cd7",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-monitor-cluster",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-monitor-cluster.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-monitor-cluster.png",
    "sha256": "427fc76074070cbc402ac82924a0a4ea59e35f281f71157749b2e1680c623f94",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-workbench-blue",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-workbench-blue.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-workbench-blue.png",
    "sha256": "97bb8754ff516fb739f7a01ed3abe5ff42e20bc1f9b7ca35ef11ab26007da800",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-workbench-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-workbench-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-workbench-gray.png",
    "sha256": "882c23b91c7af927b87fa5d1921f6ec32c42ce8774ccbbe3e55c418f03513cbd",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-workbench-light-blue",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-workbench-light-blue.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-workbench-light-blue.png",
    "sha256": "fd2554974e7d76a40c80fe03ce8144c9ae943f89c862c8c119c032e523bb8301",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-workbench-orange",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-workbench-orange.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-workbench-orange.png",
    "sha256": "d33c7662f6ef1b068c2957efe17a684397db9bb89ba9402f926346b27da617c7",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-workbench-purple",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-workbench-purple.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-workbench-purple.png",
    "sha256": "47db1a66bd92c920ed36cbcf2a5882effe92d6c4fa60a05099d8499be4ecf2fe",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-printer-workbench-white",
    "path": "furnitures/1_Modern_Office_Singles_48x48/printer-workbench-white.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "printer-workbench-white.png",
    "sha256": "5f07fe41c3f37b26961373ff70f32df37766f4d6816a81d7fc63a7c1d912ba92",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-rolling-office-chair-side",
    "path": "furnitures/1_Modern_Office_Singles_48x48/rolling-office-chair-side.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "rolling-office-chair-side.png",
    "sha256": "472f415419c6b86b00aea5cf22d64a0d16e2cecebe92e0bc3c99787c6dcd0e10",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-server-cart-with-cables-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "server-cart-with-cables-front.png",
    "sha256": "149890f13cfd801845f787d1af5361f205e404275ac06c5dd8222606037a0838",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-server-cart-with-cables-left",
    "path": "furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-left.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "server-cart-with-cables-left.png",
    "sha256": "a4b513086ba729f87b3103a48af33a7ccab2c290e75748d7a084b9df2e603051",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-server-cart-with-cables-right",
    "path": "furnitures/1_Modern_Office_Singles_48x48/server-cart-with-cables-right.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "server-cart-with-cables-right.png",
    "sha256": "89e4eea3864fcfb18a677c5efcd3ed2d0a6c8f1b4f91a8fa18d453c29f2cf63d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-server-workbench-with-tools-orange",
    "path": "furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools-orange.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "server-workbench-with-tools-orange.png",
    "sha256": "4e0fd1c603150f5586b86e907eb88d15c4bc57a6d0dac22ca3a214470d002059",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-server-workbench-with-tools-red",
    "path": "furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools-red.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "server-workbench-with-tools-red.png",
    "sha256": "cca03539ee1ebf1b6f58092fe6b059de3610bd6a7fab4496aa8c0d2f2df232da",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-server-workbench-with-tools",
    "path": "furnitures/1_Modern_Office_Singles_48x48/server-workbench-with-tools.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "server-workbench-with-tools.png",
    "sha256": "317dea6b34618365781a59fbca622c9fd2525420c943a4c457ac5b5b7dd0f3ee",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-single-monitor-left-dark",
    "path": "furnitures/1_Modern_Office_Singles_48x48/single-monitor-left-dark.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "single-monitor-left-dark.png",
    "sha256": "e2b405221bee12194ed2a7cc7fbf0bf8c9354e8d2de56709f6ed0108ace0e4cd",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-single-monitor-left-light",
    "path": "furnitures/1_Modern_Office_Singles_48x48/single-monitor-left-light.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "single-monitor-left-light.png",
    "sha256": "35a210b2ece03dd998eebd8d2315d7b0e90b88acc994aa1c9866edc8424f96d0",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-single-paper-sheet-angled",
    "path": "furnitures/1_Modern_Office_Singles_48x48/single-paper-sheet-angled.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "single-paper-sheet-angled.png",
    "sha256": "8ee115a785e4880c129eb0d694a1d2510515e2b35f336ff0c2da4d87745ad5de",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-small-floor-cabinet-gray",
    "path": "furnitures/1_Modern_Office_Singles_48x48/small-floor-cabinet-gray.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "small-floor-cabinet-gray.png",
    "sha256": "211ba006371f8ae1a07666d9af8a60dd968204a04a9f25b84c3abc769866f6ea",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-small-framed-wall-screen",
    "path": "furnitures/1_Modern_Office_Singles_48x48/small-framed-wall-screen.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "small-framed-wall-screen.png",
    "sha256": "2260d419a6a9e9b8fa93095d34e2dbab0612545a6bad15bc28fb501fe236896f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-small-wall-control-panel-yellow",
    "path": "furnitures/1_Modern_Office_Singles_48x48/small-wall-control-panel-yellow.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "small-wall-control-panel-yellow.png",
    "sha256": "daa2dc7685a0bb6a7d98a6b705b5d8e6ac5cfea1b3fe5631e6fb4de5a32c038f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-small-wall-control-panel",
    "path": "furnitures/1_Modern_Office_Singles_48x48/small-wall-control-panel.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "small-wall-control-panel.png",
    "sha256": "055ddba9690f530163756570741fa6c6f30ab6ef19061d5e21de0a0c2027f232",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-small-whiteboard-chart",
    "path": "furnitures/1_Modern_Office_Singles_48x48/small-whiteboard-chart.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "small-whiteboard-chart.png",
    "sha256": "39ae5a7277dbce41d0cbd40436976b792aaed4a4770828226dd797b41517768d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-small-wood-table-top",
    "path": "furnitures/1_Modern_Office_Singles_48x48/small-wood-table-top.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "small-wood-table-top.png",
    "sha256": "5879d6b93e6cfaa7bc99140ff32a7d91f76aaad4366d48e41744bbfd2c93f67d",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-small-yellow-wall-notice",
    "path": "furnitures/1_Modern_Office_Singles_48x48/small-yellow-wall-notice.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "small-yellow-wall-notice.png",
    "sha256": "3c9734cc7562a9b8b18ea98d0fc878f24b0d9093edaa900579e559d4f8dfbf6f",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-standing-desk-lamp-yellow",
    "path": "furnitures/1_Modern_Office_Singles_48x48/standing-desk-lamp-yellow.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "standing-desk-lamp-yellow.png",
    "sha256": "a46ccff7e74bffd62efe10317d9591d80705eea469a96bd27bd4695c7eb352c9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-tall-cabinet-with-posters",
    "path": "furnitures/1_Modern_Office_Singles_48x48/tall-cabinet-with-posters.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "tall-cabinet-with-posters.png",
    "sha256": "c995fce4ebcf450044528966650d071cedde6ff7f110f51e6a1190c21d9ab532",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-tall-control-server-rack",
    "path": "furnitures/1_Modern_Office_Singles_48x48/tall-control-server-rack.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "tall-control-server-rack.png",
    "sha256": "09cb8eda702ec4a34f9a855c5e28ac7aca1c85b0b3b8b8779b7ad2065dbdb2ce",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-tall-network-server-rack",
    "path": "furnitures/1_Modern_Office_Singles_48x48/tall-network-server-rack.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "tall-network-server-rack.png",
    "sha256": "2057434f69d72d28a57efaec57dc6b97be4d21936b1cc69b914085ca839c146a",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-tall-paper-stack",
    "path": "furnitures/1_Modern_Office_Singles_48x48/tall-paper-stack.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "tall-paper-stack.png",
    "sha256": "a7495290f133a559dd8a6c7edbb1008a4c084567e6af2cf99bbdc458f4c1d9b5",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-tall-wood-table-top",
    "path": "furnitures/1_Modern_Office_Singles_48x48/tall-wood-table-top.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "tall-wood-table-top.png",
    "sha256": "dc82e80e0060e19e5b81d629cb151cb098b0c61e2d0577d7b9c836f9e065dc41",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-tower-terminal-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/tower-terminal-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "tower-terminal-front.png",
    "sha256": "ef0774bf6cf5c914e23877a2dbbc8ca41ca9a36aa1ba735b6ce6b022f9af87ee",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-tower-terminal-with-blue-screen",
    "path": "furnitures/1_Modern_Office_Singles_48x48/tower-terminal-with-blue-screen.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "tower-terminal-with-blue-screen.png",
    "sha256": "662543207345e865e6ab8515efd0ed368ba9d8c54375a4df82347f40bff089b6",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-whiteboard-with-ui-chart",
    "path": "furnitures/1_Modern_Office_Singles_48x48/whiteboard-with-ui-chart.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "whiteboard-with-ui-chart.png",
    "sha256": "9fdec26c863e94723a46f74d4ba37110d1f1c03b55cbd29fe8a7f82a1412b3d9",
    "width": 96,
    "height": 144
  },
  {
    "id": "furnitures-1-modern-office-singles-48x48-wide-wood-desk-front",
    "path": "furnitures/1_Modern_Office_Singles_48x48/wide-wood-desk-front.png",
    "directory": "furnitures",
    "extension": ".png",
    "fileName": "wide-wood-desk-front.png",
    "sha256": "7ea65bfddc0ae7db8e446a3f335541438285cebaebcbae2320925276caad3d64",
    "width": 96,
    "height": 144
  },
  {
    "id": "walls-walls-1",
    "path": "walls/Walls_1.png",
    "directory": "walls",
    "extension": ".png",
    "fileName": "Walls_1.png",
    "sha256": "ab32b0d72346ed31d8a2cbf34fcf9e6361ac50f5485dfa1cc6ef73c5ebd3bb0d",
    "width": 768,
    "height": 720
  }
] satisfies ObservatoryAssetCatalogEntry[];

export const observatoryAssetCatalogSummary = {
  directories: [
  {
    "directory": "characters",
    "fileCount": 5
  },
  {
    "directory": "floors",
    "fileCount": 1
  },
  {
    "directory": "furnitures",
    "fileCount": 339
  },
  {
    "directory": "walls",
    "fileCount": 1
  }
] satisfies ObservatoryAssetCatalogDirectorySummary[],
  totalFileCount: observatoryAssetCatalogEntries.length,
};

