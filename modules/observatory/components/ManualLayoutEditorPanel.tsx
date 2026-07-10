'use client';

import { type CSSProperties, startTransition, useEffect, useMemo, useState } from 'react';

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
  clearObservatoryLayoutStorage,
  exportObservatoryLayoutJson,
  OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY,
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
import repoPublishedLayout from '@/modules/observatory/layouts/publishedLayout.json';

import styles from './ManualLayoutEditorPanel.module.css';

export interface ManualLayoutEditorPanelProps {
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
  canvasSelection,
  disabled = false,
  layout,
  onCanvasSelectionClear,
  onPaletteSelectionChange,
  onResetBlank,
  onLayoutChange,
  onPublishedLayout,
}: ManualLayoutEditorPanelProps) {
  const map = layout.world.maps[0];
  const [selectedRoomId, setSelectedRoomId] = useState(map?.rooms[0]?.id ?? '');
  const [assetSearch, setAssetSearch] = useState('');
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
  const [selectedManagedLayoutId, setSelectedManagedLayoutId] = useState('');
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

        if (!cancelled && payload?.entries) {
          setLayoutLibrary(payload.entries);
        }
      } catch {
        if (!cancelled) {
          setLastResult({
            changed: false,
            issues: [{ path: 'layoutLibrary', reason: 'Unable to load saved layout library.' }],
            layout,
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
  }, [layout]);

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

  const saveManagedLayout = async (mode: 'create' | 'update') => {
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

  const deleteManagedLayout = async (fileId: string) => {
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

  const publishManagedLayout = async (managedLayout?: ObservatoryLayoutDocument) => {
    const layoutToPublish = managedLayout ?? currentManagedLayout();

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
        ? 'Published layout to browser storage and repo file.'
        : 'Repo publish succeeded, but browser-local publish failed.',
    });
    setLastPublishedAt(payload.layout.metadata?.publishedAt ?? null);

    if (result.layout) {
      onPublishedLayout?.(result.layout);
    }
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
      y: targetRoom.bounds.y + 1,
    };

    applyEdit(
      placeObservatoryObject(layout, map.id, {
        assetId: selectedPaletteAsset.assetId,
        blocksMovement: true,
        position: preferredPosition,
        roomId: targetRoom.id,
        size: selectedPaletteAsset.footprint,
      })
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
      : generateObservatoryLayoutFromPrompt(createCleanPromptBaseLayout(), layoutPrompt);
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
    const nextLayout = createBlankObservatoryLayout(layout);
    const validation = validateObservatoryLayout(nextLayout);

    setLastResult({
      changed: Boolean(validation.layout),
      issues: validation.issues,
      layout: validation.layout ?? layout,
      message: validation.layout
        ? 'Reset builder to a blank canvas.'
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

  const loadRepoLayout = () => {
    const validation = validateObservatoryLayout(repoPublishedLayout);

    if (!validation.layout) {
      setLastResult({
        changed: false,
        issues: validation.issues,
        layout,
        message: 'Repo layout failed validation.',
      });
      return;
    }

    if (typeof window !== 'undefined') {
      clearObservatoryLayoutStorage(window.localStorage, OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY);
    }

    const nextLayout = cloneObservatoryLayout(validation.layout);
    const nextMap = nextLayout.world.maps[0];
    setSelectedManagedLayoutId('');
    setSelectedRoomId(nextMap?.rooms[0]?.id ?? '');
    setLastResult({
      changed: true,
      issues: [],
      layout: nextLayout,
      message: 'Loaded repo published layout into builder.',
    });
    startTransition(() => onLayoutChange(nextLayout));
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

  return (
    <section className={styles.panel} aria-label="Observatory manual layout editor">
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Manual Layout Editor</h3>
          <p className={styles.description}>
            Control placing, moving, deleting objects and creating or resizing rooms. <br /> Click a
            room on the canvas to reveal resize handles directly on the map.
          </p>
        </div>
      </div>

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
        <summary className={styles.summary}>Layout management</summary>
        <div className={styles.managementSectionStack}>
          <section className={styles.managementCard}>
            <div className={styles.managementCardHeader}>
              <div>
                <strong>Current layout</strong>
                <p className={styles.meta}>
                  Save the current builder state, deploy it to the repo, or export a JSON copy.
                </p>
              </div>
              <span className={styles.controlCardBadge}>
                {selectedManagedLayoutId ? 'Saved layout' : 'Unsaved'}
              </span>
            </div>
            <div className={styles.managementGrid}>
              <label className={styles.field}>
                <span>Layout name</span>
                <input
                  className={styles.input}
                  disabled={disabled}
                  onChange={(event) => setLayoutName(event.target.value)}
                  placeholder="Observatory Office Variant A"
                  value={layoutName}
                />
              </label>
              <label className={styles.field}>
                <span>Layout notes</span>
                <textarea
                  className={`${styles.textarea} ${styles.textareaCompact}`}
                  disabled={disabled}
                  onChange={(event) => setLayoutNotes(event.target.value)}
                  rows={2}
                  value={layoutNotes}
                />
              </label>
            </div>
            <div className={styles.managementStatusRow}>
              <span className={styles.positionBadge}>
                {selectedManagedLayoutId ? 'Connected to saved layout' : 'Working draft'}
              </span>
              <span className={styles.positionBadge}>
                Repo layouts {layoutLibrarySummaries.length}
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
                disabled={disabled}
                onClick={() => void saveManagedLayoutPrimary()}
                type="button"
              >
                {selectedManagedLayoutId ? 'Save changes' : 'Save as new'}
              </button>
              <button
                className={styles.button}
                disabled={disabled}
                onClick={() => void publishLayout()}
                type="button"
              >
                Deploy
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled}
                onClick={exportLayout}
                type="button"
              >
                Export JSON
              </button>
            </div>
            <div className={styles.managementSecondaryActions}>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled}
                onClick={() => void saveManagedLayout('create')}
                type="button"
              >
                Save copy
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled}
                onClick={createRoom}
                type="button"
              >
                Create room
              </button>
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                disabled={disabled}
                onClick={loadRepoLayout}
                type="button"
              >
                Load deployed
              </button>
              <button
                className={`${styles.button} ${styles.buttonDanger}`}
                disabled={disabled}
                onClick={resetBlankCanvas}
                type="button"
              >
                Blank canvas
              </button>
            </div>
          </section>

          <section className={styles.managementCard}>
            <div className={styles.managementCardHeader}>
              <div>
                <strong>Saved layouts</strong>
                <p className={styles.meta}>
                  Pick a saved repo layout when you need to load, deploy, or delete it.
                </p>
              </div>
              <span className={styles.controlCardBadge}>{layoutLibrarySummaries.length}</span>
            </div>
            {layoutLibraryLoading ? (
              <p className={styles.meta}>Loading saved layouts…</p>
            ) : layoutLibrarySummaries.length === 0 ? (
              <p className={styles.meta}>No saved repo-backed layouts yet.</p>
            ) : (
              <div className={styles.savedLayoutPicker}>
                <label className={styles.field}>
                  <span>Saved layout</span>
                  <select
                    className={styles.select}
                    disabled={disabled}
                    onChange={(event) => setManagedLayoutActionId(event.target.value)}
                    value={managedLayoutActionId}
                  >
                    {layoutLibrarySummaries.map((entry) => (
                      <option key={entry.fileId} value={entry.fileId}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedManagedLibraryEntry && selectedManagedLibrarySummary ? (
                  <>
                    <div className={styles.managementStatusRow}>
                      <span className={styles.positionBadge}>
                        {selectedManagedLayoutId === selectedManagedLibraryEntry.fileId
                          ? 'Loaded in builder'
                          : 'Saved in repo'}
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
                        disabled={disabled}
                        onClick={() => loadManagedLayout(selectedManagedLibraryEntry)}
                        type="button"
                      >
                        Load into builder
                      </button>
                      <button
                        className={`${styles.button} ${styles.buttonSecondary}`}
                        disabled={disabled}
                        onClick={() =>
                          void publishManagedLayout(selectedManagedLibraryEntry.layout)
                        }
                        type="button"
                      >
                        Deploy saved
                      </button>
                      <button
                        className={`${styles.button} ${styles.buttonDanger}`}
                        disabled={disabled}
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

      <details className={styles.accordion} open>
        <summary className={styles.summary}>Assets Palette</summary>
        <div className={styles.assetPaletteHeader}>
          <label className={styles.field}>
            <span>Search manifest assets</span>
            <input
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
              <select
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
              </select>
            </label>
            <label className={styles.field}>
              <span>Role</span>
              <select
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
              </select>
            </label>
            <label className={styles.field}>
              <span>Sort</span>
              <select
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
              </select>
            </label>
          </div>
          <label className={styles.checkboxField}>
            <input
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
                  <label className={styles.field}>
                    <span>Add to</span>
                    <select
                      className={styles.select}
                      disabled={disabled || map.rooms.length === 0}
                      onChange={(event) => {
                        const roomId = event.target.value;

                        if (roomId) {
                          placeObjectInRoom(roomId);
                        }
                      }}
                      value={assetTargetRoomId}
                    >
                      <option value="">Select room…</option>
                      {map.rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name} ({room.bounds.width}x{room.bounds.height})
                        </option>
                      ))}
                    </select>
                  </label>
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
          <textarea
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

function createCleanPromptBaseLayout(): ObservatoryLayoutDocument {
  const validation = validateObservatoryLayout(repoPublishedLayout);

  if (!validation.layout) {
    throw new Error('Observatory repo published layout is invalid.');
  }

  return validation.layout;
}
