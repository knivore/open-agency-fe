'use client';

import { Textarea } from '@/components/library/shadcn/textarea';
import { Input } from '@/components/library/shadcn/input';
import { NativeSelect } from '@/components/library/shadcn/select';
import {
  type CSSProperties,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ObservatoryCanvasSelection } from '@/modules/observatory/engine/selection';
import {
  getObservatoryPaletteGroups,
  type ObservatoryPaletteAsset,
  type ObservatoryPaletteGroup,
  type ObservatoryPaletteRoleId,
  observatoryPaletteRoleOptions,
  type ObservatoryPaletteSortId,
  observatoryPaletteSortOptions,
  type ObservatoryPaletteThemeId,
  observatoryPaletteThemeOptions,
} from '@/modules/observatory/engine/assets/assetsPalette';
import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import {
  applyObservatoryProceduralLayoutRules,
  cloneObservatoryLayout,
  createBlankObservatoryLayout,
  createObservatoryCorridor,
  createObservatoryRoom,
  type ObservatoryLayoutEditResult,
  placeObservatoryObject,
} from '@/modules/observatory/engine/world/layoutEditing';
import {
  exportObservatoryLayoutJson,
  OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY,
  writeObservatoryLayoutToStorage,
} from '@/modules/observatory/engine/world/layoutPersistence';
import {
  type ObservatoryLayoutLibraryEntry,
  summarizeObservatoryLayoutLibraryEntry,
} from '@/modules/observatory/engine/world/layoutLibrary';
import { generateObservatoryLayoutFromPrompt } from '@/modules/observatory/generation/promptToLayout';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
import type { ObservatoryGridRect } from '@/modules/observatory/engine/world/grid';
import type { ObservatoryLayoutDocument } from '@/modules/observatory/engine/world/layoutTypes';

import styles from './ManualLayoutEditorPanel.module.css';
import { inspectObservatoryMap } from '../engine/world/layoutInspection';
import { observatoryLayoutContentKey } from '../engine/world/layoutContentKey';
import { observatoryAssetPlacement } from '@/modules/observatory/engine/world/objectGeometry';
import {
  createOfficePreset,
  createOfficeAssetAssembly,
  officePresetOptions,
  placeOfficeAssembly,
  type OfficePresetId,
  type OfficePresetStyle,
} from '../engine/world/officeAssemblies';
import type { ObservatoryPlacementRequest } from '../engine/world/placementPreview';

export interface ManualLayoutEditorPanelProps {
  draftSaveStatus?: string;
  hasPlacementErrors?: boolean;
  mapId?: string;
  onPlacementRequest?: (request: ObservatoryPlacementRequest) => void;
  canvasEditResult?: ObservatoryLayoutEditResult | null;
  canvasWallEditEnabled?: boolean;
  canvasWallEditRoom?: { id: string; label: string } | null;
  canvasWallEditTool?: 'door' | 'floor' | 'opening' | 'paint' | 'tile';
  canvasSelection?: ObservatoryCanvasSelection | null;
  disabled?: boolean;
  layout: ObservatoryLayoutDocument;
  onCanvasWallEditEnabledChange?: (enabled: boolean) => void;
  onCanvasWallEditRoomChange?: (room: { id: string; label: string } | null) => void;
  onCanvasWallEditToolChange?: (tool: 'door' | 'floor' | 'opening' | 'paint' | 'tile') => void;
  onCanvasSelectionClear?: () => void;
  onPaletteSelectionChange?: (
    selection: {
      assetId: string;
      category: ObservatoryPaletteAsset['category'];
      label: string;
    } | null
  ) => void;
  onResetBlank?: () => void;
  onOpenAssetPack?: () => void;
  onLayoutChange: (layout: ObservatoryLayoutDocument) => void;
  onPublishedLayout?: (layout: ObservatoryLayoutDocument) => void;
}

export default function ManualLayoutEditorPanel({
  draftSaveStatus,
  hasPlacementErrors = false,
  mapId,
  onPlacementRequest,
  canvasSelection,
  disabled = false,
  layout,
  onCanvasSelectionClear,
  onPaletteSelectionChange,
  onResetBlank,
  onLayoutChange,
  onPublishedLayout,
}: ManualLayoutEditorPanelProps) {
  const map = layout.world.maps.find((candidate) => candidate.id === mapId) ?? layout.world.maps[0];
  const [selectedRoomId, setSelectedRoomId] = useState(map?.rooms[0]?.id ?? '');
  const [assetSearch, setAssetSearch] = useState('');
  const [presetId, setPresetId] = useState<OfficePresetId>('desktop');
  const [presetStyle, setPresetStyle] = useState<OfficePresetStyle>('beige');
  // The builder opens on the default Observatory office, so start the large catalog
  // on office-fit assets while leaving the full 5k+ palette one filter change away.
  const [assetTheme, setAssetTheme] = useState<ObservatoryPaletteThemeId>('office');
  const [assetRole, setAssetRole] = useState<ObservatoryPaletteRoleId>('all');
  const [assetSort, setAssetSort] = useState<ObservatoryPaletteSortId>('recommended');
  const [includeUnreviewedAssets, setIncludeUnreviewedAssets] = useState(false);
  const [selectedPaletteAssetId, setSelectedPaletteAssetId] = useState('');
  const expandedAssetGroupsKey = JSON.stringify({
    assetRole,
    assetSearch,
    assetSort,
    assetTheme,
    includeUnreviewedAssets,
  });
  const [expandedAssetGroupsState, setExpandedAssetGroupsState] = useState<{
    groups: Record<string, boolean>;
    key: string;
  }>({ groups: {}, key: expandedAssetGroupsKey });
  const expandedAssetGroups =
    expandedAssetGroupsState.key === expandedAssetGroupsKey ? expandedAssetGroupsState.groups : {};
  const setExpandedAssetGroups = (
    nextGroups:
      | Record<string, boolean>
      | ((currentGroups: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    setExpandedAssetGroupsState((currentState) => {
      const currentGroups = currentState.key === expandedAssetGroupsKey ? currentState.groups : {};
      return {
        groups: typeof nextGroups === 'function' ? nextGroups(currentGroups) : nextGroups,
        key: expandedAssetGroupsKey,
      };
    });
  };
  const [layoutPrompt, setLayoutPrompt] = useState(
    'Generate a walkable engineering pod, ops center, meeting room, and approval room with doors.'
  );
  const [layoutLibrary, setLayoutLibrary] = useState<ObservatoryLayoutLibraryEntry[]>([]);
  const initialLayout = useRef(layout);
  const actionPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [libraryReloadKey, setLibraryReloadKey] = useState(0);
  const [savedContentKey, setSavedContentKey] = useState<string | null>(null);
  const [deployedContentKey, setDeployedContentKey] = useState<string | null>(null);
  const [removedFileId, setRemovedFileId] = useState<string | null>(null);
  const [layoutLibraryLoading, setLayoutLibraryLoading] = useState(false);
  const layoutMetadataKey = JSON.stringify({
    name: layout.metadata?.name ?? layout.world.name,
    notes: layout.metadata?.notes ?? '',
    worldId: layout.world.id,
  });
  const defaultLayoutMetadataDraft = {
    key: layoutMetadataKey,
    name: layout.metadata?.name ?? layout.world.name,
    notes: layout.metadata?.notes ?? '',
  };
  const [layoutMetadataDraft, setLayoutMetadataDraft] = useState(defaultLayoutMetadataDraft);
  const activeLayoutMetadataDraft =
    layoutMetadataDraft.key === layoutMetadataKey
      ? layoutMetadataDraft
      : defaultLayoutMetadataDraft;
  const layoutName = activeLayoutMetadataDraft.name;
  const layoutNotes = activeLayoutMetadataDraft.notes;
  const setLayoutName = (name: string) => {
    setLayoutMetadataDraft((currentDraft) => ({
      ...(currentDraft.key === layoutMetadataKey ? currentDraft : defaultLayoutMetadataDraft),
      key: layoutMetadataKey,
      name,
    }));
  };
  const setLayoutNotes = (notes: string) => {
    setLayoutMetadataDraft((currentDraft) => ({
      ...(currentDraft.key === layoutMetadataKey ? currentDraft : defaultLayoutMetadataDraft),
      key: layoutMetadataKey,
      notes,
    }));
  };
  const [selectedManagedLayoutId, setSelectedManagedLayoutIdState] = useState('');
  const setSelectedManagedLayoutId = useCallback((fileId: string) => {
    setSelectedManagedLayoutIdState(fileId);
    try {
      window.localStorage.setItem('observatory:layout:managed-file:v1', fileId);
    } catch {
      /* Editing still works when browser storage is unavailable. */
    }
  }, []);
  const [managedLayoutActionStateId, setManagedLayoutActionId] = useState('');
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ObservatoryLayoutEditResult | null>(null);
  const canvasSelectedObject =
    canvasSelection?.kind === 'object'
      ? map.objects.find((object) => object.id === canvasSelection.id)
      : null;
  const effectiveSelectedRoomId =
    canvasSelection?.kind === 'room'
      ? canvasSelection.id
      : (canvasSelectedObject?.roomId ??
        (selectedRoomId && map.rooms.some((room) => room.id === selectedRoomId)
          ? selectedRoomId
          : (map.rooms[0]?.id ?? '')));
  const assetTargetRoomId = effectiveSelectedRoomId || map.rooms[0]?.id || '';

  const selectedRoom = map?.rooms.find((room) => room.id === effectiveSelectedRoomId);
  const registryAssetsById = useMemo(
    () => new Map(getObservatoryFullModuleAssetRegistry().assets.map((asset) => [asset.id, asset])),
    []
  );
  const paletteGroups = useMemo(
    () =>
      getObservatoryPaletteGroups({
        includeUnreviewed: includeUnreviewedAssets,
        role: assetRole,
        search: assetSearch,
        sort: assetSort,
        theme: assetTheme,
      }),
    [assetRole, assetSearch, assetSort, assetTheme, includeUnreviewedAssets]
  );
  const paletteAssets = useMemo(
    () => paletteGroups.flatMap((group) => group.assets),
    [paletteGroups]
  );
  const layoutLibrarySummaries = useMemo(
    () => layoutLibrary.map((entry) => summarizeObservatoryLayoutLibraryEntry(entry)),
    [layoutLibrary]
  );
  const selectedManagedStillExists = selectedManagedLayoutId
    ? layoutLibrary.some((entry) => entry.fileId === selectedManagedLayoutId)
    : false;
  const managedLayoutActionId = selectedManagedStillExists
    ? selectedManagedLayoutId
    : layoutLibrary.some((entry) => entry.fileId === managedLayoutActionStateId)
      ? managedLayoutActionStateId
      : (layoutLibrary[0]?.fileId ?? '');
  const selectedManagedLibraryEntry =
    layoutLibrary.find((entry) => entry.fileId === managedLayoutActionId) ?? null;
  const selectedManagedLibrarySummary =
    layoutLibrarySummaries.find((entry) => entry.fileId === managedLayoutActionId) ?? null;
  const selectedPaletteAsset =
    paletteAssets.find((asset) => asset.assetId === selectedPaletteAssetId) ?? paletteAssets[0];

  useEffect(() => {
    initialLayout.current = layout;
  }, [layout]);

  useEffect(() => {
    onPaletteSelectionChange?.(
      selectedPaletteAsset
        ? {
            assetId: selectedPaletteAsset.assetId,
            category: selectedPaletteAsset.category,
            label: selectedPaletteAsset.label,
          }
        : null
    );
  }, [onPaletteSelectionChange, selectedPaletteAsset]);

  useEffect(() => {
    let cancelled = false;

    async function loadLayoutLibrary() {
      setLayoutLibraryLoading(true);

      try {
        const response = await fetch('/api/observatory/layout-library');
        const payload = (await response.json().catch(() => null)) as {
          entries?: ObservatoryLayoutLibraryEntry[];
        } | null;

        if (!response.ok || !payload?.entries) throw new Error('Unable to load saved layouts.');
        if (!cancelled && payload?.entries) {
          setLayoutLibrary(payload.entries);
          let remembered = '';
          try {
            remembered = window.localStorage.getItem('observatory:layout:managed-file:v1') ?? '';
          } catch {
            /* The library remains usable without local preferences. */
          }
          const entry =
            payload.entries.find(
              (candidate) =>
                candidate.fileId === remembered &&
                candidate.layout.world.id === initialLayout.current.world.id
            ) ??
            payload.entries.find(
              (candidate) =>
                observatoryLayoutContentKey(candidate.layout) ===
                observatoryLayoutContentKey(initialLayout.current)
            );
          if (entry) {
            setSelectedManagedLayoutId(entry.fileId);
            setSavedContentKey(observatoryLayoutContentKey(entry.layout));
          }
        }
      } catch {
        if (!cancelled) {
          setLastResult({
            changed: false,
            issues: [{ path: 'layoutLibrary', reason: 'Unable to load saved layout library.' }],
            layout: initialLayout.current,
            message: 'Unable to load saved layout library.',
          });
        }
      } finally {
        if (!cancelled) {
          setLayoutLibraryLoading(false);
        }
      }
    }

    void loadLayoutLibrary();

    return () => {
      cancelled = true;
    };
  }, [libraryReloadKey, setSelectedManagedLayoutId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/observatory/published-layout', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Deployment unavailable.');
        return response.json();
      })
      .then((payload) => {
        const validation = validateObservatoryLayout(payload.layout);
        if (validation.layout) {
          setDeployedContentKey(observatoryLayoutContentKey(validation.layout));
          setLastPublishedAt(validation.layout.metadata?.publishedAt ?? null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!map) {
    return null;
  }

  const applyEdit = (result: ObservatoryLayoutEditResult) => {
    setLastResult(result);

    if (result.selectedRoomId) {
      setSelectedRoomId(result.selectedRoomId);
    }

    if (result.changed) {
      startTransition(() => onLayoutChange(result.layout));
    }
  };

  const currentManagedLayout = () => ({
    ...layout,
    metadata: {
      ...layout.metadata,
      id: layout.metadata?.id ?? map.id,
      name: layoutName.trim() || layout.metadata?.name || map.name,
      notes: layoutNotes.trim() || undefined,
    },
  });

  const syncLayoutLibrary = (entries: ObservatoryLayoutLibraryEntry[]) => {
    setLayoutLibrary(entries);
  };

  const runManagedAction = async (action: () => Promise<void>) => {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setLastResult({
        changed: false,
        issues: [],
        layout,
        message: `Request failed: ${error instanceof Error ? error.message : 'Connection unavailable'}. Your draft is preserved; retry when ready.`,
      });
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  };
  const saveManagedLayout = (mode: 'create' | 'update') =>
    runManagedAction(() => saveManagedLayoutRequest(mode));
  const deleteManagedLayout = (fileId: string) =>
    runManagedAction(() => deleteManagedLayoutRequest(fileId));
  const publishManagedLayout = (document?: ObservatoryLayoutDocument) =>
    runManagedAction(() => publishManagedLayoutRequest(document));
  const loadRepoLayout = () => runManagedAction(loadDeployedLayoutRequest);
  const restoreRemovedLayout = () =>
    runManagedAction(async () => {
      const response = await fetch('/api/observatory/layout-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'restore', fileId: removedFileId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? 'Restore failed.');
      setLayoutLibrary(payload.entries);
      setRemovedFileId(null);
      setLastResult({ changed: false, issues: [], layout, message: 'Restored saved layout.' });
    });
  const saveManagedLayoutRequest = async (mode: 'create' | 'update') => {
    if (typeof window === 'undefined') {
      setLastResult({
        changed: false,
        issues: [
          {
            path: 'layoutLibrary',
            reason: 'Layout management is unavailable outside the browser.',
          },
        ],
        layout,
        message: 'Layout management is unavailable outside the browser.',
      });
      return;
    }

    if (layoutName.trim().length === 0) {
      setLastResult({
        changed: false,
        issues: [{ path: 'layout.metadata.name', reason: 'Enter a layout name before saving.' }],
        layout,
        message: 'Enter a layout name before saving.',
      });
      return;
    }

    const response = await fetch('/api/observatory/layout-library', {
      body: JSON.stringify({
        fileId: mode === 'update' ? selectedManagedLayoutId || undefined : undefined,
        layout: currentManagedLayout(),
        mode,
        name: layoutName,
        notes: layoutNotes,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const payload = (await response.json().catch(() => null)) as {
      entries?: ObservatoryLayoutLibraryEntry[];
      entry?: ObservatoryLayoutLibraryEntry;
      issues?: { path: string; reason: string }[];
      message?: string;
    } | null;

    if (!response.ok || !payload?.entry || !payload.entries) {
      setLastResult({
        changed: false,
        issues: payload?.issues ?? [
          { path: 'layoutLibrary', reason: payload?.message ?? 'Saved layout failed.' },
        ],
        layout,
        message: payload?.message ?? 'Saved layout failed.',
      });
      return;
    }

    syncLayoutLibrary(payload.entries);
    setSavedContentKey(observatoryLayoutContentKey(payload.entry.layout));
    setSelectedManagedLayoutId(payload.entry.fileId);
    setManagedLayoutActionId(payload.entry.fileId);
    setLastResult({
      changed: false,
      issues: [],
      layout,
      message:
        payload.message ?? (mode === 'update' ? 'Updated saved layout.' : 'Saved new layout.'),
    });
  };

  const saveManagedLayoutPrimary = async () => {
    await saveManagedLayout(selectedManagedLayoutId ? 'update' : 'create');
  };

  const loadManagedLayout = (entry: ObservatoryLayoutLibraryEntry) => {
    setSavedContentKey(observatoryLayoutContentKey(entry.layout));
    setSelectedManagedLayoutId(entry.fileId);
    setManagedLayoutActionId(entry.fileId);
    setLayoutName(entry.layout.metadata?.name ?? entry.layout.world.name);
    setLayoutNotes(entry.layout.metadata?.notes ?? '');
    setLastResult({
      changed: true,
      issues: [],
      layout: entry.layout,
      message: `Loaded saved layout "${entry.layout.metadata?.name ?? entry.layout.world.name}".`,
    });
    startTransition(() => onLayoutChange(cloneObservatoryLayout(entry.layout)));
  };

  const deleteManagedLayoutRequest = async (fileId: string) => {
    const response = await fetch('/api/observatory/layout-library', {
      body: JSON.stringify({ fileId }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'DELETE',
    });
    const payload = (await response.json().catch(() => null)) as {
      entries?: ObservatoryLayoutLibraryEntry[];
      issues?: { path: string; reason: string }[];
      message?: string;
    } | null;

    if (!response.ok || !payload?.entries) {
      setLastResult({
        changed: false,
        issues: payload?.issues ?? [
          { path: 'layoutLibrary', reason: payload?.message ?? 'Delete saved layout failed.' },
        ],
        layout,
        message: payload?.message ?? 'Delete saved layout failed.',
      });
      return;
    }

    syncLayoutLibrary(payload.entries);
    setRemovedFileId(fileId);
    if (selectedManagedLayoutId === fileId) {
      setSelectedManagedLayoutId('');
    }
    if (managedLayoutActionId === fileId) {
      setManagedLayoutActionId(payload.entries[0]?.fileId ?? '');
    }
    setLastResult({
      changed: false,
      issues: [],
      layout,
      message: payload.message ?? 'Deleted saved layout.',
    });
  };

  const publishManagedLayoutRequest = async (managedLayout?: ObservatoryLayoutDocument) => {
    const layoutToPublish = managedLayout ?? currentManagedLayout();
    const errors = layoutToPublish.world.maps.flatMap((floor) =>
      inspectObservatoryMap(floor, registryAssetsById, layoutToPublish.world.grid.tileSize)
        .issues.filter((issue) => issue.severity === 'error')
        .map((issue) => ({ path: floor.name, reason: issue.message }))
    );
    if (errors.length) {
      setLastResult({
        changed: false,
        issues: errors,
        layout,
        message: 'Fix layout errors before deploying. Saving a draft is still available.',
      });
      return;
    }

    if (typeof window === 'undefined') {
      applyEdit(failedNoSelection(layout, 'Layout publishing is unavailable outside the browser.'));
      return;
    }

    const response = await fetch('/api/observatory/published-layout', {
      body: JSON.stringify({
        layout: layoutToPublish,
        notes: layoutNotes.trim() || undefined,
        publishedBy: 'local-builder',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const payload = (await response.json().catch(() => null)) as {
      issues?: { path: string; reason: string }[];
      layout?: ObservatoryLayoutDocument;
      message?: string;
    } | null;

    if (!response.ok || !payload?.layout) {
      setLastPublishedAt(null);
      setLastResult({
        changed: false,
        issues: payload?.issues ?? [
          { path: 'publish', reason: payload?.message ?? 'Layout publish failed.' },
        ],
        layout,
        message: payload?.message ?? 'Layout publish failed.',
      });
      return;
    }

    const result = writeObservatoryLayoutToStorage(
      window.localStorage,
      payload.layout,
      OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY
    );
    setLastResult({
      changed: false,
      issues: result.issues,
      layout: payload.layout,
      message: result.layout
        ? 'Deployed to server storage. The Runs viewer will load this layout.'
        : 'Server deployment succeeded; the browser-local copy could not be written.',
    });
    setLastPublishedAt(payload.layout.metadata?.publishedAt ?? null);

    setDeployedContentKey(observatoryLayoutContentKey(payload.layout));
    onPublishedLayout?.(payload.layout);
  };

  const placeObjectInRoom = (roomId: string) => {
    if (!selectedPaletteAsset) {
      applyEdit(failedNoSelection(layout, 'Select an asset before placing.'));
      return;
    }

    if (selectedPaletteAsset.category === 'floor' || selectedPaletteAsset.category === 'wall') {
      applyEdit(
        failedNoSelection(
          layout,
          'Only furniture, decor, and animation assets can be added to a room from the palette.'
        )
      );
      return;
    }

    const targetRoom = map.rooms.find((room) => room.id === roomId);
    if (!targetRoom) {
      applyEdit(failedNoSelection(layout, 'Select a valid room before adding the asset.'));
      return;
    }

    const preferredPosition = {
      x: targetRoom.bounds.x + 1,
      y: targetRoom.bounds.y + 2,
    };
    const asset = registryAssetsById.get(selectedPaletteAsset.assetId)!;
    const candidate = placeObservatoryObject(layout, map.id, {
      ...observatoryAssetPlacement(asset, layout.world.grid.tileSize),
      assetId: selectedPaletteAsset.assetId,
      position: preferredPosition,
      roomId: targetRoom.id,
    });
    if (!candidate.changed) {
      applyEdit(candidate);
      return;
    }
    const placed = candidate.layout.world.maps
      .find((floor) => floor.id === map.id)!
      .objects.find((object) => object.id === candidate.selectedObjectId)!;
    applyEdit(
      placeOfficeAssembly(
        layout,
        map.id,
        createOfficeAssetAssembly(
          asset,
          placed.position,
          registryAssetsById,
          layout.world.grid.tileSize
        ),
        targetRoom.id
      )
    );
    setSelectedRoomId(targetRoom.id);
  };

  const createRoom = () => {
    applyEdit(
      createObservatoryRoom(layout, map.id, {
        bounds: findNextRoomBounds(map.rooms.length, map.size.width, map.size.height),
        kind: 'workspace',
        name: `Manual Room ${map.rooms.length + 1}`,
        wallAssetId: 'wall:office-partition',
      })
    );
  };

  const generateCorridor = () => {
    applyEdit(createObservatoryCorridor(layout, map.id));
  };

  const applyProceduralRules = () => {
    applyEdit(applyObservatoryProceduralLayoutRules(layout, map.id));
  };

  const previewPromptLayout = () => {
    const currentResult = generateObservatoryLayoutFromPrompt(layout, layoutPrompt, map.id);
    const result = currentResult.valid
      ? currentResult
      : generateObservatoryLayoutFromPrompt(
          createBlankObservatoryLayout(layout, map.id),
          layoutPrompt,
          map.id
        );
    const nextLayout = result.layout ?? layout;

    setLastResult({
      changed: result.valid,
      issues: result.issues,
      layout: nextLayout,
      message: result.valid
        ? `Preview generated layout from prompt: ${result.plan.templateIds.length} templates${currentResult.valid ? '' : ' using clean base'}.`
        : 'Prompt layout validation failed.',
    });

    if (result.valid && result.layout) {
      startTransition(() => onLayoutChange(result.layout!));
    }
  };

  const resetBlankCanvas = () => {
    const nextLayout = createBlankObservatoryLayout(layout, map.id);
    const validation = validateObservatoryLayout(nextLayout);

    setLastResult({
      changed: Boolean(validation.layout),
      issues: validation.issues,
      layout: validation.layout ?? layout,
      message: validation.layout
        ? `Cleared ${map.name}; other floors are preserved.`
        : 'Blank canvas reset failed validation.',
    });

    if (!validation.layout) {
      return;
    }

    setSelectedRoomId('');
    setSelectedManagedLayoutId('');
    onCanvasSelectionClear?.();
    onResetBlank?.();
    startTransition(() => onLayoutChange(validation.layout!));
  };

  const loadDeployedLayoutRequest = async () => {
    const response = await fetch('/api/observatory/published-layout', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? 'Unable to load deployed layout.');
    const validation = validateObservatoryLayout(payload.layout);
    if (!validation.layout) throw new Error('Deployed layout failed validation.');
    const nextLayout = cloneObservatoryLayout(validation.layout);
    setSelectedManagedLayoutId('');
    setCanvasSelectionFromLoad();
    setDeployedContentKey(observatoryLayoutContentKey(nextLayout));
    setLastPublishedAt(nextLayout.metadata?.publishedAt ?? null);
    setLastResult({
      changed: true,
      issues: [],
      layout: nextLayout,
      message: 'Loaded deployed layout from server storage.',
    });
    startTransition(() => onLayoutChange(nextLayout));
  };
  const setCanvasSelectionFromLoad = () => {
    onCanvasSelectionClear?.();
    setSelectedRoomId('');
  };

  const exportLayout = () => {
    const result = exportObservatoryLayoutJson(currentManagedLayout());

    if (result.json) {
      if (typeof window !== 'undefined') {
        const blob = new Blob([result.json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const fileNameBase = sanitizeDownloadName(
          layoutName.trim() || layout.metadata?.name || layout.world.name || 'observatory-layout'
        );
        anchor.href = url;
        anchor.download = `${fileNameBase}.json`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
      }
    }

    setLastResult({
      changed: false,
      issues: result.issues,
      layout: result.layout ?? layout,
      message: result.json
        ? 'Exported validated layout JSON download.'
        : 'Layout export failed validation.',
    });
  };

  const publishLayout = async () => {
    await publishManagedLayout();
  };

  const contentKey = observatoryLayoutContentKey(currentManagedLayout());
  return (
    <section className={styles.panel} aria-label="Observatory manual layout editor">
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Manual Layout Editor</h3>
          <p className={styles.description}>
            Choose a preset or an asset, then place it on the grid. Click furniture to edit its
            setup.
          </p>
        </div>
      </div>
      <p role="status" className={styles.status}>
        {draftSaveStatus}
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Canvas selection</span>
          <strong>{canvasSelection?.kind ?? 'none'}</strong>
        </div>
        <div className={styles.stat}>
          <span>Rooms</span>
          <strong>{map.rooms.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>Objects</span>
          <strong>{map.objects.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>Map</span>
          <strong>
            {map.size.width}x{map.size.height}
          </strong>
        </div>
      </div>

      <details className={styles.accordion} open>
        <summary className={styles.summary}>Office presets</summary>
        <div className={styles.assetPaletteHeader}>
          <label className={styles.field}>
            <span>Setup</span>
            <NativeSelect
              value={presetId}
              onChange={(event) => setPresetId(event.target.value as OfficePresetId)}
            >
              {officePresetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className={styles.field}>
            <span>Desk finish</span>
            <NativeSelect
              value={presetStyle}
              onChange={(event) => setPresetStyle(event.target.value as OfficePresetStyle)}
            >
              <option value="beige">Beige wood</option>
              <option value="white">White</option>
            </NativeSelect>
          </label>
          <button
            type="button"
            className={styles.button}
            disabled={disabled || !selectedRoom}
            onClick={() => {
              if (onPlacementRequest) {
                onPlacementRequest({
                  kind: 'preset',
                  presetId,
                  style: presetStyle,
                  label: officePresetOptions.find((option) => option.id === presetId)!.label,
                });
                return;
              }
              if (!selectedRoom) return;
              for (
                let y = selectedRoom.bounds.y + 2;
                y < selectedRoom.bounds.y + selectedRoom.bounds.height;
                y++
              ) {
                for (
                  let x = selectedRoom.bounds.x + 1;
                  x < selectedRoom.bounds.x + selectedRoom.bounds.width;
                  x++
                ) {
                  const result = placeOfficeAssembly(
                    layout,
                    map.id,
                    createOfficePreset(presetId, presetStyle, { x, y }, layout.world.grid.tileSize),
                    selectedRoom.id
                  );
                  if (result.changed) {
                    applyEdit(result);
                    return;
                  }
                }
              }
              setLastResult({
                changed: false,
                issues: [],
                layout,
                message: 'No space for this complete setup in the selected room.',
              });
            }}
          >
            {onPlacementRequest
              ? 'Place setup on canvas'
              : `Add setup to ${selectedRoom?.name ?? 'selected room'}`}
          </button>
        </div>
      </details>
      <details className={styles.accordion} open>
        <summary className={styles.summary}>Assets Palette</summary>
        <div className={styles.assetPaletteHeader}>
          <label className={styles.field}>
            <span>Search manifest assets</span>
            <Input
              className={styles.input}
              disabled={disabled}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="server, monitor, whiteboard, chair, desk"
              value={assetSearch}
            />
          </label>
          <div className={styles.filterRow}>
            <label className={styles.field}>
              <span>Theme</span>
              <NativeSelect
                className={styles.select}
                disabled={disabled}
                onChange={(event) => setAssetTheme(event.target.value as ObservatoryPaletteThemeId)}
                value={assetTheme}
              >
                {observatoryPaletteThemeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className={styles.field}>
              <span>Role</span>
              <NativeSelect
                className={styles.select}
                disabled={disabled}
                onChange={(event) => setAssetRole(event.target.value as ObservatoryPaletteRoleId)}
                value={assetRole}
              >
                {observatoryPaletteRoleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className={styles.field}>
              <span>Sort</span>
              <NativeSelect
                className={styles.select}
                disabled={disabled}
                onChange={(event) => setAssetSort(event.target.value as ObservatoryPaletteSortId)}
                value={assetSort}
              >
                {observatoryPaletteSortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <label className={styles.checkboxField}>
            <Input
              checked={includeUnreviewedAssets}
              disabled={disabled}
              onChange={(event) => setIncludeUnreviewedAssets(event.target.checked)}
              type="checkbox"
            />
            Include unreviewed assets
          </label>
        </div>
        {selectedPaletteAsset ? (
          <div className={styles.selectedAssetCard}>
            <AssetPreview
              asset={selectedPaletteAsset}
              src={registryAssetsById.get(selectedPaletteAsset.assetId)?.source.uri}
            />
            <div>
              <strong>
                Selected {selectedPaletteAsset.category}: {selectedPaletteAsset.label}
              </strong>
              <span>
                {selectedPaletteAsset.category === 'floor'
                  ? selectedRoom
                    ? `Ready to apply to room "${selectedRoom.name}".`
                    : 'Ready to apply as the map default floor.'
                  : selectedPaletteAsset.category === 'wall'
                    ? selectedRoom
                      ? `Ready to apply to room "${selectedRoom.name}".`
                      : 'Select a room, then apply this wall.'
                    : `${selectedPaletteAsset.roleLabel} • ${selectedPaletteAsset.footprint.width}x${selectedPaletteAsset.footprint.height}`}
              </span>
              {selectedPaletteAsset.category !== 'floor' &&
              selectedPaletteAsset.category !== 'wall' ? (
                <div className={styles.selectedAssetActions}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={disabled}
                    onClick={() =>
                      onPlacementRequest?.({
                        kind: 'asset',
                        assetId: selectedPaletteAsset.assetId,
                        label: selectedPaletteAsset.label,
                      })
                    }
                  >
                    Place on canvas
                  </button>
                  <label className={styles.field}>
                    <span>Add to</span>
                    <NativeSelect
                      className={styles.select}
                      disabled={disabled || map.rooms.length === 0}
                      onChange={(event) => {
                        // Selecting a destination must not silently add furniture.
                        setSelectedRoomId(event.target.value);
                        onCanvasSelectionClear?.();
                      }}
                      value={assetTargetRoomId}
                    >
                      <option value="">Select room…</option>
                      {map.rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name} ({room.bounds.width}x{room.bounds.height})
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    disabled={disabled || !assetTargetRoomId}
                    onClick={() => placeObjectInRoom(assetTargetRoomId)}
                  >
                    Auto-place in room
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={styles.assetGroupStack}>
          {paletteGroups.map((group) => (
            <details
              className={styles.assetGroup}
              key={group.id}
              open={group.id === 'furniture' || group.id === 'animations'}
            >
              <summary className={styles.assetGroupSummary}>
                {group.label} <span>{group.assets.length}</span>
              </summary>
              <p className={styles.meta}>{group.description}</p>
              {group.id === 'floors' || group.id === 'walls'
                ? renderSurfacePaletteGroup({
                    disabled,
                    expanded: Boolean(expandedAssetGroups[group.id]),
                    group,
                    onExpandChange: (expanded) =>
                      setExpandedAssetGroups((current) => ({
                        ...current,
                        [group.id]: expanded,
                      })),
                    onSelectAsset: setSelectedPaletteAssetId,
                    registryAssetsById,
                    selectedAssetId: selectedPaletteAsset?.assetId,
                  })
                : renderPaletteAssetGrid({
                    disabled,
                    expanded: Boolean(expandedAssetGroups[group.id]),
                    groupId: group.id,
                    assets: group.assets,
                    onExpandChange: (expanded) =>
                      setExpandedAssetGroups((current) => ({
                        ...current,
                        [group.id]: expanded,
                      })),
                    onSelectAsset: setSelectedPaletteAssetId,
                    registryAssetsById,
                    selectedAssetId: selectedPaletteAsset?.assetId,
                  })}
            </details>
          ))}
        </div>
      </details>

      <details className={styles.accordion}>
        <summary className={styles.summary}>Procedural and prompt generation</summary>
        <label className={styles.field}>
          <span>Prompt-to-layout</span>
          <Textarea
            className={`${styles.textarea} ${styles.textareaCompact}`}
            disabled={disabled}
            onChange={(event) => setLayoutPrompt(event.target.value)}
            rows={2}
            value={layoutPrompt}
          />
        </label>
        <div className={styles.buttons}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={disabled}
            onClick={generateCorridor}
            type="button"
          >
            Generate corridor
          </button>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={disabled}
            onClick={applyProceduralRules}
            type="button"
          >
            Apply procedural rules
          </button>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={disabled || layoutPrompt.trim().length === 0}
            onClick={previewPromptLayout}
            type="button"
          >
            Generate prompt preview
          </button>
        </div>
      </details>

      <p className={styles.status}>
        {lastResult?.message ?? 'No layout edits applied yet.'}
        {lastResult?.issues.map((issue) => (
          <span className={styles.issue} key={`${issue.path}:${issue.reason}`}>
            {' '}
            {issue.path}: {issue.reason}
          </span>
        ))}
      </p>
      <details className={styles.accordion}>
        <summary className={styles.summary}>Layout management</summary>
        <div className={styles.managementSectionStack}>
          <section className={styles.managementCard}>
            <div className={styles.managementCardHeader}>
              <div>
                <strong>Current layout</strong>
                <p className={styles.meta}>
                  Save the current builder state, deploy it to the viewer, or export a JSON copy.
                </p>
              </div>
              <span className={styles.controlCardBadge}>
                {busy
                  ? 'Saving…'
                  : savedContentKey === contentKey
                    ? 'Saved to server'
                    : 'Unsaved changes'}
              </span>
            </div>
            <div className={styles.managementGrid}>
              <label className={styles.field}>
                <span>Layout name</span>
                <Input
                  className={styles.input}
                  disabled={disabled || busy}
                  onChange={(event) => setLayoutName(event.target.value)}
                  placeholder="Observatory Office Variant A"
                  value={layoutName}
                />
              </label>
              <label className={styles.field}>
                <span>Layout notes</span>
                <Textarea
                  className={`${styles.textarea} ${styles.textareaCompact}`}
                  disabled={disabled || busy}
                  onChange={(event) => setLayoutNotes(event.target.value)}
                  rows={2}
                  value={layoutNotes}
                />
              </label>
            </div>
            <div className={styles.managementStatusRow}>
              <span className={styles.positionBadge}>
                {deployedContentKey === contentKey
                  ? 'Matches deployment'
                  : 'Draft differs from deployment'}
              </span>
              <span className={styles.positionBadge}>
                Saved layouts {layoutLibrarySummaries.length}
              </span>
              <span className={styles.positionBadge}>
                {lastPublishedAt
                  ? `Last deploy ${new Date(lastPublishedAt).toLocaleString()}`
                  : 'No deploy yet'}
              </span>
            </div>
            <div className={styles.managementPrimaryActions}>
              <button
                className={styles.button}
                disabled={disabled || busy}
                onClick={() => void saveManagedLayoutPrimary()}
                type="button"
              >
                {selectedManagedLayoutId ? 'Save changes' : 'Save as new'}
              </button>
              <button
                className={styles.button}
                disabled={disabled || busy || hasPlacementErrors}
                title={hasPlacementErrors ? 'Fix layout errors before deploying' : undefined}
                onClick={() => void publishLayout()}
                type="button"
              >
                Deploy
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled || busy}
                onClick={exportLayout}
                type="button"
              >
                Export JSON
              </button>
              <label className={styles.field}>
                <span>Import JSON</span>
                <Input
                  type="file"
                  accept=".json,application/json"
                  disabled={disabled || busy}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                      const validation = validateObservatoryLayout(JSON.parse(await file.text()));
                      if (!validation.layout) {
                        setLastResult({
                          changed: false,
                          issues: validation.issues,
                          layout,
                          message: 'Imported layout failed validation.',
                        });
                        return;
                      }
                      setLastResult({
                        changed: true,
                        issues: [],
                        layout: validation.layout,
                        message: `Imported ${file.name}. Save or deploy when ready.`,
                      });
                      onLayoutChange(cloneObservatoryLayout(validation.layout));
                    } catch (error) {
                      setLastResult({
                        changed: false,
                        issues: [],
                        layout,
                        message: `Import failed: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
                      });
                    }
                  }}
                />
              </label>
            </div>
            <div className={styles.managementSecondaryActions}>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled || busy}
                onClick={() => void saveManagedLayout('create')}
                type="button"
              >
                Save copy
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled || busy}
                onClick={createRoom}
                type="button"
              >
                Create room
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled || busy}
                onClick={loadRepoLayout}
                type="button"
              >
                Load deployed
              </button>
              <button
                className={`${styles.button} ${styles.buttonDanger}`}
                disabled={disabled || busy}
                onClick={resetBlankCanvas}
                type="button"
              >
                Blank selected floor
              </button>
            </div>
          </section>

          <section className={styles.managementCard}>
            <div className={styles.managementCardHeader}>
              <div>
                <strong>Saved layouts</strong>
                <button
                  className={styles.button}
                  type="button"
                  disabled={busy || layoutLibraryLoading}
                  onClick={() => setLibraryReloadKey((key) => key + 1)}
                >
                  Refresh library
                </button>
                {removedFileId ? (
                  <button
                    className={styles.button}
                    type="button"
                    disabled={busy}
                    onClick={() => void restoreRemovedLayout()}
                  >
                    Restore removed layout
                  </button>
                ) : null}
                <p className={styles.meta}>
                  Pick a saved layout when you need to load, deploy, or delete it.
                </p>
              </div>
              <span className={styles.controlCardBadge}>{layoutLibrarySummaries.length}</span>
            </div>
            {layoutLibraryLoading ? (
              <p className={styles.meta}>Loading saved layouts…</p>
            ) : layoutLibrarySummaries.length === 0 ? (
              <p className={styles.meta}>No saved server layouts yet.</p>
            ) : (
              <div className={styles.savedLayoutPicker}>
                <label className={styles.field}>
                  <span>Saved layout</span>
                  <NativeSelect
                    className={styles.select}
                    disabled={disabled || busy}
                    onChange={(event) => setManagedLayoutActionId(event.target.value)}
                    value={managedLayoutActionId}
                  >
                    {layoutLibrarySummaries.map((entry) => (
                      <option key={entry.fileId} value={entry.fileId}>
                        {entry.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {selectedManagedLibraryEntry && selectedManagedLibrarySummary ? (
                  <>
                    <div className={styles.managementStatusRow}>
                      <span className={styles.positionBadge}>
                        {selectedManagedLayoutId === selectedManagedLibraryEntry.fileId
                          ? 'Loaded in builder'
                          : 'Saved on server'}
                      </span>
                      <span className={styles.positionBadge}>
                        {selectedManagedLibrarySummary.updatedAt
                          ? `Updated ${new Date(selectedManagedLibrarySummary.updatedAt).toLocaleString()}`
                          : 'Updated unknown'}
                      </span>
                      <span className={styles.positionBadge}>
                        v{selectedManagedLibrarySummary.version ?? 0}
                      </span>
                    </div>
                    <p className={styles.meta}>
                      {selectedManagedLibrarySummary.notes?.trim() ||
                        selectedManagedLibraryEntry.fileName}
                    </p>
                    <div className={styles.managementPrimaryActions}>
                      <button
                        className={`${styles.button} ${selectedManagedLayoutId === selectedManagedLibraryEntry.fileId ? '' : styles.buttonSecondary}`}
                        disabled={disabled || busy}
                        onClick={() => loadManagedLayout(selectedManagedLibraryEntry)}
                        type="button"
                      >
                        Load into builder
                      </button>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        disabled={disabled || busy}
                        onClick={() =>
                          void publishManagedLayout(selectedManagedLibraryEntry.layout)
                        }
                        type="button"
                      >
                        Deploy saved
                      </button>
                      <button
                        className={`${styles.button} ${styles.buttonDanger}`}
                        disabled={disabled || busy}
                        onClick={() => void deleteManagedLayout(selectedManagedLibraryEntry.fileId)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </details>
    </section>
  );
}

const defaultVisiblePaletteAssets = 48;

function renderSurfacePaletteGroup({
  disabled,
  expanded,
  group,
  onExpandChange,
  onSelectAsset,
  registryAssetsById,
  selectedAssetId,
}: {
  disabled: boolean;
  expanded: boolean;
  group: ObservatoryPaletteGroup;
  onExpandChange: (expanded: boolean) => void;
  onSelectAsset: (assetId: string) => void;
  registryAssetsById: Map<
    string,
    ReturnType<typeof getObservatoryFullModuleAssetRegistry>['assets'][number]
  >;
  selectedAssetId?: string;
}) {
  const sections = surfaceSectionsForGroup(group);

  return (
    <div className={styles.surfaceSectionStack}>
      {sections.map((section) => (
        <section className={styles.surfaceSection} key={section.id}>
          <div className={styles.surfaceSectionHeader}>
            <strong>{section.label}</strong>
            <span>{section.assets.length}</span>
          </div>
          <p className={styles.meta}>{section.description}</p>
          {renderPaletteAssetGrid({
            disabled,
            expanded,
            groupId: `${group.id}:${section.id}`,
            assets: section.assets,
            onExpandChange,
            onSelectAsset,
            registryAssetsById,
            selectedAssetId,
          })}
        </section>
      ))}
    </div>
  );
}

function renderPaletteAssetGrid({
  disabled,
  expanded,
  groupId,
  assets,
  onExpandChange,
  onSelectAsset,
  registryAssetsById,
  selectedAssetId,
}: {
  disabled: boolean;
  expanded: boolean;
  groupId: string;
  assets: ObservatoryPaletteAsset[];
  onExpandChange: (expanded: boolean) => void;
  onSelectAsset: (assetId: string) => void;
  registryAssetsById: Map<
    string,
    ReturnType<typeof getObservatoryFullModuleAssetRegistry>['assets'][number]
  >;
  selectedAssetId?: string;
}) {
  const visibleCount = expanded
    ? assets.length
    : Math.min(assets.length, defaultVisiblePaletteAssets);
  const remainingCount = Math.max(0, assets.length - visibleCount);
  const visibleAssets = assets.slice(0, visibleCount);

  return (
    <>
      <div className={styles.assetGrid} data-group-id={groupId}>
        {visibleAssets.map((asset) => (
          <button
            className={`${styles.assetButton} ${selectedAssetId === asset.assetId ? styles.assetButtonActive : ''}`}
            disabled={disabled}
            key={asset.assetId}
            onClick={() => onSelectAsset(asset.assetId)}
            title={`${asset.label} (${asset.roleLabel})`}
            type="button"
          >
            <AssetPreview asset={asset} src={registryAssetsById.get(asset.assetId)?.source.uri} />
            <span>{asset.label}</span>
          </button>
        ))}
      </div>
      {assets.length > defaultVisiblePaletteAssets ? (
        <div className={styles.assetGroupActions}>
          <span className={styles.meta}>
            Showing {visibleCount} of {assets.length} assets.
          </span>
          {!expanded && remainingCount > 0 ? (
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              disabled={disabled}
              onClick={() => onExpandChange(true)}
              type="button"
            >
              Show remaining {remainingCount}
            </button>
          ) : (
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              disabled={disabled}
              onClick={() => onExpandChange(false)}
              type="button"
            >
              Collapse list
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

function surfaceSectionsForGroup(group: ObservatoryPaletteGroup) {
  const sectionDefs =
    group.id === 'floors'
      ? [
          {
            id: 'a2-ground',
            label: 'A2 Ground Autotiles',
            description: 'Auto-tiling ground sheets for map and room floor fills.',
            surfaceType: 'a2-ground' as const,
          },
          {
            id: 'normal-floor-sheet',
            label: 'Normal Floor Sheets',
            description: 'Non-autotile floor sheets and one-off floor surfaces.',
            surfaceType: 'normal-floor-sheet' as const,
          },
        ]
      : [
          {
            id: 'a4-wall',
            label: 'A4 Wall Autotiles',
            description: 'Auto-tiling wall sheets for room boundaries and partitions.',
            surfaceType: 'a4-wall' as const,
          },
          {
            id: 'normal-wall-sheet',
            label: 'Normal Wall Sheets',
            description: 'Non-autotile wall sheets and wall-style surface art.',
            surfaceType: 'normal-wall-sheet' as const,
          },
        ];

  return sectionDefs
    .map((section) => ({
      ...section,
      assets: group.assets.filter((asset) => asset.surfaceType === section.surfaceType),
    }))
    .filter((section) => section.assets.length > 0);
}

function AssetPreview({ asset, src }: { asset: ObservatoryPaletteAsset; src?: string }) {
  const previewBoxSize = 42;
  const style: CSSProperties | undefined = src
    ? asset.previewCrop
      ? (() => {
          const scale =
            previewBoxSize / Math.max(asset.previewCrop.width, asset.previewCrop.height);
          return {
            backgroundImage: `url(${src})`,
            backgroundPosition: `${-asset.previewCrop.x * scale}px ${-asset.previewCrop.y * scale}px`,
            backgroundSize: `${asset.previewCrop.sourceWidth * scale}px ${asset.previewCrop.sourceHeight * scale}px`,
          } satisfies CSSProperties;
        })()
      : {
          backgroundImage: `url(${src})`,
        }
    : undefined;

  return (
    <span
      aria-label={`${asset.label} preview`}
      className={styles.assetPreview}
      role="img"
      style={style}
    />
  );
}

function failedNoSelection(
  layout: ObservatoryLayoutDocument,
  message: string
): ObservatoryLayoutEditResult {
  return {
    changed: false,
    issues: [{ path: 'selection', reason: message }],
    layout,
    message,
  };
}

function sanitizeDownloadName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return normalized || 'observatory-layout';
}

function findNextRoomBounds(
  roomCount: number,
  mapWidth: number,
  mapHeight: number
): ObservatoryGridRect {
  const width = 6;
  const height = 4;
  const x = Math.max(
    0,
    Math.min(mapWidth - width, 1 + ((roomCount * 7) % Math.max(1, mapWidth - width)))
  );
  const y = Math.max(0, Math.min(mapHeight - height, 14));

  return { height, width, x, y };
}
