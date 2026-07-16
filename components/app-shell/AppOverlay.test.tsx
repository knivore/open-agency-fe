import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppDialog, AppDrawer } from '@/components/app-shell/AppOverlay';
import {
  FieldFeedback,
  FormField,
  FormFieldGroup,
  FormSection,
} from '@/components/app-shell/FormSection';
import { Button } from '@/components/library/shadcn/button';

describe('AppOverlay foundations', () => {
  it('protects dirty dialogs from accidental dismissal', () => {
    const onOpenChange = vi.fn();
    render(
      <AppDialog
        open
        onOpenChange={onOpenChange}
        dirty
        title="Edit integration"
        description="Update the connector settings."
        footer={<Button type="button">Save changes</Button>}
      >
        <label htmlFor="connector-name">Name</label>
        <input id="connector-name" defaultValue="Discord" />
      </AppDialog>
    );

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('discloses advanced settings without hiding the primary form hierarchy', () => {
    const { container } = render(
      <FormSection title="Runtime settings" description="Optional execution controls." advanced>
        <label htmlFor="runtime">Runtime</label>
        <select id="runtime" />
      </FormSection>
    );

    const details = container.querySelector('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Runtime settings'));
    expect(details).toHaveAttribute('open');
  });

  it('announces inline field errors', () => {
    render(<FieldFeedback id="name-error" error="Enter a name." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
  });

  it('preserves flex body content height so overflowing dialog sections can scroll', () => {
    render(
      <AppDialog open onOpenChange={vi.fn()} title="Long form" bodyClassName="flex flex-col gap-4">
        <p>Scrollable content</p>
      </AppDialog>
    );

    expect(screen.getByText('Scrollable content').parentElement).toHaveClass(
      'overflow-y-auto',
      '[&>*]:shrink-0'
    );
  });

  it('keeps labels, requirements, help, and validation attached to one field hierarchy', () => {
    render(
      <FormFieldGroup columns={2}>
        <FormField
          label="Connection name"
          htmlFor="connection-name"
          description="Use a name your team will recognize."
          error="Enter a connection name."
          required
        >
          <input id="connection-name" aria-invalid aria-describedby="connection-name-feedback" />
        </FormField>
      </FormFieldGroup>
    );

    expect(screen.getByLabelText('Connection name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a connection name.');
  });

  it('uses a mobile-first drawer surface and prevents dismissal while work is pending', () => {
    render(
      <AppDrawer
        open
        busy
        onOpenChange={vi.fn()}
        title="Memory details"
        description="memory-123"
        footer={<Button type="button">Save</Button>}
      >
        <p>Memory content</p>
      </AppDrawer>
    );

    expect(screen.getByRole('dialog')).toHaveClass('w-full');
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByText('Memory content')).toBeInTheDocument();
  });
});
