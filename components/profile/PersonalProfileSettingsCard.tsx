'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LocateFixed, LoaderCircle, Save, UserRoundCog } from 'lucide-react';

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
import { Input } from '@/components/library/shadcn/input';
import { FormField, FormFieldGroup } from '@/components/app-shell/FormSection';
import {
  getBackendUserProfilePreferences,
  usersApi,
  type BackendUser,
} from '@/lib/api/backend/users';
import { queryKeys } from '@/lib/react-query/queryKeys';

const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
] as const;

function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export default function PersonalProfileSettingsCard({ user }: { user: BackendUser }) {
  const queryClient = useQueryClient();
  const savedPreferences = getBackendUserProfilePreferences(user);
  const savedDisplayName = savedPreferences.displayName ?? user.display_name ?? '';
  const savedTimezone = savedPreferences.timezone ?? deviceTimezone();
  const [displayName, setDisplayName] = useState(savedDisplayName);
  const [timezone, setTimezone] = useState(savedTimezone);

  const displayNameError = displayName.trim() ? null : 'Enter the name Open Agency should display.';
  const timezoneError = timezone.trim() ? null : 'Enter an IANA timezone such as Asia/Singapore.';
  const hasChanges = displayName.trim() !== savedDisplayName || timezone.trim() !== savedTimezone;

  const updateMutation = useMutation({
    mutationFn: () =>
      usersApi.updateCurrentUserProfile({
        display_name: displayName.trim(),
        timezone: timezone.trim(),
      }),
    onSuccess: (updatedUser) => {
      const updatedPreferences = getBackendUserProfilePreferences(updatedUser);
      setDisplayName(updatedPreferences.displayName ?? updatedUser.display_name ?? '');
      setTimezone(updatedPreferences.timezone ?? deviceTimezone());
      queryClient.setQueryData(queryKeys.backendCurrentUser(user.id), updatedUser);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (displayNameError || timezoneError || !hasChanges) {
      return;
    }
    updateMutation.mutate();
  };

  const updateDraft = (field: 'displayName' | 'timezone', value: string) => {
    updateMutation.reset();
    if (field === 'displayName') {
      setDisplayName(value);
      return;
    }
    setTimezone(value);
  };

  return (
    <Card id="personal-settings">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2">
              <UserRoundCog className="size-5 text-primary" aria-hidden="true" />
              Personal settings
            </CardTitle>
            <CardDescription>
              Choose how Open Agency identifies you and displays account activity times.
            </CardDescription>
          </div>
          <Badge variant="secondary">Account scoped</Badge>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-5">
          {updateMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Profile update failed</AlertTitle>
              <AlertDescription>
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'The profile settings could not be saved.'}
              </AlertDescription>
            </Alert>
          ) : null}

          {updateMutation.isSuccess ? (
            <Alert>
              <AlertTitle>Personal settings saved</AlertTitle>
              <AlertDescription>
                These values follow your Open Agency account across browsers.
              </AlertDescription>
            </Alert>
          ) : null}

          <FormFieldGroup columns={2}>
            <FormField
              label="Display name"
              htmlFor="profile-display-name"
              description="Used in your Profile and backend user identity."
              error={displayNameError}
              required
            >
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(event) => updateDraft('displayName', event.target.value)}
                maxLength={120}
                autoComplete="name"
                aria-invalid={Boolean(displayNameError)}
                aria-describedby="profile-display-name-feedback"
              />
            </FormField>

            <FormField
              label="Time zone"
              htmlFor="profile-timezone"
              description="Use an IANA timezone. Dates on this page follow this setting."
              error={timezoneError}
              required
            >
              <Input
                id="profile-timezone"
                list="profile-timezone-options"
                value={timezone}
                onChange={(event) => updateDraft('timezone', event.target.value)}
                placeholder="Asia/Singapore"
                maxLength={64}
                aria-invalid={Boolean(timezoneError)}
                aria-describedby="profile-timezone-feedback"
              />
              <datalist id="profile-timezone-options">
                {COMMON_TIMEZONES.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => updateDraft('timezone', deviceTimezone())}
              >
                <LocateFixed data-icon="inline-start" />
                Use device time zone
              </Button>
            </FormField>
          </FormFieldGroup>

          <p className="text-xs leading-5 text-muted-foreground">
            Local sign-in credentials, when enabled, are managed separately below.
          </p>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            disabled={
              updateMutation.isPending || !hasChanges || Boolean(displayNameError || timezoneError)
            }
          >
            {updateMutation.isPending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Save personal settings
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
