'use client';

import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { AppInlineState } from '@/components/app-shell/AppState';

const ImageArtifacts = ({ processId }: { processId: string }) => {
  const [storedLoadState, setStoredLoadState] = useState<{
    error: string | null;
    processId: string;
    retryVersion: number;
    status: 'error' | 'loading' | 'ready';
  }>({ error: null, processId, retryVersion: 0, status: 'loading' });
  const loadState =
    storedLoadState.processId === processId
      ? storedLoadState
      : { error: null, processId, retryVersion: 0, status: 'loading' as const };
  const isLoading = loadState.status === 'loading';
  const error = loadState.error;

  const retry = () => {
    setStoredLoadState({
      error: null,
      processId,
      retryVersion: loadState.retryVersion + 1,
      status: 'loading',
    });
  };
  const streamUrl = `/api/workflows/process/${processId}/artifacts?type=images&retry=${loadState.retryVersion}`;

  return (
    <figure className="my-4 overflow-hidden rounded-xl border border-(--agency-shell-border) bg-(--agency-shell-panel)">
      <figcaption className="flex items-start gap-3 border-b border-(--agency-shell-border) px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--agency-row-hover) text-(--agency-shell-muted)">
          <ImageIcon className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-(--agency-shell-text)">Image artifacts</p>
          <p className="mt-0.5 text-xs leading-5 text-(--agency-shell-muted)">
            Visual output streamed from this workflow process.
          </p>
        </div>
      </figcaption>
      <div className="space-y-3 p-3">
        {isLoading ? (
          <AppInlineState
            variant="loading"
            title="Loading image artifacts"
            description="The image will appear as soon as the workflow publishes it."
          />
        ) : null}
        {error ? (
          <AppInlineState
            variant="error"
            title="Image artifact unavailable"
            description={error}
            actionLabel="Retry image"
            onAction={retry}
          />
        ) : null}
        <div className={error ? 'hidden' : 'overflow-hidden rounded-lg bg-(--agency-row-hover)'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={streamUrl}
            src={streamUrl}
            alt="Workflow image artifact"
            className={`h-auto max-h-[70dvh] w-full object-contain ${isLoading ? 'min-h-40 opacity-0' : 'opacity-100'}`}
            onLoad={() => {
              setStoredLoadState({
                error: null,
                processId,
                retryVersion: loadState.retryVersion,
                status: 'ready',
              });
            }}
            onError={() => {
              setStoredLoadState({
                error:
                  'Open Agency could not load this image. The process may still be generating it.',
                processId,
                retryVersion: loadState.retryVersion,
                status: 'error',
              });
            }}
          />
        </div>
      </div>
    </figure>
  );
};

export default ImageArtifacts;
