import React, {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowMetadataEditor from '@/components/workflow/WorkflowMetadataEditor';

vi.mock('@/components/library/shadcn/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/library/shadcn/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/library/shadcn/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/library/shadcn/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock('@/components/library/shadcn/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

function renderEditor(overrides?: Partial<React.ComponentProps<typeof WorkflowMetadataEditor>>) {
  const onSave = vi.fn();

  render(
    <WorkflowMetadataEditor
      name="Workflow"
      description="Description"
      entrypoint=""
      defaultRuntimeAdapterId="adapter-a"
      executionHost="local"
      restartActiveExecutions={false}
      workflowMetadata={{}}
      workflowCapabilityTags={[]}
      visibleTaskDefinitions={[]}
      runtimeAdapters={[
        {
          id: 'adapter-a',
          name: 'Adapter A',
          adapter_type: 'test',
        },
      ]}
      workflowNameInvalid={false}
      workflowDescriptionInvalid={false}
      draftValidationIssues={[]}
      hasUnsavedChanges
      isSaving={false}
      onNameChange={() => {}}
      onDescriptionChange={() => {}}
      onEntrypointChange={() => {}}
      onDefaultRuntimeAdapterChange={() => {}}
      onExecutionHostChange={() => {}}
      onRestartActiveExecutionsChange={() => {}}
      onWorkflowMetadataChange={() => {}}
      onWorkflowCapabilityTagsChange={() => {}}
      onSave={onSave}
      {...overrides}
    />
  );

  return { onSave };
}

describe('WorkflowMetadataEditor', () => {
  it('links validation feedback to reusable fields without adding native validation', () => {
    renderEditor({ workflowNameInvalid: true, workflowDescriptionInvalid: true });
    const name = screen.getByRole('textbox', { name: 'Name' });
    const description = screen.getByRole('textbox', { name: 'Description' });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Workflow name is required.');
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toHaveAccessibleDescription('Workflow description is required.');
    expect(name).not.toBeRequired();
    expect(description).not.toBeRequired();
  });

  it('opts into visibility without granting edit permission or losing metadata', () => {
    const onWorkflowMetadataChange = vi.fn();
    renderEditor({
      workflowMetadata: { created_by: 'owner', mutable_by_main_agent: false },
      onWorkflowMetadataChange,
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Main agent access' }), {
      target: { value: 'visible' },
    });
    expect(onWorkflowMetadataChange).toHaveBeenCalledWith({
      created_by: 'owner',
      mutable_by_main_agent: false,
      visible_to_main_agent: true,
      visible_to_agent: true,
    });
  });

  it('revokes both visibility aliases while preserving other permissions', () => {
    const onWorkflowMetadataChange = vi.fn();
    renderEditor({
      workflowMetadata: { visible_to_agent: true, mutable_by_main_agent: true },
      onWorkflowMetadataChange,
    });
    const access = screen.getByRole('combobox', { name: 'Main agent access' });
    expect(access).toHaveValue('visible');
    fireEvent.change(access, { target: { value: 'hidden' } });
    expect(onWorkflowMetadataChange).toHaveBeenCalledWith({
      visible_to_agent: false,
      visible_to_main_agent: false,
      mutable_by_main_agent: true,
    });
  });

  it.each([
    'deny_main_agent',
    'denied_to_main_agent',
    'hidden_from_main_agent',
    'hide_from_main_agent',
    'main_agent_denied',
  ])('preserves explicit %s policy denials', (key) => {
    const onWorkflowMetadataChange = vi.fn();
    renderEditor({
      workflowMetadata: { [key]: true, visible_to_main_agent: true },
      onWorkflowMetadataChange,
    });
    expect(screen.getByRole('combobox', { name: 'Main agent access' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Main agent access' })).toHaveValue('hidden');
    expect(onWorkflowMetadataChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Workflow policy blocks main agent access/)).toBeInTheDocument();
  });

  it('disables save when draft validation issues exist', () => {
    renderEditor({
      draftValidationIssues: ['Edge metadata for "Task A" -> "Task B" must be valid JSON.'],
    });

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });

  it('allows save when the draft is valid and changed', () => {
    const { onSave } = renderEditor();

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('lets the restart active runs setting be edited', () => {
    const onRestartActiveExecutionsChange = vi.fn();
    renderEditor({ onRestartActiveExecutionsChange });

    fireEvent.change(screen.getByRole('combobox', { name: 'Active run behavior' }), {
      target: { value: 'restart' },
    });

    expect(onRestartActiveExecutionsChange).toHaveBeenCalledWith(true);
  });

  it('enables a persistent monitor through workflow metadata', () => {
    const onWorkflowMetadataChange = vi.fn();
    renderEditor({ onWorkflowMetadataChange });

    fireEvent.click(screen.getByRole('button', { name: 'Persistent monitor' }));

    expect(onWorkflowMetadataChange).toHaveBeenCalledWith({
      execution_lifecycle: {
        persistent_cycle: {
          enabled: true,
          failure_backoff_multiplier: 2,
          interval_seconds: 60,
          max_consecutive_failures: 5,
          max_interval_seconds: 3600,
        },
      },
    });
  });

  it('keeps WIP workflow capability controls hidden', () => {
    const onWorkflowCapabilityTagsChange = vi.fn();
    renderEditor({
      workflowCapabilityTags: ['home-control'],
      onWorkflowCapabilityTagsChange,
    });

    expect(screen.queryByText('Workflow capabilities')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vision')).not.toBeInTheDocument();

    expect(onWorkflowCapabilityTagsChange).not.toHaveBeenCalled();
  });
});
