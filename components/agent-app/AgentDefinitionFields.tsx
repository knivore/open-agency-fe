'use client';

import type { ReactNode, Ref } from 'react';
import { FormField, FormFieldGroup } from '@/components/app-shell/FormSection';
import { Input } from '@/components/library/shadcn/input';
import { NativeSelect } from '@/components/library/shadcn/select';
import { Textarea } from '@/components/library/shadcn/textarea';
import type { BehaviorTuningProfile } from '@/types/agents';

export interface AgentIdentityValues {
  name: string;
  role: string;
  description: string;
  modelProfileId: string;
}

/** The same identity contract is used by creation and the inline editor. */
export function AgentIdentityFields({
  idPrefix,
  values,
  onChange,
  profiles,
  disabled = false,
  mainAgent = false,
  nameRef,
  nameError,
  onNameBlur,
  children,
}: {
  idPrefix: string;
  values: AgentIdentityValues;
  onChange: (patch: Partial<AgentIdentityValues>) => void;
  profiles: readonly BehaviorTuningProfile[];
  disabled?: boolean;
  mainAgent?: boolean;
  nameRef?: Ref<HTMLInputElement>;
  nameError?: string | null;
  onNameBlur?: () => void;
  children?: ReactNode;
}) {
  return (
    <FormFieldGroup columns={2}>
      <FormField label="Name" htmlFor={`${idPrefix}-name`} error={nameError} required>
        <Input
          ref={nameRef}
          id={`${idPrefix}-name`}
          required
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          onBlur={onNameBlur}
          disabled={disabled}
        />
      </FormField>
      <FormField label="Role" htmlFor={`${idPrefix}-role`} optional>
        <Input
          id={`${idPrefix}-role`}
          value={values.role}
          onChange={(event) => onChange({ role: event.target.value })}
          disabled={disabled}
        />
      </FormField>
      <FormField
        label="Description"
        htmlFor={`${idPrefix}-description`}
        description="A short summary of this agent’s purpose."
        className="md:col-span-2"
        optional
      >
        <Input
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          disabled={disabled}
        />
      </FormField>
      <FormField
        label="Model profile"
        htmlFor={`${idPrefix}-model-profile`}
        required={mainAgent}
        optional={!mainAgent}
      >
        <NativeSelect
          id={`${idPrefix}-model-profile`}
          value={values.modelProfileId}
          onChange={(event) => onChange({ modelProfileId: event.target.value })}
          disabled={disabled}
        >
          {!mainAgent ? <option value="">No profile</option> : null}
          {values.modelProfileId &&
          !profiles.some((profile) => profile.id === values.modelProfileId) ? (
            <option value={values.modelProfileId}>{values.modelProfileId} · Unavailable</option>
          ) : null}
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      {children}
    </FormFieldGroup>
  );
}

export function AgentInstructionsField({
  idPrefix,
  value,
  onChange,
  disabled,
  error,
  onBlur,
}: {
  idPrefix: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  onBlur?: () => void;
}) {
  return (
    <FormField
      label="Instructions"
      htmlFor={`${idPrefix}-instructions`}
      description="Describe the durable behavior this agent should follow in conversations and workflows."
      error={error}
      required
    >
      <Textarea
        id={`${idPrefix}-instructions`}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className="min-h-64 resize-y font-mono text-sm leading-6"
      />
    </FormField>
  );
}
