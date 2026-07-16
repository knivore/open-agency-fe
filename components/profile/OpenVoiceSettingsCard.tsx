'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, LoaderCircle, RefreshCw, Save, Volume2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/library/shadcn/alert';
import { Badge } from '@/components/library/shadcn/badge';
import { Button } from '@/components/library/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/library/shadcn/card';
import { Label } from '@/components/library/shadcn/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/library/shadcn/select';
import { profileApi, type OpenVoiceStatus } from '@/lib/api/backend/profile';

const OPENVOICE_QUERY_KEY = ['profileOpenVoice'] as const;

type OpenVoiceSettingsCardProps = {
  context?: 'profile' | 'setup';
  id?: string;
};

export default function OpenVoiceSettingsCard({
  context = 'profile',
  id,
}: OpenVoiceSettingsCardProps) {
  const queryClient = useQueryClient();
  const [draftVoice, setDraftVoice] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: OPENVOICE_QUERY_KEY,
    queryFn: () => profileApi.getOpenVoiceStatus(),
    retry: 1,
  });
  const status = statusQuery.data;
  const selectedVoice = draftVoice ?? status?.settings.default_voice ?? 'friendly';

  const updateCachedStatus = (next: OpenVoiceStatus) => {
    queryClient.setQueryData(OPENVOICE_QUERY_KEY, next);
  };

  const saveMutation = useMutation({
    mutationFn: () => profileApi.updateOpenVoiceSettings(selectedVoice),
    onSuccess: (next) => {
      updateCachedStatus(next);
      setDraftVoice(null);
      setAudioUrl(null);
    },
  });

  const installMutation = useMutation({
    mutationFn: () => profileApi.installOpenVoiceCheckpoints(false),
    onSuccess: updateCachedStatus,
  });

  const testMutation = useMutation({
    mutationFn: () => profileApi.testOpenVoice(),
    onSuccess: (result) => {
      setAudioUrl(`data:${result.content_type};base64,${result.audio_base64}`);
    },
  });

  const mutationError = saveMutation.error ?? installMutation.error ?? testMutation.error;
  const isBusy = saveMutation.isPending || installMutation.isPending || testMutation.isPending;
  const hasUnsavedVoice = Boolean(status && selectedVoice !== status.settings.default_voice);

  return (
    <Card
      id={id}
      className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none"
    >
      <CardHeader className="border-b border-neutral-200 bg-neutral-50/80 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="size-5 text-primary" aria-hidden="true" />
              OpenVoice
            </CardTitle>
            <CardDescription>
              {context === 'setup'
                ? 'Optional local voice generation. You can skip this and configure it later from Profile.'
                : 'Manage the Open Agency-wide built-in voice used by local workflows and repair its model files.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Optional</Badge>
            {context === 'profile' ? <Badge variant="outline">Open Agency-wide</Badge> : null}
            <Badge variant={status?.ready ? 'successful' : 'outline'}>
              {statusQuery.isLoading ? 'Checking' : status?.ready ? 'Ready' : 'Needs setup'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-5 sm:pt-6">
        {statusQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>OpenVoice status unavailable</AlertTitle>
            <AlertDescription>
              Confirm the backend is healthy, then refresh this capability.
            </AlertDescription>
          </Alert>
        ) : null}

        {mutationError ? (
          <Alert variant="destructive">
            <AlertTitle>OpenVoice update failed</AlertTitle>
            <AlertDescription>
              {mutationError instanceof Error
                ? mutationError.message
                : 'The request could not be completed.'}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`openvoice-voice-${context}`}>
              {context === 'profile'
                ? 'Open Agency default built-in voice'
                : 'Default built-in voice'}
            </Label>
            <Select
              value={selectedVoice}
              onValueChange={setDraftVoice}
              disabled={!status || isBusy}
            >
              <SelectTrigger id={`openvoice-voice-${context}`}>
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(status?.available_voices ?? ['friendly']).map((voice) => (
                    <SelectItem key={voice} value={voice}>
                      {voice.charAt(0).toUpperCase() + voice.slice(1)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This preset is used whenever a workflow chooses OpenVoice without specifying a voice.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium">Runtime</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {!status
                  ? 'Checking runtime'
                  : status.runtime.installed
                    ? 'Installed in backend image'
                    : 'Backend rebuild required'}
              </p>
              {status?.runtime.revision ? (
                <code className="mt-2 block truncate text-xs text-muted-foreground">
                  {status.runtime.revision.slice(0, 12)}
                </code>
              ) : null}
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium">Model files</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {!status
                  ? 'Checking model files'
                  : status.checkpoints.installed
                    ? 'Built-in English voices installed'
                    : `${status.checkpoints.missing_files.length} files missing`}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Voice cloning:{' '}
                {!status ? 'checking' : status.supports_cloning ? 'available' : 'not installed'}
              </p>
            </div>
          </div>
        </div>

        {audioUrl ? (
          <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CircleCheck className="size-4 text-primary" aria-hidden="true" />
              Test sample generated with {status?.settings.default_voice ?? selectedVoice}
            </div>
            <audio className="w-full" controls src={audioUrl}>
              <track kind="captions" />
            </audio>
          </div>
        ) : null}

        <p className="text-xs leading-5 text-muted-foreground">
          Install or repair downloads checksum-verified V1 model files. Updating the pinned
          OpenVoice source revision still requires rebuilding the backend image.
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!hasUnsavedVoice || isBusy}
        >
          {saveMutation.isPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save voice
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => installMutation.mutate()}
          disabled={!status?.runtime.installed || isBusy}
        >
          {installMutation.isPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          {status?.ready ? 'Verify / repair files' : 'Install model files'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={!status?.ready || isBusy || hasUnsavedVoice}
        >
          {testMutation.isPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Volume2 data-icon="inline-start" />
          )}
          Generate test sample
        </Button>
      </CardFooter>
    </Card>
  );
}
