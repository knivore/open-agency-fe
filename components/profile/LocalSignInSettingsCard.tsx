'use client';

import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { KeyRound, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';

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
import { usersApi, type BackendUser } from '@/lib/api/backend/users';

const PASSWORD_MIN_LENGTH = 8;

export default function LocalSignInSettingsCard({ user }: { user: BackendUser }) {
  const savedEmail = user.email.trim().toLowerCase();
  const [email, setEmail] = useState(savedEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const emailError =
    submitted && (!email.trim() || !email.includes('@')) ? 'Enter a valid login email.' : null;
  const currentPasswordError =
    submitted && !currentPassword ? 'Enter your current password to authorize this change.' : null;
  const newPasswordError =
    newPassword && newPassword.length < PASSWORD_MIN_LENGTH
      ? `Use at least ${PASSWORD_MIN_LENGTH} characters for the new password.`
      : null;
  const confirmPasswordError =
    newPassword && confirmPassword !== newPassword ? 'The new passwords do not match.' : null;
  const hasChanges = email.trim().toLowerCase() !== savedEmail || Boolean(newPassword);

  const updateMutation = useMutation({
    mutationFn: () =>
      usersApi.updateLocalCredentials({
        email: email.trim().toLowerCase(),
        current_password: currentPassword,
        ...(newPassword ? { new_password: newPassword } : {}),
      }),
    onSuccess: async () => {
      // Clear secrets before the browser navigates away. The backend has already
      // revoked every local session, so the new credentials must start a fresh one.
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await signOut({ callbackUrl: '/login?callbackUrl=%2Fprofile' });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (
      !email.trim() ||
      !email.includes('@') ||
      !currentPassword ||
      !hasChanges ||
      newPasswordError ||
      confirmPasswordError
    ) {
      return;
    }
    updateMutation.mutate();
  };

  const resetMutation = () => {
    setSubmitted(false);
    updateMutation.reset();
  };

  return (
    <Card id="local-sign-in">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" aria-hidden="true" />
              Local sign-in
            </CardTitle>
            <CardDescription>
              Manage the email and password used by this Open Agency owner account.
            </CardDescription>
          </div>
          <Badge variant="secondary">Owner managed</Badge>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="flex flex-col gap-5">
          <Alert>
            <ShieldCheck aria-hidden="true" />
            <AlertTitle>Current-password confirmation required</AlertTitle>
            <AlertDescription>
              Saving ends every local browser session and returns you to sign-in. Automation keys
              remain active.
            </AlertDescription>
          </Alert>

          {updateMutation.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Sign-in update failed</AlertTitle>
              <AlertDescription>
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'The local sign-in settings could not be updated.'}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormFieldGroup columns={2}>
            <FormField
              label="Login email"
              htmlFor="local-login-email"
              description="Use this email the next time you sign in."
              error={emailError}
              required
            >
              <Input
                id="local-login-email"
                type="email"
                value={email}
                onChange={(event) => {
                  resetMutation();
                  setEmail(event.target.value);
                }}
                autoComplete="username"
                maxLength={320}
                aria-invalid={Boolean(emailError)}
              />
            </FormField>

            <FormField
              label="Current password"
              htmlFor="local-current-password"
              description="Required for email or password changes."
              error={currentPasswordError}
              required
            >
              <Input
                id="local-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  resetMutation();
                  setCurrentPassword(event.target.value);
                }}
                autoComplete="current-password"
                aria-invalid={Boolean(currentPasswordError)}
              />
            </FormField>

            <FormField
              label="New password"
              htmlFor="local-new-password"
              description="Optional. Leave blank to keep the current password."
              error={newPasswordError}
            >
              <Input
                id="local-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => {
                  resetMutation();
                  setNewPassword(event.target.value);
                }}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                aria-invalid={Boolean(newPasswordError)}
              />
            </FormField>

            <FormField
              label="Confirm new password"
              htmlFor="local-confirm-password"
              description="Repeat the new password before saving."
              error={confirmPasswordError}
            >
              <Input
                id="local-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  resetMutation();
                  setConfirmPassword(event.target.value);
                }}
                autoComplete="new-password"
                disabled={!newPassword}
                aria-invalid={Boolean(confirmPasswordError)}
              />
            </FormField>
          </FormFieldGroup>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            disabled={
              updateMutation.isPending ||
              !hasChanges ||
              Boolean(newPasswordError || confirmPasswordError)
            }
          >
            {updateMutation.isPending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <LogOut data-icon="inline-start" />
            )}
            Update sign-in and sign out
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
