import type {
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
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/library/shadcn/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

function renderEditor(overrides?: Partial<React.ComponentProps<typeof WorkflowMetadataEditor>>) {
  const onSave = vi.fn();

  render(
    <WorkflowMetadataEditor
      name="Workflow"
      description="Description"
      entrypoint=""
      executionHost="local"
      restartActiveExecutions={false}
      allowedRuntimeAdapterIds={['adapter-a']}
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
      onExecutionHostChange={() => {}}
      onRestartActiveExecutionsChange={() => {}}
      onAllowedRuntimeAdapterToggle={() => {}}
      onSave={onSave}
      {...overrides}
    />
  );

  return { onSave };
}

describe('WorkflowMetadataEditor', () => {
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

    fireEvent.click(screen.getByRole('checkbox', { name: /Restart active runs/i }));

    expect(onRestartActiveExecutionsChange).toHaveBeenCalledWith(true);
  });
});
