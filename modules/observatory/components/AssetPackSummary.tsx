'use client';

import Image from 'next/image';
import { useMemo } from 'react';

import {
  observatoryAssetCatalogEntries,
  observatoryAssetCatalogSummary,
} from '@/modules/observatory/engine/assets/assetCatalog';
import {
  summarizeObservatoryCatalogCoverage,
  validateObservatoryAssetCatalogEntries,
} from '@/modules/observatory/engine/assets/assetCatalogValidation';
import {
  getObservatoryAssetReviewQueue,
  summarizeObservatoryAssetPipeline,
} from '@/modules/observatory/engine/assets/assetPipeline';
import { validateObservatoryCharacterActionManifest } from '@/modules/observatory/engine/assets/characterActionManifestValidation';
import { getObservatoryFullModuleAssetRegistry } from '@/modules/observatory/engine/assets/moduleFullAssetRegistry';
import { collectObservatoryMapAssetIds } from '@/modules/observatory/engine/assets/assetUsage';
import sampleLayout from '@/modules/observatory/engine/world/sampleLayout.json';
import { validateObservatoryLayout } from '@/modules/observatory/engine/world/layoutValidation';

import styles from './AssetPackSummary.module.css';

export default function AssetPackSummary() {
  const summary = useMemo(() => {
    const registry = getObservatoryFullModuleAssetRegistry();
    const validatedLayout = validateObservatoryLayout(sampleLayout);
    const currentMap = validatedLayout.layout?.world.maps[0];
    const currentMapAssetIds = currentMap
      ? collectObservatoryMapAssetIds(currentMap)
      : new Set<string>();
    const catalogCoverage = summarizeObservatoryCatalogCoverage(
      registry,
      observatoryAssetCatalogSummary
    );
    const catalogIssueCount = validateObservatoryAssetCatalogEntries(
      observatoryAssetCatalogEntries
    ).length;
    const categoryCounts = registry.assets.reduce<Record<string, number>>((counts, asset) => {
      counts[asset.category] = (counts[asset.category] ?? 0) + 1;
      return counts;
    }, {});
    const animatedAssets = registry.assets.filter(
      (asset) =>
        asset.animation ||
        (asset.animations?.length ?? 0) > 0 ||
        (asset.characterActions?.length ?? 0) > 0
    );
    const frameInspectableAssets = registry.assets.filter(
      (asset) => asset.source.kind === 'spritesheet'
    );
    const characterActionAssets = registry.assets.filter(
      (asset) => (asset.characterActions?.length ?? 0) > 0
    );
    const characterManifestIssueCount = characterActionAssets.reduce(
      (count, asset) => count + validateObservatoryCharacterActionManifest(asset).length,
      0
    );
    const assetPipeline = summarizeObservatoryAssetPipeline();
    const reviewQueue = getObservatoryAssetReviewQueue(18).map((candidate) => ({
      ...candidate,
      previewUri: registry.assets.find((asset) => asset.catalogPath === candidate.catalogPath)
        ?.source.uri,
    }));

    return {
      animatedAssets,
      assetPipeline,
      assetCount: registry.assets.length,
      assetPackVersion: registry.assetPackVersion,
      catalogDirectories: observatoryAssetCatalogSummary.directories,
      catalogTotalFileCount: observatoryAssetCatalogSummary.totalFileCount,
      catalogCoverage,
      categoryCounts,
      catalogEntryCount: observatoryAssetCatalogEntries.length,
      catalogIssueCount,
      currentMapAssetCount: currentMapAssetIds.size,
      characterActionAssets,
      characterManifestIssueCount,
      frameInspectableAssets,
      invalidAssetCount: registry.invalidAssets.length,
      reviewQueue,
    };
  }, []);

  return (
    <section className={styles.panel} aria-label="Observatory asset pack summary">
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Asset Pack</h2>
          <p className={styles.description}>{summary.assetPackVersion}</p>
        </div>
        <span className={styles.badge}>{summary.currentMapAssetCount} map assets</span>
      </div>

      <div className={styles.coverage}>
        <strong>{summary.assetCount}</strong> registry entries from{' '}
        <strong>{summary.catalogTotalFileCount}</strong> asset files. Registry coverage is{' '}
        <strong>{Math.round(summary.catalogCoverage.coverageRatio * 100)}%</strong>.{' '}
        <strong>{summary.catalogEntryCount}</strong> generated catalog candidates are promoted with{' '}
        <strong>{summary.catalogIssueCount}</strong> catalog issues; Phaser preload remains scoped
        to current-map assets.
      </div>

      <div className={styles.pipeline}>
        <div className={styles.pipelineStat}>
          <span>Inventory</span>
          <strong>{summary.assetPipeline.inventoryFileCount}</strong>
        </div>
        <div className={styles.pipelineStat}>
          <span>Generated Candidates</span>
          <strong>{summary.assetPipeline.generatedCandidateCount}</strong>
        </div>
        <div className={styles.pipelineStat}>
          <span>Reviewed Overrides</span>
          <strong>{summary.assetPipeline.reviewedOverrideCount}</strong>
        </div>
        <div className={styles.pipelineStat}>
          <span>High Priority Queue</span>
          <strong>{summary.assetPipeline.highPriorityGeneratedCount}</strong>
        </div>
      </div>

      <div className={styles.stats}>
        {Object.entries(summary.categoryCounts).map(([category, count]) => (
          <div className={styles.stat} key={category}>
            <span>{category}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>

      <div className={styles.animations}>
        <span className={styles.label}>Animated</span>
        {summary.animatedAssets.map((asset) => (
          <span className={styles.token} key={asset.id}>
            {asset.label}
          </span>
        ))}
      </div>

      <div className={styles.catalog}>
        <span className={styles.label}>Asset folders</span>
        {summary.catalogDirectories.map((directory) => (
          <span className={styles.token} key={directory.directory}>
            {directory.directory}: {directory.fileCount}
          </span>
        ))}
      </div>

      <div className={styles.frameInspector}>
        <div className={styles.frameHeader}>
          <span className={styles.label}>Review queue</span>
          <span className={styles.description}>
            Generated high-priority assets that still need visual confirmation
          </span>
        </div>
        <div className={styles.reviewGrid}>
          {summary.reviewQueue.map((candidate) => (
            <article className={styles.reviewItem} key={candidate.id}>
              {candidate.previewUri ? (
                <Image
                  alt=""
                  className={styles.reviewPreview}
                  height={72}
                  loading="lazy"
                  src={candidate.previewUri}
                  unoptimized
                  width={144}
                />
              ) : null}
              <strong>{candidate.label}</strong>
              <span>{candidate.catalogPath}</span>
              <span>
                {candidate.category} | {candidate.source.frameWidth}x{candidate.source.frameHeight}{' '}
                | {candidate.review.frameGrid.frameCount} frames
              </span>
              <span>{candidate.review.reasons.join(', ')}</span>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.frameInspector}>
        <div className={styles.frameHeader}>
          <span className={styles.label}>Frame inspector</span>
          <span className={styles.description}>
            {summary.frameInspectableAssets.length} spritesheets registered
          </span>
        </div>
        <div className={styles.frameList}>
          {summary.frameInspectableAssets.map((asset) => (
            <article className={styles.frameItem} key={asset.id}>
              <strong>{asset.label}</strong>
              <span>
                {asset.id} | frame{' '}
                {asset.frame ??
                  asset.animation?.startFrame ??
                  asset.animations?.[0]?.startFrame ??
                  asset.characterActions?.[0]?.startFrame ??
                  0}{' '}
                | {asset.source.frameWidth}x{asset.source.frameHeight}
              </span>
              {asset.animations?.length ? (
                <span>{asset.animations.length} status/loop animations</span>
              ) : null}
              {asset.characterActions?.length ? (
                <span>
                  {asset.characterActions.filter((action) => action.priority === 'office').length}{' '}
                  office actions,{' '}
                  {
                    asset.characterActions.filter((action) => action.priority === 'documented')
                      .length
                  }{' '}
                  documented actions
                </span>
              ) : null}
              <span>{asset.semanticId ?? 'semantic id pending'}</span>
              {asset.collision ? (
                <span>
                  collision {asset.collision.width}x{asset.collision.height}
                  {asset.collision.offsetX || asset.collision.offsetY
                    ? ` +${asset.collision.offsetX ?? 0},${asset.collision.offsetY ?? 0}`
                    : ''}
                </span>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      <div className={styles.frameInspector}>
        <div className={styles.frameHeader}>
          <span className={styles.label}>Character actions</span>
          <span className={styles.description}>
            {summary.characterActionAssets.length} structured sheets,{' '}
            {summary.characterManifestIssueCount} manifest issues
          </span>
        </div>
        <div className={styles.actionGrid}>
          {summary.characterActionAssets.map((asset) => (
            <article className={styles.frameItem} key={`${asset.id}:actions`}>
              <strong>{asset.label}</strong>
              {asset.characterActions?.slice(0, 12).map((action) => (
                <span
                  key={`${asset.id}:${action.action}:${action.direction ?? 'all'}:${action.startFrame}`}
                >
                  row {action.row} {action.action}
                  {action.direction ? `/${action.direction}` : ''}: {action.startFrame}-
                  {action.endFrame}
                  {action.loopStartFrame !== undefined && action.loopEndFrame !== undefined
                    ? ` loop ${action.loopStartFrame}-${action.loopEndFrame}`
                    : ''}
                </span>
              ))}
              {(asset.characterActions?.length ?? 0) > 12 ? (
                <span>+{(asset.characterActions?.length ?? 0) - 12} more actions</span>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      {summary.invalidAssetCount > 0 ? (
        <p className={styles.issue}>{summary.invalidAssetCount} registry entries were skipped.</p>
      ) : (
        <p className={styles.description}>
          Registry validation is clean. Generated catalog candidates are live, with curated entries
          taking precedence for reviewed office assets.
        </p>
      )}
    </section>
  );
}
