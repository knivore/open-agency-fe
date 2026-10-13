import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormField, FormSection } from './FormSection';
import { Input } from '@/components/library/shadcn/input';
import { NativeSelect } from '@/components/library/shadcn/select';

describe('shared form contracts', () => {
  it('links feedback without dropping existing descriptions or adding native validation', () => {
    render(
      <>
        <p id="hint">Existing help</p>
        <FormField label="Name" htmlFor="name" error="Choose a name" required>
          <Input id="name" aria-describedby="hint" />
        </FormField>
      </>
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-describedby', 'hint name-feedback');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).not.toBeRequired();
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'name-feedback');
  });
  it('updates error and help associations with sibling controls present', () => {
    const field = (error?: string) => (
      <FormField label="Limit" htmlFor="limit" error={error} description="Maximum items">
        <Input id="limit" type="range" />
        <output htmlFor="limit">5</output>
      </FormField>
    );
    const { rerender } = render(field('Too many'));
    expect(screen.getByLabelText('Limit')).toHaveAttribute('aria-invalid', 'true');
    rerender(field());
    expect(screen.getByLabelText('Limit')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Limit')).toHaveAccessibleDescription('Maximum items');
  });
  it('gives repeated sections distinct labels and supports a configured anchor', () => {
    render(
      <>
        <FormSection title="Settings">First</FormSection>
        <FormSection title="Settings">Second</FormSection>
        <FormSection title="Advanced" id="advanced-settings">
          Third
        </FormSection>
      </>
    );
    const sections = screen.getAllByRole('region', { name: 'Settings' });
    expect(sections[0].getAttribute('aria-labelledby')).not.toBe(
      sections[1].getAttribute('aria-labelledby')
    );
    expect(screen.getByRole('region', { name: 'Advanced' })).toHaveAttribute(
      'aria-labelledby',
      'advanced-settings'
    );
  });
  it('preserves native selection values, disabled options and caller events', () => {
    const change = vi.fn();
    render(
      <FormField label="Mode" htmlFor="mode">
        <NativeSelect
          id="mode"
          defaultValue="read"
          onChange={(event) => change(event.target.value)}
        >
          <option value="read">Read</option>
          <option value="write">Write</option>
          <option value="blocked" disabled>
            Blocked
          </option>
        </NativeSelect>
      </FormField>
    );
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'write' } });
    expect(change).toHaveBeenCalledWith('write');
    expect(screen.getByRole('option', { name: 'Blocked' })).toBeDisabled();
  });
});
