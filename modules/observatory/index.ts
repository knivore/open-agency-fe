export const OBSERVATORY_MODULE_ID = 'observatory';

export const OBSERVATORY_MODULE_NAME = 'Observatory';

export { default as ObservatoryRuntimeSurface } from '@/modules/observatory/app/ObservatoryRuntimeSurface';
export type {
  ObservatoryRuntimeSurfaceProps,
  ObservatoryRuntimeAgentSource,
  ObservatoryRuntimeEventContext,
  ObservatoryRuntimePreviewMode,
  ObservatoryRuntimeRunContext,
} from '@/modules/observatory/app/ObservatoryRuntimeSurface';
export { default as AssetPackSummary } from '@/modules/observatory/components/AssetPackSummary';
export { default as ManualLayoutEditorPanel } from '@/modules/observatory/components/ManualLayoutEditorPanel';
export type { ManualLayoutEditorPanelProps } from '@/modules/observatory/components/ManualLayoutEditorPanel';
export { default as ObservatoryGameCanvas } from '@/modules/observatory/components/ObservatoryGameCanvas';
export type { ObservatoryGameCanvasProps } from '@/modules/observatory/components/ObservatoryGameCanvas';
export { default as RuntimeActivityFeed } from '@/modules/observatory/components/RuntimeActivityFeed';
export type {
  ObservatoryFeedLevelFilter,
  RuntimeActivityFeedProps,
} from '@/modules/observatory/components/RuntimeActivityFeed';
export { default as RuntimeSourceManager } from '@/modules/observatory/components/RuntimeSourceManager';
export type { RuntimeSourceManagerProps } from '@/modules/observatory/components/RuntimeSourceManager';
export { default as RuntimeRawEventPanel } from '@/modules/observatory/components/RuntimeRawEventPanel';
export type { RuntimeRawEventPanelProps } from '@/modules/observatory/components/RuntimeRawEventPanel';
export { default as RuntimeReplayControls } from '@/modules/observatory/components/RuntimeReplayControls';
export type { RuntimeReplayControlsProps } from '@/modules/observatory/components/RuntimeReplayControls';
export { default as RuntimeStateSummary } from '@/modules/observatory/components/RuntimeStateSummary';
export type { RuntimeStateSummaryProps } from '@/modules/observatory/components/RuntimeStateSummary';
export {
  createObservatoryCharacterActionAnimationKey,
  createObservatoryAssetLookup,
  filterObservatoryAssetRegistry,
  OBSERVATORY_ASSET_REGISTRY_VERSION,
  OBSERVATORY_FALLBACK_TEXTURE_KEY,
  validateObservatoryAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';
export type {
  ObservatoryAssetAnimation,
  ObservatoryAssetCategory,
  ObservatoryAssetDefinition,
  ObservatoryAssetRegistry,
  ObservatoryAssetSource,
  ObservatoryAssetSourceKind,
  ObservatoryAssetStatusAnimationKey,
  ObservatoryAutotileDefinition,
  ObservatoryAutotileKind,
  ObservatoryCharacterActionDefinition,
  ObservatoryCharacterActionName,
  ObservatoryCharacterActionPriority,
  ObservatoryCharacterDirection,
  ObservatoryCharacterSheetDefinition,
  ObservatoryInvalidAsset,
  ObservatoryValidatedAssetRegistry,
} from '@/modules/observatory/engine/assets/assetRegistry';
export { validateObservatoryCharacterActionManifest } from '@/modules/observatory/engine/assets/characterActionManifestValidation';
export type { ObservatoryCharacterActionManifestIssue } from '@/modules/observatory/engine/assets/characterActionManifestValidation';
export {
  observatoryAssetCatalogEntries,
  observatoryAssetCatalogSummary,
} from '@/modules/observatory/engine/assets/assetCatalog';
export { observatoryGeneratedAssetRegistryAssets } from '@/modules/observatory/engine/assets/generatedAssetRegistry';
export type {
  ObservatoryAssetCatalogDirectorySummary,
  ObservatoryAssetCatalogEntry,
} from '@/modules/observatory/engine/assets/assetCatalog';
export {
  summarizeObservatoryCatalogCoverage,
  validateObservatoryAssetCatalogEntries,
} from '@/modules/observatory/engine/assets/assetCatalogValidation';
export type {
  ObservatoryAssetCatalogCoverage,
  ObservatoryAssetCatalogIssue,
} from '@/modules/observatory/engine/assets/assetCatalogValidation';
export {
  getObservatoryAssetReviewQueue,
  observatoryCuratedAssetOverrides,
  observatoryGeneratedAssetCandidates,
  observatoryGeneratedAssetInventoryEntries,
  resolveObservatoryAssetCandidates,
  summarizeObservatoryAssetPipeline,
} from '@/modules/observatory/engine/assets/assetPipeline';
export type {
  ObservatoryAssetPipelineSummary,
  ObservatoryAssetReviewPriority,
  ObservatoryAssetReviewStatus,
  ObservatoryCuratedAssetOverride,
  ObservatoryGeneratedAssetCandidate,
  ObservatoryGeneratedAssetInventoryEntry,
  ObservatoryResolvedAssetCandidate,
} from '@/modules/observatory/engine/assets/assetPipeline';
export {
  collectObservatoryMapAssetIds,
  filterObservatoryRegistryForMap,
} from '@/modules/observatory/engine/assets/assetUsage';
export {
  getObservatoryModuleAssetRegistry,
  observatoryModuleAssetRegistry,
} from '@/modules/observatory/engine/assets/moduleAssetRegistry';
export {
  getObservatoryFullModuleAssetRegistry,
  observatoryFullModuleAssetRegistry,
} from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
export { createObservatoryGame } from '@/modules/observatory/engine/OfficeGame';
export type {
  ObservatoryGameHandle,
  ObservatoryGameOptions,
} from '@/modules/observatory/engine/OfficeGame';
export type {
  ObservatoryCanvasSelection,
  ObservatoryCanvasSelectionKind,
} from '@/modules/observatory/engine/selection';
export { createObservatoryAgentInspector } from '@/modules/observatory/engine/rendering/agentInspector';
export type { ObservatoryAgentInspector } from '@/modules/observatory/engine/rendering/agentInspector';
export {
  dispatchObservatoryAgentVisualState,
  OBSERVATORY_AGENT_VISUAL_STATE_EVENT,
} from '@/modules/observatory/engine/rendering/agentVisualState';
export type {
  ObservatoryAgentVisualState,
  ObservatoryAgentVisualStateEventDetail,
  ObservatoryRoomVisualState,
} from '@/modules/observatory/engine/rendering/agentVisualState';
export { createObservatoryObjectInspector } from '@/modules/observatory/engine/rendering/objectInspector';
export type { ObservatoryObjectInspector } from '@/modules/observatory/engine/rendering/objectInspector';
export { renderObservatoryOfficeMap } from '@/modules/observatory/engine/rendering/officeMapRenderer';
export type {
  ObservatoryOfficeMapRendererOptions,
  ObservatoryRenderedOfficeMap,
} from '@/modules/observatory/engine/rendering/officeMapRenderer';
export { setupObservatorySceneInteractions } from '@/modules/observatory/engine/rendering/sceneInteractionControls';
export type { ObservatorySceneInteractionOptions } from '@/modules/observatory/engine/rendering/sceneInteractionControls';
export {
  gridRectToWorldRect,
  gridToWorld,
  gridToWorldCenter,
  OBSERVATORY_DEFAULT_TILE_SIZE,
  pointInGridRect,
  worldToGrid,
} from '@/modules/observatory/engine/world/grid';
export type {
  ObservatoryGridConfig,
  ObservatoryGridPoint,
  ObservatoryGridRect,
  ObservatoryGridSize,
  ObservatoryWorldPoint,
} from '@/modules/observatory/engine/world/grid';
export {
  applyObservatoryProceduralLayoutRules,
  cloneObservatoryLayout,
  createBlankObservatoryLayout,
  createObservatoryCorridor,
  createObservatoryRoom,
  deleteObservatoryObject,
  moveObservatoryObject,
  placeObservatoryObject,
  placeObservatoryRoomTemplate,
  resizeObservatoryRoom,
} from '@/modules/observatory/engine/world/layoutEditing';
export type {
  ObservatoryCreateRoomInput,
  ObservatoryLayoutEditResult,
  ObservatoryPlaceObjectInput,
} from '@/modules/observatory/engine/world/layoutEditing';
export {
  createObservatoryTemplateObject,
  getObservatoryRoomTemplate,
  observatoryRoomTemplates,
} from '@/modules/observatory/engine/world/roomTemplates';
export type {
  ObservatoryPlacedRoomTemplate,
  ObservatoryRoomTemplate,
  ObservatoryRoomTemplateId,
  ObservatoryRoomTemplateObject,
} from '@/modules/observatory/engine/world/roomTemplates';
export {
  generateObservatoryCorridorBounds,
  generateObservatoryCorridorRoom,
} from '@/modules/observatory/generation/corridorGeneration';
export type { ObservatoryCorridorGenerationOptions } from '@/modules/observatory/generation/corridorGeneration';
export {
  findObservatoryCollisionSafePlacement,
  generateObservatoryDoorObjects,
  OBSERVATORY_DEFAULT_DESK_SPACING,
  OBSERVATORY_DOOR_ASSET_ID,
  validateObservatoryCollisionSafety,
  validateObservatoryDeskSpacing,
  validateObservatoryGeneratedLayout,
  validateObservatoryWalkability,
} from '@/modules/observatory/generation/proceduralLayoutRules';
export type { ObservatoryProceduralValidationResult } from '@/modules/observatory/generation/proceduralLayoutRules';
export {
  generateObservatoryLayoutFromPrompt,
  parseObservatoryLayoutPrompt,
  validateObservatoryPromptLayout,
} from '@/modules/observatory/generation/promptToLayout';
export type {
  ObservatoryPromptLayoutPlan,
  ObservatoryPromptLayoutResult,
} from '@/modules/observatory/generation/promptToLayout';
export {
  clearObservatoryLayoutStorage,
  exportObservatoryLayoutJson,
  importObservatoryLayoutJson,
  OBSERVATORY_DRAFT_LAYOUT_STORAGE_KEY,
  OBSERVATORY_LAYOUT_STORAGE_KEY,
  OBSERVATORY_PUBLISHED_LAYOUT_STORAGE_KEY,
  parseObservatoryLayoutJson,
  publishObservatoryLayoutToStorage,
  readObservatoryDraftLayoutFromStorage,
  readObservatoryLayoutFromStorage,
  readObservatoryPublishedLayoutFromStorage,
  readObservatoryViewerLayoutFromStorage,
  serializeObservatoryLayout,
  writeObservatoryDraftLayoutToStorage,
  writeObservatoryLayoutToStorage,
  writeObservatoryPublishedLayoutToStorage,
} from '@/modules/observatory/engine/world/layoutPersistence';
export type {
  ObservatoryLayoutExportResult,
  ObservatoryLayoutImportOptions,
  ObservatoryLayoutParseResult,
  ObservatoryLayoutPublishOptions,
  ObservatoryLayoutStorageResult,
  ObservatoryViewerLayoutResult,
} from '@/modules/observatory/engine/world/layoutPersistence';
export { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';
export { OBSERVATORY_LAYOUT_SCHEMA_VERSION } from '@/modules/observatory/engine/world/layoutTypes';
export type {
  ObservatoryAgent,
  ObservatoryAgentStatus,
  ObservatoryLayoutDocument,
  ObservatoryLayoutIssue,
  ObservatoryMap,
  ObservatoryObject,
  ObservatoryRoom,
  ObservatoryRoomKind,
  ObservatoryValidatedLayout,
  ObservatoryWorld,
} from '@/modules/observatory/engine/world/layoutTypes';
export {
  normalizeObservatoryRuntimeEvent,
  normalizeValidatedObservatoryRuntimeEvent,
} from '@/modules/observatory/runtime/eventNormalizer';
export { validateObservatoryExternalRuntimeEvent } from '@/modules/observatory/runtime/eventValidation';
export type {
  ObservatoryEventNormalizationResult,
  ObservatoryEventValidationIssue,
  ObservatoryExternalRuntimeEvent,
  ObservatoryNormalizedEventType,
  ObservatoryNormalizedOfficeEvent,
  ObservatoryRuntimeEventNormalizer,
  ObservatoryRuntimeLevel,
  ObservatoryRuntimeSourceType,
  ObservatoryValidatedExternalRuntimeEvent,
} from '@/modules/observatory/runtime/events';
export { AGENCY_RUNTIME_EVENT_SCHEMA_VERSION } from '@/modules/observatory/runtime/events';
export { observatoryRuntimeDemoFixtures } from '@/modules/observatory/runtime/demoFixtures';
export type {
  ObservatoryRuntimeDemoAgent,
  ObservatoryRuntimeDemoContext,
  ObservatoryRuntimeDemoEvent,
  ObservatoryRuntimeDemoFixture,
} from '@/modules/observatory/runtime/demoFixtures';
export { pushObservatoryLocalRuntimeEvent } from '@/modules/observatory/integrations/localEventBridge';
export type { ObservatoryLocalEventBridgeResult } from '@/modules/observatory/integrations/localEventBridge';
export { createObservatoryLocalSdkClient } from '@/modules/observatory/integrations/localSdkClient';
export type {
  ObservatoryLocalSdkClient,
  ObservatoryLocalSdkClientOptions,
} from '@/modules/observatory/integrations/localSdkClient';
export {
  createObservatoryPostMessageReceiver,
  isObservatoryPostMessagePayload,
  OBSERVATORY_POST_MESSAGE_TYPE,
} from '@/modules/observatory/integrations/postMessageBridge';
export type {
  ObservatoryPostMessagePayload,
  ObservatoryPostMessageReceiverOptions,
} from '@/modules/observatory/integrations/postMessageBridge';
export {
  createObservatoryPlatformRuntimeSources,
  createObservatoryPlatformSampleEvent,
  getObservatoryPlatformAdapter,
  OBSERVATORY_CLAUDE_CODE_SOURCE_ID,
  OBSERVATORY_CODEX_SOURCE_ID,
  OBSERVATORY_HERMES_SOURCE_ID,
  OBSERVATORY_PLATFORM_ADAPTERS,
} from '@/modules/observatory/integrations/platformAdapters';
export type {
  ObservatoryPlatformAdapterDefinition,
  ObservatoryPlatformAdapterId,
  ObservatoryPlatformEventMapping,
} from '@/modules/observatory/integrations/platformAdapters';
export {
  createObservatorySourceRegistry,
  OBSERVATORY_DEFAULT_RUNTIME_SOURCES,
  OBSERVATORY_GENERIC_SSE_SOURCE_ID,
  OBSERVATORY_GENERIC_WEBSOCKET_SOURCE_ID,
  OBSERVATORY_LOCAL_SDK_SOURCE_ID,
  OBSERVATORY_LOCAL_SOURCE_ID,
  OBSERVATORY_POST_MESSAGE_SOURCE_ID,
  validateObservatoryRuntimeSource,
} from '@/modules/observatory/integrations/sourceRegistry';
export type {
  ObservatoryRuntimeSourceConfig,
  ObservatoryRuntimeSourceStatus,
  ObservatorySourceRegistry,
} from '@/modules/observatory/integrations/sourceRegistry';
export { createObservatorySseAdapter } from '@/modules/observatory/integrations/sseAdapter';
export type {
  ObservatoryEventSourceConstructor,
  ObservatoryEventSourceLike,
  ObservatorySseAdapterOptions,
} from '@/modules/observatory/integrations/sseAdapter';
export type {
  ObservatoryStreamAdapter,
  ObservatoryStreamAdapterReconnectOptions,
  ObservatoryStreamAdapterStateOptions,
  ObservatoryStreamAdapterStatus,
  ObservatoryStreamAdapterStatusSnapshot,
} from '@/modules/observatory/integrations/streamAdapterTypes';
export {
  ingestObservatoryStreamPayload,
  OBSERVATORY_DEFAULT_MAX_STREAM_PAYLOAD_BYTES,
  parseObservatoryStreamPayload,
} from '@/modules/observatory/integrations/streamPayload';
export type {
  ObservatoryStreamPayloadOptions,
  ObservatoryStreamPayloadResult,
} from '@/modules/observatory/integrations/streamPayload';
export { createObservatoryWebSocketAdapter } from '@/modules/observatory/integrations/webSocketAdapter';
export type {
  ObservatoryWebSocketAdapterOptions,
  ObservatoryWebSocketConstructor,
  ObservatoryWebSocketLike,
} from '@/modules/observatory/integrations/webSocketAdapter';
export { observatorySampleExternalRuntimeEvents } from '@/modules/observatory/runtime/sampleEvents';
export {
  clampObservatoryReplayCursor,
  createObservatoryReplayFrame,
  createObservatoryReplayFrameAtTimestamp,
  createObservatoryReplayTimeline,
} from '@/modules/observatory/runtime/replayTimeline';
export type {
  ObservatoryReplayFrame,
  ObservatoryReplayTimeline,
  ObservatoryReplayTimelineEvent,
} from '@/modules/observatory/runtime/replayTimeline';
export {
  createObservatoryLayoutInspectionLogEntries,
  createObservatoryRuntimeContextInspectionLogEntries,
  createObservatoryStaticRuntimeLogAdapter,
  selectObservatoryAgentInspectionLogs,
  selectObservatoryObjectInspectionLogs,
  selectObservatoryRoomInspectionLogs,
} from '@/modules/observatory/runtime/inspectionLogs';
export type {
  ObservatoryInspectionLogEntry,
  ObservatoryInspectionLogQuery,
  ObservatoryInspectionLogResult,
  ObservatoryInspectionLogSource,
  ObservatoryInspectionLogStatus,
  ObservatoryRuntimeInspectionContext,
  ObservatoryRuntimeInspectionEvent,
  ObservatoryRuntimeLogAdapter,
} from '@/modules/observatory/runtime/inspectionLogs';
export {
  mapRuntimeStateToAgentVisualStates,
  mapRuntimeStateToRoomVisualStates,
} from '@/modules/observatory/runtime/visualBehaviorMapping';
export {
  createInitialObservatoryRuntimeVisualState,
  OBSERVATORY_DEFAULT_MAX_EVENT_HISTORY,
  OBSERVATORY_DEFAULT_MAX_FEED_ENTRIES,
  OBSERVATORY_DEFAULT_MAX_SPEECH_CHARS,
  reduceObservatoryRuntimeEvent,
  reduceObservatoryRuntimeEvents,
} from '@/modules/observatory/runtime/visualState';
export type {
  ObservatoryActivityFeedEntry,
  ObservatoryRuntimeAgentState,
  ObservatoryRuntimeEntityStatus,
  ObservatoryRuntimeReducerOptions,
  ObservatoryRuntimeTaskState,
  ObservatoryRuntimeVisualState,
  ObservatoryRuntimeWorkflowState,
} from '@/modules/observatory/runtime/visualState';
export { createObservatoryRuntimeVisualStore } from '@/modules/observatory/state/runtimeVisualStore';
export type {
  ObservatoryRuntimeVisualStore,
  ObservatoryRuntimeVisualStoreListener,
} from '@/modules/observatory/state/runtimeVisualStore';
export { useObservatoryRuntimeVisualStoreSnapshot } from '@/modules/observatory/state/useRuntimeVisualStore';
